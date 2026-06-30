@echo off
setlocal EnableDelayedExpansion
title Auto Update and Run
color 0A

set "ProjectPath=D:\00_system\EngineerSystem"
set "HealthCheckUrl=http://localhost:2005/api/health"
set "HealthCheckTimeout=60"
set "HealthCheckInterval=5"

echo ==============================================
echo Changing directory to %ProjectPath%...
echo ==============================================
cd /d "%ProjectPath%" || (
    color 0C
    echo [ERROR] Could not find or access %ProjectPath%.
    goto :wait
)

REM ============================================
REM Step 1: Save current commit hash for rollback
REM ============================================
for /f %%i in ('git rev-parse HEAD 2^>nul') do set PreviousHash=%%i
if "%PreviousHash%"=="" (
    color 0C
    echo [ERROR] Git command failed or not in a git repository.
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "Git command failed - not in a git repository"
    goto :wait
)
echo [INFO] Current version: %PreviousHash%

REM ============================================
REM Step 2: git fetch --all
REM ============================================
echo.
echo ==============================================
echo Fetching all remotes...
echo ==============================================
git fetch --all
if !ERRORLEVEL! NEQ 0 (
    color 0C
    echo [ERROR] git fetch --all failed.
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "git fetch --all failed" "%PreviousHash%" ""
    goto :wait
)

for /f %%i in ('git rev-parse origin/main 2^>nul') do set RemoteHash=%%i

if "%RemoteHash%"=="" (
    color 0C
    echo [ERROR] Could not resolve origin/main.
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "Could not resolve origin/main" "%PreviousHash%" ""
    goto :wait
)

REM ============================================
REM Step 3: Check if update is needed
REM ============================================
if "%PreviousHash%"=="%RemoteHash%" (
    echo.
    echo [INFO] No updates found on main branch. Everything is up to date.
    node apps\ENG-Backend\scripts\log_update.js "NO_UPDATE" "No updates found on main branch" "%PreviousHash%" "%RemoteHash%"
    goto :wait
)

echo.
echo ==============================================
echo Update found! Remote: %RemoteHash%
echo ==============================================

REM ============================================
REM Step 4: git pull origin main (server version wins on conflict)
REM ============================================
echo.
echo ==============================================
echo Pulling latest code from origin/main...
echo ==============================================
git pull origin main
if !ERRORLEVEL! NEQ 0 (
    echo.
    color 0E
    echo [WARNING] git pull failed (likely conflict). Forcing server version...
    echo ==============================================
    git reset --hard origin/main
    if !ERRORLEVEL! NEQ 0 (
        color 0C
        echo [ERROR] git reset --hard origin/main also failed.
        node apps\ENG-Backend\scripts\log_update.js "ERROR" "git pull and reset --hard both failed" "%PreviousHash%" "%RemoteHash%"
        goto :wait
    )
    echo [SUCCESS] Forced reset to origin/main.
)

REM Update LocalHash after pull/reset
for /f %%i in ('git rev-parse HEAD 2^>nul') do set LocalHash=%%i

REM ============================================
REM Step 5: Modify constance.js for production server
REM ============================================
echo.
echo ==============================================
echo Modifying constance.js...
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='apps\ENG-Frontend\src\constance\constance.js'; if(Test-Path $f){ $c = Get-Content $f -Raw; $u = $c -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='; $u = $u -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*\"http://plbmp130:2005/\";', '$1export const apiUrl = \"http://plbmp130:2005/\";'; if($c -ne $u){ Set-Content $f -Value $u -Encoding UTF8; Write-Host '[SUCCESS] Modified constance.js to use plbmp130' -ForegroundColor Green } else { Write-Host '[INFO] constance.js is already configured' -ForegroundColor Cyan } } else { Write-Host '[WARNING] Could not find constance.js' -ForegroundColor Yellow }"

REM ============================================
REM Step 6: Stop existing processes on ports 2005 and 3000
REM ============================================
echo.
echo ==============================================
echo Stopping processes on ports 2005 and 3000...
echo ==============================================
taskkill /FI "WINDOWTITLE eq EngineerSystem Dev*" /T /F >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$Ports = @(2005, 3000); foreach ($Port in $Ports) { $PIDs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($Id in $PIDs) { $p = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $Id) -ErrorAction SilentlyContinue; $topShell = $null; while ($p -and $p.ProcessId -ne 0 -and $p.Name -notmatch 'explorer.exe|Code.exe|svchost.exe') { if ($p.Name -match 'cmd.exe|powershell.exe|WindowsTerminal.exe') { $topShell = $p }; $p = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $p.ParentProcessId) -ErrorAction SilentlyContinue }; if ($topShell) { Write-Host ('Killing old window PID ' + $topShell.ProcessId + ' on port ' + $Port) -ForegroundColor Yellow; taskkill /PID $topShell.ProcessId /T /F 2>&1 | Out-Null } elseif ($Id) { Write-Host ('Killing process tree PID ' + $Id + ' on port ' + $Port) -ForegroundColor Yellow; taskkill /PID $Id /T /F 2>&1 | Out-Null } } }"

REM ============================================
REM Step 7: Start npm run dev
REM ============================================
echo.
echo ==============================================
echo Starting npm run dev...
echo ==============================================
if exist startup.log del startup.log
start "EngineerSystem Dev" cmd.exe /k "npm run dev"

