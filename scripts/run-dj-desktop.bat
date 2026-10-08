@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title DJ Desktop Studio Launcher
cd /d "%~dp0\.."
set "APP_DIR=%CD%"
set "SCRIPTS_DIR=%APP_DIR%\scripts"
set "PORT=3000"

:: 1. Check if server is already listening on port 3000
set "SERVER_RUNNING=0"
for /f "tokens=*" %%a in ('netstat -ano ^| findstr /R ":3000.*LISTENING"') do (
    set "SERVER_RUNNING=1"
)

:: 2. If server is not active, start the background server
if "!SERVER_RUNNING!"=="0" (
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        if exist "%SCRIPTS_DIR%\server.js" (
            start /b "" node "%SCRIPTS_DIR%\server.js" 3000
        ) else if exist "dist" (
            start /b "" cmd /c "npx vite preview --port 3000 --host 127.0.0.1"
        ) else (
            start /b "" cmd /c "npx vite --port 3000 --host 127.0.0.1"
        )
    ) else (
        where python >nul 2>nul
        if %errorlevel% equ 0 (
            if exist "dist" (
                start /b "" python -m http.server 3000 --directory "dist"
            ) else (
                start /b "" python -m http.server 3000
            )
        ) else (
            if exist "%SCRIPTS_DIR%\server.ps1" (
                start /b "" powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\server.ps1" -Port 3000
            )
        )
    )
    :: Non-blocking short wait for socket initialization
    ping 127.0.0.1 -n 2 >nul
)

:: 3. Launch application window (Dedicated App Mode without browser chrome)
set "APP_URL=http://localhost:3000"

:: Test Microsoft Edge in App Mode
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    start "" msedge --app=%APP_URL%
    exit /b 0
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL%
    exit /b 0
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL%
    exit /b 0
)

:: Test Google Chrome in App Mode
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    start "" chrome --app=%APP_URL%
    exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%APP_URL%
    exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%APP_URL%
    exit /b 0
)

:: Fallback to default browser
start %APP_URL%
exit /b 0
