@echo off
echo ============================================================
echo   Opening Firewall Ports for Eng_Sys
echo ============================================================
echo.
echo This script requires Administrator privileges.
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Adding firewall rules...
echo.

:: Add firewall rules
netsh advfirewall firewall add rule name="Eng_Sys Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Eng_Sys Backend" dir=in action=allow protocol=TCP localport=2005

echo.
echo ============================================================
echo   Firewall rules added successfully!
echo ============================================================
echo.
echo You can now access Eng_Sys from other machines at:
echo   Frontend: http://YOUR_IP:3000
echo   Backend:  http://YOUR_IP:2005
echo.
echo Your IP: 10.121.34.176
echo.
pause
