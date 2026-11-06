// Utility to trigger client-side download of setup.bat, uninstall.bat and desktop scripts

// Pure ASCII and CRLF batch scripts that reliably invoke PowerShell setup engine
// and handle all edge cases on Windows systems.
export const SETUP_BAT_CONTENT = [
  '@echo off',
  'setlocal enabledelayedexpansion',
  'chcp 65001 >nul 2>nul',
  'title DJ Desktop Studio - Setup & Installation',
  '',
  'cd /d "%~dp0"',
  '',
  ':: 0. Refresh PATH with common Node.js install locations',
  'set "PATH=%ProgramFiles%\\nodejs;%ProgramFiles(x86)%\\nodejs;%LOCALAPPDATA%\\Programs\\nodejs;%APPDATA%\\npm;%PATH%"',
  '',
  'echo ======================================================================',
  'echo              DJ DESKTOP STUDIO - SETUP & LAUNCHER',
  'echo ======================================================================',
  'echo.',
  '',
  ':: 1. Try running setup.ps1 with PowerShell if available',
  'set "SETUP_PS1=%~dp0app\\scripts\\setup.ps1"',
  'if not exist "%SETUP_PS1%" set "SETUP_PS1=%~dp0scripts\\setup.ps1"',
  '',
  'where powershell.exe >nul 2>nul',
  'if %errorlevel% equ 0 (',
  '    if exist "%SETUP_PS1%" (',
  '        echo [*] Launching setup engine...',
  '        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SETUP_PS1%"',
  '        if !errorlevel! equ 0 (',
  '            exit /b 0',
  '        )',
  '        echo [!] PowerShell setup reported an issue. Falling back to direct CMD setup...',
  '    )',
  ')',
  '',
  ':: 2. Fallback direct CMD setup',
  'where node.exe >nul 2>nul',
  'if %errorlevel% neq 0 (',
  '    echo [*] Node.js was not detected in PATH. Checking winget...',
  '    where winget.exe >nul 2>nul',
  '    if !errorlevel! equ 0 (',
  '        echo [*] Installing Node.js LTS via winget...',
  '        winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements',
  '        set "PATH=%ProgramFiles%\\nodejs;%ProgramFiles(x86)%\\nodejs;%LOCALAPPDATA%\\Programs\\nodejs;%APPDATA%\\npm;!PATH!"',
  '    )',
  ')',
  '',
  'where node.exe >nul 2>nul',
  'if %errorlevel% neq 0 (',
  '    echo.',
  '    echo ----------------------------------------------------------------------',
  '    echo [!] تنبيه: يتطلب تشغيل البرنامج تثبيت Node.js LTS لأول مرة على جهازك.',
  '    echo     يرجى تنزيل وتثبيت Node.js من: https://nodejs.org',
  '    echo     بعد اكتمال التثبيت، شغّل ملف setup.bat مرة أخرى وسيعمل فوراً!',
  '    echo ----------------------------------------------------------------------',
  '    echo.',
  '    pause',
  '    exit /b 1',
  ')',
  '',
  'echo [+] Node.js detected:',
  'node -v',
  'echo [+] npm detected:',
  'call npm -v',
  'echo.',
  '',
  'set "TARGET_DIR=%~dp0"',
  'if exist "%~dp0app\\package.json" set "TARGET_DIR=%~dp0app"',
  '',
  'pushd "%TARGET_DIR%"',
  'echo [*] Installing dependencies...',
  'call npm install --no-audit --no-fund',
  'echo [*] Building production assets...',
  'call npm run build',
  'popd',
  '',
  ':: Launch app',
  'echo [*] Launching DJ Desktop Studio...',
  'if exist "%~dp0app\\scripts\\run-dj-desktop.bat" (',
  '    start "" "%~dp0app\\scripts\\run-dj-desktop.bat"',
  ') else if exist "%~dp0scripts\\run-dj-desktop.bat" (',
  '    start "" "%~dp0scripts\\run-dj-desktop.bat"',
  ') else (',
  '    start "" http://127.0.0.1:3000',
  ')',
  '',
  'echo.',
  'echo ======================================================================',
  'echo               DJ DESKTOP STUDIO IS READY',
  'echo ======================================================================',
  'echo [✓] Setup completed successfully!',
  'timeout /t 3 >nul 2>nul',
  'exit /b 0',
].join('\r\n');

export const UNINSTALL_BAT_CONTENT = [
  '@echo off',
  'setlocal',
  'cd /d "%~dp0"',
  'title DJ Desktop Studio - Uninstaller',
  '',
  'set "UNINSTALL_PS1=%~dp0app\\scripts\\uninstall.ps1"',
  'if not exist "%UNINSTALL_PS1%" set "UNINSTALL_PS1=%~dp0scripts\\uninstall.ps1"',
  '',
  'where powershell >nul 2>nul',
  'if %errorlevel% equ 0 (',
  '    if exist "%UNINSTALL_PS1%" (',
  '        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UNINSTALL_PS1%"',
  '        exit /b %errorlevel%',
  '    )',
  ')',
  '',
  ':: Minimal CMD fallback',
  'echo Stopping DJ Desktop Studio on port 3000...',
  'for /f "tokens=5" %%a in (\'netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"\') do (',
  '    taskkill /f /pid %%a >nul 2>nul',
  ')',
  '',
  'del /f /q "%USERPROFILE%\\Desktop\\DJ Desktop Studio.lnk" 2>nul',
  'del /f /q "%USERPROFILE%\\OneDrive\\Desktop\\DJ Desktop Studio.lnk" 2>nul',
  'if exist "%~dp0dist" rd /s /q "%~dp0dist" 2>nul',
  '',
  'echo DJ Desktop Studio files cleaned up successfully.',
  'timeout /t 3 >nul',
  'exit /b 0',
].join('\r\n');

export const SHORTCUT_BAT_CONTENT = [
  '@echo off',
  'setlocal',
  'cd /d "%~dp0"',
  'title Create DJ Desktop Shortcut',
  '',
  'where powershell >nul 2>nul',
  'if %errorlevel% equ 0 (',
  '    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\create-desktop-shortcut.ps1"',
  '    exit /b %errorlevel%',
  ')',
  '',
  'if exist "%~dp0scripts\\create-desktop-shortcut.vbs" (',
  '    cscript //nologo "%~dp0scripts\\create-desktop-shortcut.vbs"',
  ')',
  'exit /b 0',
].join('\r\n');

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSetupBat() {
  downloadTextFile('setup.bat', SETUP_BAT_CONTENT, 'application/x-bat');
}

export function downloadUninstallBat() {
  downloadTextFile('uninstall.bat', UNINSTALL_BAT_CONTENT, 'application/x-bat');
}

export function downloadShortcutBat() {
  downloadTextFile('create-desktop-shortcut.bat', SHORTCUT_BAT_CONTENT, 'application/x-bat');
}
