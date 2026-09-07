$ErrorActionPreference = "Stop"
$ProjectPath = $PSScriptRoot
if (-not $ProjectPath) {
    $ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    if (-not $ProjectPath) { $ProjectPath = (Get-Location).Path }
}
$LogFile = "$ProjectPath\update_progress_live.log"

function Get-ProcessAncestors {
    param([int]$ProcessId)
    $ancestors = [System.Collections.Generic.HashSet[int]]::new()
    $curPid = $ProcessId
    while ($curPid -gt 0) {
        $ancestors.Add($curPid) | Out-Null
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $curPid" -ErrorAction SilentlyContinue
        if ($proc -and $proc.ParentProcessId -gt 0 -and $proc.ParentProcessId -ne $curPid) {
            $curPid = $proc.ParentProcessId
        } else {
            break
        }
    }
    return $ancestors
}

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
                    $_.Name -match "git" -and ($_.CommandLine -match [regex]::Escape($Path) -or $_.CommandLine -match "EngineerSystem")
                } | ForEach-Object {
                    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                }
                Start-Sleep -Milliseconds 500
            }
        }
        if (Test-Path $lockFile) {
            Write-Host "Warning: Stale $lockFile could not be removed automatically." -ForegroundColor Yellow
        }
    }
}

function Stop-ProcessTreeSafely {
    param(
        [int]$TargetPid,
        [System.Collections.Generic.HashSet[int]]$ProtectedPids = $null
    )
    if ($TargetPid -gt 0 -and $TargetPid -ne $PID) {
        if ($ProtectedPids -and $ProtectedPids.Contains($TargetPid)) {
            Write-Host "[SAFETY] Skipping termination of protected ancestor PID $TargetPid" -ForegroundColor Yellow
            return
        }
        if (Get-Process -Id $TargetPid -ErrorAction SilentlyContinue) {
            cmd.exe /c "taskkill.exe /PID $TargetPid /T /F >nul 2>&1"
        }
    }
}

function Stop-DevServers {
    param([string]$Path)
    Write-Host "Stopping existing development server processes on ports 2005 and 3000..." -ForegroundColor Cyan

    $myAncestors = Get-ProcessAncestors -ProcessId $PID

    # Kill previous dev window by title if running
    cmd.exe /c 'taskkill.exe /FI "WINDOWTITLE eq EngineerSystem Dev*" /T /F >nul 2>&1'

    $terminalHosts = 'explorer\.exe|code\.exe|svchost\.exe|windowsterminal\.exe|conhost\.exe'

    $Ports = @(2005, 3000)
    foreach ($Port in $Ports) {
        $PIDs = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | 
                Select-Object -ExpandProperty OwningProcess -Unique | 
                Where-Object { $_ -gt 0 -and $_ -ne $PID -and (-not $myAncestors.Contains($_)) }
        if ($PIDs) {
            foreach ($PidValue in $PIDs) {
                if (-not (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)) {
                    continue
                }

                # Inspect immediate parent to check if it is a dev launcher (cmd / npm / node)
                $p = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $PidValue) -ErrorAction SilentlyContinue
                $targetToKill = $PidValue

                if ($p -and $p.ParentProcessId -gt 0 -and (-not $myAncestors.Contains($p.ParentProcessId))) {
                    $parent = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $p.ParentProcessId) -ErrorAction SilentlyContinue
                    # Only kill parent if it's a dev runner process, never a terminal emulator host
                    if ($parent -and $parent.Name -notmatch $terminalHosts -and ($parent.CommandLine -match "npm|dev|runner\.js|nodemon")) {
                        $targetToKill = $parent.ProcessId
                    }
                }

                Write-Host "Stopping dev server process PID $targetToKill on port $Port..." -ForegroundColor Yellow
                Stop-ProcessTreeSafely -TargetPid $targetToKill -ProtectedPids $myAncestors
            }
        }
    }

    # Also terminate any lingering node / nodemon / concurrently processes from this project
    try {
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            (-not $myAncestors.Contains($_.ProcessId)) -and
            ((($_.Name -match "node|nodemon") -and ($_.CommandLine -match [regex]::Escape($Path) -or $_.CommandLine -match "EngineerSystem")) -or
            ($_.Name -match "cmd" -and $_.CommandLine -match "npm run dev"))
        } | ForEach-Object {
            if ($_.ProcessId -ne $PID -and (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue)) {
                Write-Host "Stopping dev process PID $($_.ProcessId) ($($_.Name))..." -ForegroundColor Yellow
                Stop-ProcessTreeSafely -TargetPid $_.ProcessId -ProtectedPids $myAncestors
            }
        }
    } catch { }

    # Allow Windows to release open file handles
    Start-Sleep -Seconds 3
}

function Test-DevServersRunning {
    $port2005 = Get-NetTCPConnection -LocalPort 2005 -State Listen -ErrorAction SilentlyContinue
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    return [bool]($port2005 -and $port3000)
}

