// Utility to trigger client-side download of setup.bat, uninstall.bat and desktop scripts

// Pure ASCII and CRLF batch scripts that reliably invoke PowerShell setup engine
// and handle all edge cases on Windows systems.
export const SETUP_BAT_CONTENT = [
  '@echo off',
  'setlocal',
  'cd /d "%~dp0"',
  'title DJ Desktop Studio - Setup & Launcher',
  '',
  ':: 1. Launch robust PowerShell setup if available',
  'where powershell >nul 2>nul',
  'if %errorlevel% equ 0 (',
  '    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\setup.ps1"',
  '    exit /b %errorlevel%',
  ')',
  '',
  ':: 2. Safe CMD fallback if PowerShell is disabled',
  'echo Starting DJ Desktop Studio...',
  'if exist "%~dp0scripts\\create-desktop-shortcut.vbs" (',
  '    cscript //nologo "%~dp0scripts\\create-desktop-shortcut.vbs"',
  ')',
  'if exist "%~dp0scripts\\run-dj-desktop.bat" (',
  '    start "" "%~dp0scripts\\run-dj-desktop.bat"',
  ') else (',
  '    start "" http://localhost:3000',
  ')',
  'exit /b 0',
].join('\r\n');

export const UNINSTALL_BAT_CONTENT = [
  '@echo off',
  'setlocal',
  'cd /d "%~dp0"',
  'title DJ Desktop Studio - Uninstaller',
  '',
  'where powershell >nul 2>nul',
  'if %errorlevel% equ 0 (',
  '    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\uninstall.ps1"',
  '    exit /b %errorlevel%',
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