REM ============================================
REM Step 8: Health check — wait for server to respond
REM ============================================
echo.
echo ==============================================
echo Waiting for server to start (max %HealthCheckTimeout%s)...
echo ==============================================

set /a "MaxAttempts=%HealthCheckTimeout% / %HealthCheckInterval%"
set Attempt=0
set ServerReady=0

:healthloop
set /a Attempt+=1
if %Attempt% GTR %MaxAttempts% goto :healthdone

timeout /t %HealthCheckInterval% /nobreak >nul

REM Check if port 2005 is listening
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%HealthCheckUrl%' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; if($r.StatusCode -eq 200){ exit 0 } else { exit 1 } } catch { exit 1 }"
if !ERRORLEVEL! EQU 0 (
    set ServerReady=1
    goto :healthdone
)

echo [INFO] Attempt %Attempt%/%MaxAttempts% - Server not ready yet...
goto :healthloop

:healthdone
if %ServerReady% EQU 1 (
    color 0A
    echo.
    echo [SUCCESS] Server is running! Update completed successfully.
    node apps\ENG-Backend\scripts\log_update.js "UPDATE_SUCCESS" "System updated and restarted successfully" "%PreviousHash%" "%LocalHash%"
    goto :wait
)

REM ============================================
REM Step 9: Server failed to start — ROLLBACK
REM ============================================
color 0C
echo.
echo ==============================================
echo [ERROR] Server failed to start after %HealthCheckTimeout%s!
echo ==============================================
echo Rolling back to previous version: %PreviousHash%...

REM Kill the failed process
taskkill /FI "WINDOWTITLE eq EngineerSystem Dev*" /T /F >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$Ports = @(2005, 3000); foreach ($Port in $Ports) { $PIDs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($Id in $PIDs) { taskkill /PID $Id /T /F 2>&1 | Out-Null } }"

REM Reset to previous version
git reset --hard %PreviousHash%
if !ERRORLEVEL! NEQ 0 (
    echo [CRITICAL] git reset --hard %PreviousHash% FAILED! Manual intervention required.
    node apps\ENG-Backend\scripts\log_update.js "CRITICAL" "Rollback to %PreviousHash% failed after server start failure" "%PreviousHash%" "%LocalHash%"
    node apps\ENG-Backend\scripts\send_error_email.js "CRITICAL: Rollback failed. Server is DOWN. Previous: %PreviousHash%, Attempted: %LocalHash%"
    goto :wait
)

echo [INFO] Rolled back to %PreviousHash%. Re-applying constance.js...

REM Re-apply constance.js for the rolled-back version
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='apps\ENG-Frontend\src\constance\constance.js'; if(Test-Path $f){ $c = Get-Content $f -Raw; $u = $c -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='; $u = $u -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*\"http://plbmp130:2005/\";', '$1export const apiUrl = \"http://plbmp130:2005/\";'; if($c -ne $u){ Set-Content $f -Value $u -Encoding UTF8; Write-Host '[SUCCESS] Modified constance.js to use plbmp130' -ForegroundColor Green } else { Write-Host '[INFO] constance.js is already configured' -ForegroundColor Cyan } } else { Write-Host '[WARNING] Could not find constance.js' -ForegroundColor Yellow }"

REM Start the previous version
echo.
echo ==============================================
echo Starting previous version...
echo ==============================================
start "EngineerSystem Dev" cmd.exe /k "npm run dev"

REM Wait briefly to see if old version starts
set Attempt2=0
set OldServerReady=0
set /a "MaxAttempts2=%MaxAttempts%"

:healthloop2
set /a Attempt2+=1
if %Attempt2% GTR %MaxAttempts2% goto :healthdone2

timeout /t %HealthCheckInterval% /nobreak >nul

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%HealthCheckUrl%' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; if($r.StatusCode -eq 200){ exit 0 } else { exit 1 } } catch { exit 1 }"
if !ERRORLEVEL! EQU 0 (
    set OldServerReady=1
    goto :healthdone2
)
echo [INFO] Rollback attempt %Attempt2%/%MaxAttempts2% - Server not ready yet...
goto :healthloop2

:healthdone2
if %OldServerReady% EQU 1 (
    color 0E
    echo.
    echo [ROLLBACK SUCCESS] Previous version %PreviousHash% is now running.
    echo [WARNING] New version %LocalHash% FAILED to start and was rolled back.
    node apps\ENG-Backend\scripts\log_update.js "ROLLBACK_SUCCESS" "New version failed. Rolled back to previous version." "%PreviousHash%" "%LocalHash%"
    node apps\ENG-Backend\scripts\send_error_email.js "Update rolled back. New version %LocalHash% failed to start. Running previous version %PreviousHash%."
) else (
    color 0C
    echo.
    echo [CRITICAL] Both new and previous versions failed to start!
    echo Manual intervention is required.
    node apps\ENG-Backend\scripts\log_update.js "CRITICAL" "Both new and previous versions failed to start" "%PreviousHash%" "%LocalHash%"
    node apps\ENG-Backend\scripts\send_error_email.js "CRITICAL: Both versions failed. New: %LocalHash%, Previous: %PreviousHash%. Server is DOWN."
)

:wait
echo.
echo ==============================================
echo This window will close in 10 seconds...
echo ==============================================
timeout /t 10