function Wait-BackendHealthCheck {
    param([int]$MaxWaitSec = 45)
    Write-Host "Waiting for backend service to start (http://localhost:2005/api/health)..." -ForegroundColor Cyan
    $startTime = [Environment]::TickCount
    while (([Environment]::TickCount - $startTime) -lt ($MaxWaitSec * 1000)) {
        Start-Sleep -Seconds 3
        try {
            $res = Invoke-RestMethod -Uri "http://localhost:2005/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($res.status -eq "ok") {
                return $true
            }
        } catch { }
    }
    return $false
}

function Ensure-ConstanceConfig {
    param([string]$Path)
    $fixScript = Join-Path $Path "scripts\fix_constance_prod.ps1"
    $constFile = Join-Path $Path "apps\ENG-Frontend\src\constance\constance.js"
    if (Test-Path $fixScript) {
        & $fixScript -ConstancePath $constFile
    } else {
        if (-not (Test-Path $constFile)) {
            Write-Host "Could not find $constFile. Skipping." -ForegroundColor Yellow
            return
        }
        $raw = [System.IO.File]::ReadAllText((Resolve-Path $constFile), [System.Text.Encoding]::UTF8)
        if ($raw.Length -gt 0 -and [int]$raw[0] -eq 65279) { $raw = $raw.Substring(1) }
        $updated = $raw -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
        if ($updated -match '(?m)^\s*//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";') {
            $updated = $updated -replace '(?m)^\s*//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";', 'export const apiUrl = "http://plbmp130:2005/";'
        } else {
            $updated = $updated -replace '(?m)(export const server\s*=)', "export const apiUrl = ""http://plbmp130:2005/"";`n`n`$1"
        }
        $updated = $updated.Replace("`r`n", "`n")
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText((Resolve-Path $constFile), $updated, $utf8NoBom)
    }
}

