@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
title DJ Desktop Studio - Setup & Installation

cd /d "%~dp0"

:: 0. Refresh PATH with common Node.js install locations
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"

echo ======================================================================
echo              DJ DESKTOP STUDIO - SETUP & LAUNCHER
echo ======================================================================
echo.

:: 1. Try running setup.ps1 with PowerShell if available
set "SETUP_PS1=%~dp0app\scripts\setup.ps1"
if not exist "%SETUP_PS1%" set "SETUP_PS1=%~dp0scripts\setup.ps1"

where powershell.exe >nul 2>nul
if %errorlevel% equ 0 (
    if exist "%SETUP_PS1%" (
        echo [*] Launching setup engine...
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SETUP_PS1%"
        if !errorlevel! equ 0 (
            exit /b 0
        )
        echo [!] PowerShell setup reported an issue. Falling back to direct CMD setup...
    )
)

:: 2. Fallback direct CMD setup
where node.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Node.js was not detected in PATH. Checking winget...
    where winget.exe >nul 2>nul
    if !errorlevel! equ 0 (
        echo [*] Installing Node.js LTS via winget...
        winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements
        set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;!PATH!"
    )
)

where node.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ----------------------------------------------------------------------
    echo [!] تنبيه: يتطلب تشغيل البرنامج تثبيت Node.js LTS لأول مرة على جهازك.
    echo     يرجى تنزيل وتثبيت Node.js من: https://nodejs.org
    echo     بعد اكتمال التثبيت، شغّل ملف setup.bat مرة أخرى وسيعمل فوراً!
    echo ----------------------------------------------------------------------
    echo.
    pause
    exit /b 1
)

echo [+] Node.js detected:
node -v
echo [+] npm detected:
call npm -v
echo.

set "TARGET_DIR=%~dp0"
if exist "%~dp0app\package.json" set "TARGET_DIR=%~dp0app"

pushd "%TARGET_DIR%"
echo [*] Installing dependencies...
call npm install --no-audit --no-fund
echo [*] Building production assets...
call npm run build
popd

:: Launch app
echo [*] Launching DJ Desktop Studio...
if exist "%~dp0app\scripts\run-dj-desktop.bat" (
    start "" "%~dp0app\scripts\run-dj-desktop.bat"
) else if exist "%~dp0scripts\run-dj-desktop.bat" (
    start "" "%~dp0scripts\run-dj-desktop.bat"
) else (
    start "" http://127.0.0.1:3000
)

echo.
echo ======================================================================
echo               DJ DESKTOP STUDIO IS READY
echo ======================================================================
echo [✓] Setup completed successfully!
timeout /t 3 >nul 2>nul
exit /b 0
