@echo off
setlocal
cd /d "%~dp0"
title DJ Desktop Studio - Uninstall

where powershell.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo PowerShell is required to uninstall DJ Desktop Studio.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\scripts\uninstall.ps1"
exit /b %errorlevel%
