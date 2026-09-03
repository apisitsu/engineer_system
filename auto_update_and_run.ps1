$ErrorActionPreference = "Stop"
$ProjectPath = $PSScriptRoot
$LogFile = "$ProjectPath\update_progress_live.log"

# 1. Kill any existing stuck auto_update_and_run.ps1 processes (except this one)
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

if (Test-Path "$ProjectPath\.git\index.lock") {
    Write-Host "Removing stale .git\index.lock..." -ForegroundColor Yellow
    Remove-Item "$ProjectPath\.git\index.lock" -Force -ErrorAction SilentlyContinue
}

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
    git fetch origin main
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
        $Ports = @(2005, 3000)
        foreach ($Port in $Ports) {
            $PIDs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
            if ($PIDs) {
                foreach ($PidValue in $PIDs) {
                    Write-Host "Killing process with PID $PidValue on port $Port" -ForegroundColor Yellow
                    Stop-Process -Id $PidValue -Force -ErrorAction SilentlyContinue
                }
            }
        }
        # Allow Windows to release open file handles
        Start-Sleep -Seconds 2

        Write-Host "Resetting local repository to match origin/main..." -ForegroundColor Cyan
        git reset --hard origin/main
        if ($LASTEXITCODE -ne 0) { throw "git reset --hard origin/main failed with exit code $LASTEXITCODE" }

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
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal

        Write-Host "Process completed successfully! Logging UPDATE_SUCCESS..." -ForegroundColor Green
        node apps\ENG-Backend\scripts\log_update.js "UPDATE_SUCCESS" "System updated and restarted successfully" "$LocalHash" "$NewLocalHash"
    }
} catch {
    $ErrorMsg = $_.Exception.Message
    Write-Host "An error occurred during execution:`n$ErrorMsg" -ForegroundColor Red
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "$ErrorMsg" "" ""
} finally {
    Write-Host "`nThis window will close in 10 seconds..." -ForegroundColor Magenta
    Stop-Transcript
    Start-Sleep -Seconds 10
}

