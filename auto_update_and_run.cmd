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
    goto :wait
)

if "%LocalHash%"=="%RemoteHash%" (
    echo.
    echo [INFO] No updates found on main branch. Everything is up to date.
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
start "EngineerSystem Dev" cmd.exe /c "npm run dev"

echo.
echo [SUCCESS] Process completed successfully!

:wait
echo.
echo ==============================================
echo This window will close in 10 seconds...
timeout /t 10
