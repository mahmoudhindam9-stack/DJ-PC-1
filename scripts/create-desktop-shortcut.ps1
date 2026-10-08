# DJ Desktop Studio - PowerShell Desktop Shortcut Creator
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir

# 1. Resolve Desktop Directory accurately across all Windows languages and OneDrive configurations
$desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
if (-not (Test-Path $desktopPath)) {
    $oneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
    if (Test-Path $oneDriveDesktop) {
        $desktopPath = $oneDriveDesktop
    } else {
        $desktopPath = Join-Path $env:USERPROFILE "Desktop"
    }
}

$shortcutFile = Join-Path $desktopPath "DJ Desktop Studio.lnk"

# 2. Resolve Icon file (.ico only)
$iconPath = Join-Path $appDir "public\icon.ico"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $appDir "dist\icon.ico"
}
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $scriptDir "icon.ico"
}

# 3. Determine target launcher
$launcherVbs = Join-Path $scriptDir "run-dj-desktop.vbs"
$launcherBat = Join-Path $scriptDir "run-dj-desktop.bat"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutFile)

if (Test-Path $launcherVbs) {
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$launcherVbs`""
} else {
    $shortcut.TargetPath = $launcherBat
    $shortcut.WindowStyle = 7 # Minimized
}

$shortcut.WorkingDirectory = $appDir
$shortcut.Description = "DJ Desktop Studio - Professional Audio Player & DJ Mixer"

if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()

# Also create in Start Menu Programs for quick Windows Search access
try {
    $startMenuPrograms = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
    if (Test-Path $startMenuPrograms) {
        $startMenuShortcut = Join-Path $startMenuPrograms "DJ Desktop Studio.lnk"
        $s2 = $wsh.CreateShortcut($startMenuShortcut)
        if (Test-Path $launcherVbs) {
            $s2.TargetPath = "wscript.exe"
            $s2.Arguments = "`"$launcherVbs`""
        } else {
            $s2.TargetPath = $launcherBat
            $s2.WindowStyle = 7
        }
        $s2.WorkingDirectory = $appDir
        $s2.Description = "DJ Desktop Studio"
        if (Test-Path $iconPath) {
            $s2.IconLocation = "$iconPath,0"
        }
        $s2.Save()
    }
} catch {}

if (Test-Path $shortcutFile) {
    Write-Host "[✓] تم إنشاء أيقونة سطح المكتب بنجاح: $shortcutFile" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[!] تعذر إنشاء الأيقونة في $shortcutFile" -ForegroundColor Red
    exit 1
}
