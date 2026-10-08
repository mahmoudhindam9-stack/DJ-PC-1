@echo off
setlocal
cd /d "%~dp0"
title DJ Desktop Studio - Setup & Launcher

:: 1. Launch PowerShell setup engine if available
where powershell >nul 2>nul
if %errorlevel% equ 0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
    exit /b %errorlevel%
)

:: 2. Fallback if PowerShell is restricted
echo Starting DJ Desktop Studio...
if exist "%~dp0scripts\create-desktop-shortcut.vbs" (
    cscript //nologo "%~dp0scripts\create-desktop-shortcut.vbs"
)
if exist "%~dp0scripts\run-dj-desktop.bat" (
    start "" "%~dp0scripts\run-dj-desktop.bat"
) else (
    start "" http://localhost:3000
)
exit /b 0
