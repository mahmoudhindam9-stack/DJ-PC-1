# DJ Desktop Studio - Desktop + Start Menu Shortcut Creator
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir

$DesktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
if (-not (Test-Path $DesktopDir)) {
    $oneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
    if (Test-Path $oneDriveDesktop) {
        $DesktopDir = $oneDriveDesktop
    } else {
        $DesktopDir = Join-Path $env:USERPROFILE "Desktop"
    }
}

$ProgramsDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs)
$Launcher = Join-Path $ScriptDir "run-dj-desktop.vbs"
$IconCandidates = @(
    (Join-Path $AppDir "public\icon.ico"),
    (Join-Path $ScriptDir "icon.ico"),
    (Join-Path $AppDir "public\icon.jpg")
)
$IconPath = $IconCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$WshShell = New-Object -ComObject WScript.Shell

function New-DjShortcut([string]$Path) {
    if (-not $Path) { return }
    $shortcut = $WshShell.CreateShortcut($Path)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = '"' + $Launcher + '"'
    $shortcut.WorkingDirectory = $AppDir
    $shortcut.Description = "DJ Desktop Studio - Professional Audio Player & DJ Mixer"
    if ($IconPath) {
        $shortcut.IconLocation = "$IconPath,0"
    }
    $shortcut.Save()
}

if (-not (Test-Path $DesktopDir)) {
    New-Item -ItemType Directory -Path $DesktopDir -Force | Out-Null
}
New-DjShortcut (Join-Path $DesktopDir "DJ Desktop Studio.lnk")

if (Test-Path $ProgramsDir) {
    New-DjShortcut (Join-Path $ProgramsDir "DJ Desktop Studio.lnk")
}

Write-Host "[+] Desktop shortcut created." -ForegroundColor Green
if (Test-Path (Join-Path $DesktopDir "DJ Desktop Studio.lnk")) {
    exit 0
}
exit 1
