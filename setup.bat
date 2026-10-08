@echo off
setlocal
cd /d "%~dp0"
title DJ Desktop Studio - Install

where powershell.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo PowerShell is required to install DJ Desktop Studio.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\scripts\setup.ps1"
exit /b %errorlevel%
