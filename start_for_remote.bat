@echo off
echo ============================================================
echo   Starting Eng_Sys for Remote Access
echo ============================================================
echo.

REM Set environment variable to bind to all network interfaces
set HOST=0.0.0.0
set PORT=3000

echo Starting Frontend on http://0.0.0.0:%PORT%
echo.
echo After startup, access from other machines at:
echo   http://YOUR_IP:3000
echo   Backend API: http://YOUR_IP:2005
echo.
echo Your IP address (run 'ipconfig' to find IPv4 Address)
echo ============================================================
echo.

cd /d "%~dp0"
npm run dev:frontend
