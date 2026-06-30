@echo off
setlocal
title Auto Update and Run
color 0A

set "ProjectPath=D:\00_system\EngineerSystem"

echo ==============================================
echo Changing directory to %ProjectPath%...
echo ==============================================
cd /d "%ProjectPath%" || (
    color 0C
    echo [ERROR] Could not find or access %ProjectPath%.
    goto :wait
)

echo.
echo ==============================================
echo Fetching from origin...
echo ==============================================
git fetch origin main

for /f %%i in ('git rev-parse HEAD 2^>nul') do set LocalHash=%%i
for /f %%i in ('git rev-parse origin/main 2^>nul') do set RemoteHash=%%i

if "%LocalHash%"=="" (
    color 0C
    echo [ERROR] Git command failed or not in a git repository.
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "Git command failed or not in a git repository"
    goto :wait
)

if "%LocalHash%"=="%RemoteHash%" (
    echo.
    echo [INFO] No updates found on main branch. Everything is up to date.
    node apps\ENG-Backend\scripts\log_update.js "NO_UPDATE" "No updates found on main branch" "%LocalHash%" "%RemoteHash%"
    goto :wait
)

echo.
echo ==============================================
echo Update found. Pulling latest code...
echo ==============================================
git pull origin main

echo.
echo ==============================================
echo Modifying constance.js...
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f='apps\ENG-Frontend\src\constance\constance.js'; if(Test-Path $f){ $c = Get-Content $f -Raw; $u = $c -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='; $u = $u -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*\"http://plbmp130:2005/\";', '$1export const apiUrl = \"http://plbmp130:2005/\";'; if($c -ne $u){ Set-Content $f -Value $u -Encoding UTF8; Write-Host '[SUCCESS] Modified constance.js to use plbmp130' -ForegroundColor Green } else { Write-Host '[INFO] constance.js is already configured' -ForegroundColor Cyan } } else { Write-Host '[WARNING] Could not find constance.js' -ForegroundColor Yellow }"

echo.
echo ==============================================
echo Stopping processes on ports 2005 and 3000...
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$Ports = @(2005, 3000); foreach ($Port in $Ports) { $Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($Process) { Write-Host 'Killing process PID' $Process 'on port' $Port -ForegroundColor Yellow; Stop-Process -Id $Process -Force -ErrorAction SilentlyContinue } }"

echo.
echo ==============================================
echo Starting npm run dev...
echo ==============================================
if exist startup.log del startup.log
start "EngineerSystem Dev" powershell.exe -NoExit -Command "npm run dev 2>&1 | Tee-Object -FilePath startup.log"

echo.
echo [INFO] Waiting 25 seconds to verify startup...
timeout /t 25 >nul

findstr /C:"ERR!" /C:"Failed to compile" /C:"Command failed" startup.log >nul
if %errorlevel% equ 0 (
    color 0C
    echo.
    echo ==============================================
    echo [ERROR] Startup failed after update!
    echo Rolling back to %LocalHash%...
    echo ==============================================
    
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$Ports = @(2005, 3000); foreach ($Port in $Ports) { $Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($Process) { Stop-Process -Id $Process -Force -ErrorAction SilentlyContinue } }"
    
    git reset --hard %LocalHash%
    npm install
    
    echo.
    echo Sending error email...
    node apps\ENG-Backend\scripts\send_error_email.js "Startup error detected. Rolled back to %LocalHash%."
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "Startup failed. Rolled back to %LocalHash%"
    
    echo.
    echo Restarting with old version...
    start "EngineerSystem Dev" cmd.exe /c "npm run dev"
    
    goto :wait
)

echo.
echo [SUCCESS] Process started successfully with no critical errors detected!
node apps\ENG-Backend\scripts\log_update.js "UPDATE_SUCCESS" "System updated and restarted successfully" "%LocalHash%" "%RemoteHash%"

:wait
echo.
echo ==============================================
echo This window will close in 10 seconds...
timeout /t 10
