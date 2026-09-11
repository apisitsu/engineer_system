@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title EngineerSystem Auto Update
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto_update_and_run.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
