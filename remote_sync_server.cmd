@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title EngineerSystem - Sync from Server (plbmp130)

echo ================================================================================
echo   EngineerSystem - Remote Server Sync & Data Puller
echo ================================================================================
echo Connecting to server and synchronizing data...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\remote_sync_server.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Remote sync exited with error code %EXIT_CODE%.
    echo Please review the messages above.
    echo.
    pause
)

exit /b %EXIT_CODE%
