@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title EngineerSystem - 1-Click Automated Setup

echo ================================================================================
echo   EngineerSystem Automated Machine Setup
echo ================================================================================
echo Initializing setup script...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_machine.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Setup script exited with error code %EXIT_CODE%.
    echo Please review the messages above.
    echo.
    pause
)

exit /b %EXIT_CODE%
