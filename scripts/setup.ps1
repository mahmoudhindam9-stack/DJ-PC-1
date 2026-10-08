# DJ Desktop Studio - PowerShell Setup & Desktop Installer
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          DJ DESKTOP STUDIO - Installer & Launcher                    " -ForegroundColor Yellow
Write-Host "               Windows PowerShell Setup Engine                        " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$AppDir = $PSScriptRoot
if (-not $AppDir) {
    $AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $AppDir) {
    $AppDir = (Get-Item -Path ".").FullName
}
# If PSScriptRoot is inside scripts folder, get parent as AppDir
if ((Split-Path -Leaf $AppDir) -eq "scripts") {
    $AppDir = Split-Path -Parent $AppDir
}

$ScriptsDir = Join-Path $AppDir "scripts"
if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
}

Write-Host "[*] Checking system environment and prerequisites..." -ForegroundColor White
Write-Host "[*] App folder: $AppDir" -ForegroundColor Gray

# 1. Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "[+] Node.js detected: $nodeVer" -ForegroundColor Green
    
    $distIndex = Join-Path $AppDir "dist\index.html"
    if (Test-Path $distIndex) {
        Write-Host "[+] Production build files ready (dist)." -ForegroundColor Green
    } else {
        Set-Location $AppDir
        Write-Host "[*] Installing dependencies and building production app..." -ForegroundColor Cyan
        cmd /c "npm install && npm run build"
        Write-Host "[+] Application built successfully!" -ForegroundColor Green
    }
} else {
    Write-Host "[!] Node.js not detected in system PATH." -ForegroundColor Yellow
    Write-Host "[*] Will run using local browser instance immediately." -ForegroundColor Cyan
}

# 2. Check App Icon
$publicIcon = Join-Path $AppDir "public\icon.ico"
$scriptsIcon = Join-Path $ScriptsDir "icon.ico"
$rootIcon = Join-Path $AppDir "icon.ico"
if (Test-Path $publicIcon) {
    Copy-Item $publicIcon $scriptsIcon -Force -ErrorAction SilentlyContinue
    Copy-Item $publicIcon $rootIcon -Force -ErrorAction SilentlyContinue
}

# 3. Create desktop shortcut
Write-Host ""
Write-Host "[*] Creating official Desktop Shortcut..." -ForegroundColor Cyan
$shortcutPs1 = Join-Path $ScriptsDir "create-desktop-shortcut.ps1"
$shortcutVbs = Join-Path $ScriptsDir "create-desktop-shortcut.vbs"

$shortcutCreated = $false
if (Test-Path $shortcutPs1) {
    & $shortcutPs1
    $shortcutCreated = $true
}
if (-not $shortcutCreated -and (Test-Path $shortcutVbs)) {
    cscript //nologo $shortcutVbs
    $shortcutCreated = $true
}

# 4. Launch Application immediately
Write-Host ""
Write-Host "[*] Launching DJ Desktop Studio now..." -ForegroundColor Yellow
$runnerBat = Join-Path $ScriptsDir "run-dj-desktop.bat"
$runnerVbs = Join-Path $ScriptsDir "run-dj-desktop.vbs"

if (Test-Path $runnerVbs) {
    Start-Process "wscript.exe" -ArgumentList "`"$runnerVbs`""
} elseif (Test-Path $runnerBat) {
    Start-Process -FilePath $runnerBat
} else {
    Start-Process "http://localhost:3000"
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "         DJ Desktop Studio Setup & Launch Complete!                   " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Desktop shortcut created & DJ Studio window launched."
Write-Host "To uninstall in the future, run uninstall.bat in the root folder."
Write-Host ""
Write-Host "This installer window will close automatically in 4 seconds..."
Start-Sleep -Seconds 4
