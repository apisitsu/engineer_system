$ErrorActionPreference = "Stop"
$ProjectPath = $PSScriptRoot
$LogFile = "$ProjectPath\update_progress_live.log"

function Remove-GitIndexLock {
    param([string]$Path)
    $lockFile = "$Path\.git\index.lock"
    if (Test-Path $lockFile) {
        Write-Host "Found stale $lockFile. Attempting removal..." -ForegroundColor Yellow
        for ($i = 1; $i -le 5; $i++) {
            try {
                Remove-Item $lockFile -Force -ErrorAction Stop
                Write-Host "Successfully removed $lockFile" -ForegroundColor Green
                return
            } catch {
                Write-Host "Waiting for .git\index.lock to be released ($i/5)..." -ForegroundColor Yellow
                Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                    $_.Name -match "git"
                } | ForEach-Object {
                    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                }
                Start-Sleep -Milliseconds 500
            }
        }
    }
}

function Stop-ProcessTreeSafely {
    param([int]$TargetPid)
    if ($TargetPid -gt 0 -and $TargetPid -ne $PID) {
        if (Get-Process -Id $TargetPid -ErrorAction SilentlyContinue) {
            cmd.exe /c "taskkill.exe /PID $TargetPid /T /F >nul 2>&1"
        }
    }
}

# 1. Kill any existing stuck auto_update_and_run.ps1 processes and orphaned git processes
try {
    $StuckProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.Name -match "powershell" -and 
        $_.CommandLine -match "auto_update_and_run\.ps1" -and 
        $_.ProcessId -ne $PID 
    }
    foreach ($proc in $StuckProcesses) {
        Write-Host "Killing previous stuck update process PID $($proc.ProcessId)..." -ForegroundColor Yellow
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }

    # Kill any orphaned git processes for this project
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match "git" -and ($_.CommandLine -match [regex]::Escape($ProjectPath) -or $_.CommandLine -match "EngineerSystem")
    } | ForEach-Object {
        Write-Host "Killing orphaned git process PID $($_.ProcessId)..." -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch { }

# 2. Disable QuickEdit mode in Windows Console so mouse clicks do not freeze execution
try {
    $code = @"
    using System;
    using System.Runtime.InteropServices;
    public class ConsoleUtils {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr GetStdHandle(int nStdHandle);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
        public static void DisableQuickEdit() {
            try {
                IntPtr hStdin = GetStdHandle(-10);
                uint mode;
                if (GetConsoleMode(hStdin, out mode)) {
                    mode &= ~0x0040u; // disable ENABLE_QUICK_EDIT_MODE
                    mode |= 0x0080u;  // enable ENABLE_EXTENDED_FLAGS
                    SetConsoleMode(hStdin, mode);
                }
            } catch {}
        }
    }
"@
    Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    [ConsoleUtils]::DisableQuickEdit()
} catch { }

# 3. Non-interactive Git environment variables & clean stale index lock
$env:GIT_PAGER = "cat"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_LFS_SKIP_SMUDGE = "1"
$env:GIT_ASK_YESNO = "0"

Remove-GitIndexLock -Path $ProjectPath

# 4. Clean old log safely
try {
    if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction Stop }
} catch {
    Clear-Content -Path $LogFile -ErrorAction SilentlyContinue
}
Start-Transcript -Path $LogFile -Force