function Invoke-UpdateLogger {
    param(
        [string]$ActionType,
        [string]$Description,
        [string]$LocalHash = "",
        [string]$RemoteHash = ""
    )
    try {
        $safeDesc = ($Description -replace '[\r\n]+', ' ' -replace '"', '\"').Trim()
        $logScript = Join-Path $ProjectPath "apps\ENG-Backend\scripts\log_update.js"
        if (Test-Path $logScript) {
            node $logScript $ActionType "$safeDesc" "$LocalHash" "$RemoteHash"
        }
    } catch {
        Write-Host "Notice: Could not write update log: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 1. Kill any existing stuck auto_update_and_run.ps1 processes (excluding current process and its parent caller)
try {
    $MyProc = Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction SilentlyContinue
    $MyParentPid = if ($MyProc) { $MyProc.ParentProcessId } else { 0 }
    $Now = Get-Date

    $StuckProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { 
        $_.Name -match "powershell" -and 
        $_.CommandLine -match "auto_update_and_run\.ps1" -and 
        $_.ProcessId -ne $PID -and
        $_.ProcessId -ne $MyParentPid
    }
    foreach ($proc in $StuckProcesses) {
        $pObj = Get-Process -Id $proc.ProcessId -ErrorAction SilentlyContinue
        if ($pObj -and ($Now - $pObj.StartTime).TotalSeconds -gt 15) {
            Write-Host "Killing previous stuck update process PID $($proc.ProcessId)..." -ForegroundColor Yellow
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
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
    if (-not ([System.Management.Automation.PSTypeName]'ConsoleUtils').Type) {
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
    }
    [ConsoleUtils]::DisableQuickEdit()
} catch { }

# 3. Non-interactive Git environment variables & clean stale index lock
$env:GIT_PAGER = "cat"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_LFS_SKIP_SMUDGE = "1"
$env:GIT_ASK_YESNO = "0"
$env:GIT_SSH_COMMAND = "ssh -o BatchMode=yes -o ConnectTimeout=15"

Remove-GitIndexLock -Path $ProjectPath

# 4. Clean old log safely & start transcript
try { Stop-Transcript -ErrorAction SilentlyContinue } catch { }
try {
    if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction Stop }
} catch {
    Clear-Content -Path $LogFile -ErrorAction SilentlyContinue
}
try {
    Start-Transcript -Path $LogFile -Force -ErrorAction Stop
} catch {
    Write-Host "Warning: Could not start transcript: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
    Set-Location -Path $ProjectPath

    # 5. Ensure working directory is on 'main' branch
    Write-Host "Checking current branch..." -ForegroundColor Cyan
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($currentBranch -ne "main") {
        Write-Host "Currently on branch '$currentBranch'. Forcing checkout to 'main'..." -ForegroundColor Yellow
        $null | git checkout -f main
        if ($LASTEXITCODE -ne 0) { throw "git checkout -f main failed with exit code $LASTEXITCODE" }
    }

    # Fetch latest from origin main with graceful network fallback
    $fetchSucceeded = $true
    try {
        Write-Host "Fetching from origin main..." -ForegroundColor Cyan
        $null | git -c core.askpass= -c connect.timeout=15 fetch origin main
        if ($LASTEXITCODE -ne 0) {
            $fetchSucceeded = $false
            Write-Host "Warning: git fetch origin main returned exit code $LASTEXITCODE. Remote may be unreachable." -ForegroundColor Yellow
        }
    } catch {
        $fetchSucceeded = $false
        Write-Host "Warning: git fetch origin main failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    $LocalHash = (git rev-parse HEAD).Trim()
    $RemoteHash = ""
    if ($fetchSucceeded) {
        $RemoteHash = (git rev-parse origin/main 2>$null).Trim()
    }

    if ($fetchSucceeded -and $RemoteHash -and ($LocalHash -ne $RemoteHash)) {
        Write-Host "Update found ($LocalHash -> $RemoteHash)." -ForegroundColor Cyan

        # 6. Stop dev server processes BEFORE resetting files so file locks are released
        Stop-DevServers -Path $ProjectPath

        # Clean any stale index lock right before reset
        Remove-GitIndexLock -Path $ProjectPath

        Write-Host "Resetting local repository to match origin/main..." -ForegroundColor Cyan

        # Safely clean untracked files/folders while strictly preserving .env files and active log
        $null | git clean -fd -e .env -e *.env -e **/.env* -e update_progress_live.log

        # Temporarily stop transcript to release file lock on update_progress_live.log
        try { Stop-Transcript -ErrorAction SilentlyContinue } catch { }

        # Pipe $null to Git to enforce non-interactive execution
        $null | git -c core.askpass= -c core.preloadindex=true reset --hard origin/main
        $resetExitCode = $LASTEXITCODE

        # Resume transcript logging
        try { Start-Transcript -Path $LogFile -Append -Force -ErrorAction Stop } catch { }

        if ($resetExitCode -ne 0) { throw "git reset --hard origin/main failed with exit code $resetExitCode" }

        # Update LocalHash after pull
        $NewLocalHash = (git rev-parse HEAD).Trim()

        # Check if package.json dependencies changed
        $pkgDiff = git diff --name-only $LocalHash $NewLocalHash -- "*package*.json"
        if ($pkgDiff) {
            Write-Host "Dependencies modified in update. Running npm install..." -ForegroundColor Cyan
            npm install --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed with exit code $LASTEXITCODE"
            }
        }

        # Guarantee constance.js configuration
        Ensure-ConstanceConfig -Path $ProjectPath

        Write-Host "Starting npm run dev in a new window..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k title EngineerSystem Dev && npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal

        # 7. Health check: Wait for backend service to respond
        $healthOk = Wait-BackendHealthCheck -MaxWaitSec 45
        if ($healthOk) {
            Write-Host "Backend health check passed! System updated and restarted successfully." -ForegroundColor Green
            Invoke-UpdateLogger "UPDATE_SUCCESS" "System updated and restarted successfully (Health OK)" "$LocalHash" "$NewLocalHash"
        } else {
            Write-Host "Notice: Backend process started, but health check is taking longer than expected." -ForegroundColor Yellow
            Invoke-UpdateLogger "UPDATE_WARNING" "System updated and restarted (Health check pending/timed out)" "$LocalHash" "$NewLocalHash"
        }
    } else {
        if ($fetchSucceeded) {
            Write-Host "No updates found on main branch ($LocalHash)." -ForegroundColor Cyan
        } else {
            Write-Host "Operating in offline/local mode. Checking local dev server status..." -ForegroundColor Yellow
        }

        # Guarantee constance.js configuration even if no new git commit
        Ensure-ConstanceConfig -Path $ProjectPath

        # Check if dev servers are running
        $isDevRunning = Test-DevServersRunning
        if (-not $isDevRunning) {
            Write-Host "Dev server is DOWN (ports 2005/3000 not listening). Starting dev server..." -ForegroundColor Yellow
            Start-Process -FilePath "cmd.exe" -ArgumentList "/k title EngineerSystem Dev && npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal
            
            $healthOk = Wait-BackendHealthCheck -MaxWaitSec 30
            $logAction = if ($fetchSucceeded) { "RESTART" } else { "OFFLINE_START" }
            $logDesc = if ($healthOk) { "Dev server started successfully" } else { "Dev server started (Health check pending)" }
            Invoke-UpdateLogger "$logAction" "$logDesc" "$LocalHash" "$RemoteHash"
        } else {
            Write-Host "Dev servers are running normally on ports 2005 and 3000. System is ready." -ForegroundColor Green
            if ($fetchSucceeded) {
                Invoke-UpdateLogger "NO_UPDATE" "No updates found on main branch (servers healthy)" "$LocalHash" "$RemoteHash"
            }
        }
    }
} catch {
    $ErrorMsg = $_.Exception.Message
    Write-Host "An error occurred during execution:`n$ErrorMsg" -ForegroundColor Red
    Invoke-UpdateLogger "ERROR" "$ErrorMsg" "$LocalHash" "$RemoteHash"
} finally {
    Write-Host "`nThis window will close in 10 seconds..." -ForegroundColor Magenta
    try { Stop-Transcript -ErrorAction SilentlyContinue } catch { }
    Start-Sleep -Seconds 10
}