try {
    Set-Location -Path $ProjectPath

    Write-Host "Fetching from origin..." -ForegroundColor Cyan
    $null | git -c core.askpass= fetch origin main
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin main failed with exit code $LASTEXITCODE" }

    $LocalHash = (git rev-parse HEAD).Trim()
    $RemoteHash = (git rev-parse origin/main).Trim()

    if ($LocalHash -eq $RemoteHash) {
        Write-Host "No updates found on main branch. Exiting." -ForegroundColor Yellow
        node apps\ENG-Backend\scripts\log_update.js "NO_UPDATE" "No updates found on main branch" "$LocalHash" "$RemoteHash"
    } else {
        Write-Host "Update found ($LocalHash -> $RemoteHash)." -ForegroundColor Cyan

        # 5. CRITICAL: Stop dev server processes BEFORE resetting files so file locks are released!
        Write-Host "Stopping existing development server processes on ports 2005 and 3000..." -ForegroundColor Cyan
        
        # Kill previous dev window by title if running
        cmd.exe /c 'taskkill.exe /FI "WINDOWTITLE eq EngineerSystem Dev*" /T /F >nul 2>&1'

        $Ports = @(2005, 3000)
        foreach ($Port in $Ports) {
            $PIDs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
                    Select-Object -ExpandProperty OwningProcess -Unique | 
                    Where-Object { $_ -gt 0 -and $_ -ne $PID }
            if ($PIDs) {
                foreach ($PidValue in $PIDs) {
                    if (-not (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)) {
                        continue
                    }

                    # Trace up to find top shell window (cmd.exe / powershell.exe / WindowsTerminal)
                    $p = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $PidValue) -ErrorAction SilentlyContinue
                    $topShell = $null
                    while ($p -and $p.ProcessId -ne 0 -and $p.Name -notmatch 'explorer.exe|Code.exe|svchost.exe') {
                        if ($p.Name -match 'cmd.exe|powershell.exe|WindowsTerminal.exe') { 
                            $topShell = $p 
                        }
                        $p = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $p.ParentProcessId) -ErrorAction SilentlyContinue
                    }

                    if ($topShell -and $topShell.ProcessId -ne $PID) {
                        if (Get-Process -Id $topShell.ProcessId -ErrorAction SilentlyContinue) {
                            Write-Host "Killing dev window tree PID $($topShell.ProcessId) on port $Port..." -ForegroundColor Yellow
                            Stop-ProcessTreeSafely -TargetPid $topShell.ProcessId
                        }
                    } elseif (Get-Process -Id $PidValue -ErrorAction SilentlyContinue) {
                        Write-Host "Killing process tree PID $PidValue on port $Port..." -ForegroundColor Yellow
                        Stop-ProcessTreeSafely -TargetPid $PidValue
                    }
                }
            }
        }

        # Also terminate any lingering node / nodemon / concurrently processes from this project
        try {
            Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                (($_.Name -match "node|nodemon") -and ($_.CommandLine -match [regex]::Escape($ProjectPath) -or $_.CommandLine -match "EngineerSystem")) -or
                ($_.Name -match "cmd" -and $_.CommandLine -match "npm run dev")
            } | ForEach-Object {
                if ($_.ProcessId -ne $PID -and (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue)) {
                    Write-Host "Stopping dev process PID $($_.ProcessId) ($($_.Name))..." -ForegroundColor Yellow
                    Stop-ProcessTreeSafely -TargetPid $_.ProcessId
                }
            }
        } catch { }

        # Allow Windows to release open file handles
        Start-Sleep -Seconds 3

        # Clean any stale index lock right before reset
        Remove-GitIndexLock -Path $ProjectPath

        Write-Host "Resetting local repository to match origin/main..." -ForegroundColor Cyan

        # CRITICAL: Temporarily stop transcript to release file lock on update_progress_live.log.
        # Otherwise Git reset will fail with: "Unlink of file 'update_progress_live.log' failed. Should I try again? (y/n)"
        try { Stop-Transcript } catch { }

        # Pipe $null to Git to enforce non-interactive execution (never hangs waiting for console input)
        $null | git -c core.askpass= -c core.preloadindex=true reset --hard origin/main
        $resetExitCode = $LASTEXITCODE

        # Resume transcript logging
        try { Start-Transcript -Path $LogFile -Append -Force } catch { }

        if ($resetExitCode -ne 0) { throw "git reset --hard origin/main failed with exit code $resetExitCode" }

        # Update LocalHash after pull
        $NewLocalHash = (git rev-parse HEAD).Trim()

        $ConstFile = "apps\ENG-Frontend\src\constance\constance.js"
        if (Test-Path $ConstFile) {
            $ConstContent = Get-Content -Path $ConstFile -Raw
            
            # 1. Comment out all active exports of apiUrl
            $UpdatedContent = $ConstContent -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
            
            # 2. Uncomment the specific one for plbmp130
            $UpdatedContent = $UpdatedContent -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";', '$1export const apiUrl = "http://plbmp130:2005/";'
            
            if ($ConstContent -ne $UpdatedContent) {
                Write-Host "Modifying constance.js to use http://plbmp130:2005/..." -ForegroundColor Green
                Set-Content -Path $ConstFile -Value $UpdatedContent -Encoding UTF8
            } else {
                Write-Host "constance.js is already configured correctly for plbmp130." -ForegroundColor Green
            }
        } else {
            Write-Host "Could not find $ConstFile. Skipping file update." -ForegroundColor Yellow
        }

        Write-Host "Starting npm run dev in a new window..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k title EngineerSystem Dev && npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal

        Write-Host "Process completed successfully! Logging UPDATE_SUCCESS..." -ForegroundColor Green
        node apps\ENG-Backend\scripts\log_update.js "UPDATE_SUCCESS" "System updated and restarted successfully" "$LocalHash" "$NewLocalHash"
    }
} catch {
    $ErrorMsg = $_.Exception.Message
    Write-Host "An error occurred during execution:`n$ErrorMsg" -ForegroundColor Red
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "$ErrorMsg" "" ""
} finally {
    Write-Host "`nThis window will close in 10 seconds..." -ForegroundColor Magenta
    try { Stop-Transcript } catch { }
    Start-Sleep -Seconds 10
}
