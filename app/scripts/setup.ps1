# DJ Desktop Studio - One-Step Windows Setup
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$DataDir = Join-Path $env:LOCALAPPDATA "DJ Desktop Studio"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "             DJ DESKTOP STUDIO - ONE STEP SETUP" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

function Refresh-NodePath {
    $candidates = @(
        "$env:ProgramFiles\nodejs",
        "$env:LOCALAPPDATA\Programs\nodejs",
        "$env:ProgramFiles\nodejs"
    ) | Select-Object -Unique

    $valid = $candidates | Where-Object { Test-Path (Join-Path $_ "node.exe") }
    if ($valid) {
        $env:Path = (($valid -join ";") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User"))
    }
}

Refresh-NodePath

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Host "[*] Node.js was not found. Installing Node.js LTS automatically..." -ForegroundColor Cyan

    if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
        & winget.exe install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "Node.js installation failed through winget."
        }
        Refresh-NodePath
    } else {
        throw "Node.js is not installed and winget is unavailable. Install Node.js LTS once, then run setup.bat again."
    }
}

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue

if (-not $NodeCommand -or -not $NpmCommand) {
    Refresh-NodePath
    $NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
}

if (-not $NodeCommand -or -not $NpmCommand) {
    throw "Node.js/npm could not be located after installation."
}

Write-Host "[+] Node.js: $(node -v)" -ForegroundColor Green
Write-Host "[+] npm: $(npm -v)" -ForegroundColor Green
Write-Host "[+] App folder: $AppDir" -ForegroundColor Gray
Write-Host ""

Set-Location $AppDir

if (-not (Test-Path (Join-Path $AppDir "package.json"))) {
    throw "package.json was not found inside the app folder."
}

Write-Host "[*] Installing/updating project dependencies..." -ForegroundColor Cyan
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
}

Write-Host "[*] Building the production application..." -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    throw "The production build failed."
}

if (-not (Test-Path (Join-Path $AppDir "dist\index.html"))) {
    throw "Build completed without producing dist\index.html."
}

Write-Host "[+] Production build completed successfully." -ForegroundColor Green
Write-Host "[*] Creating Desktop and Start Menu shortcuts..." -ForegroundColor Cyan

$ShortcutScript = Join-Path $ScriptDir "create-desktop-shortcut.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ShortcutScript
if ($LASTEXITCODE -ne 0) {
    throw "Shortcut creation failed."
}

Write-Host "[+] Shortcuts created." -ForegroundColor Green
Write-Host "[*] Launching DJ Desktop Studio..." -ForegroundColor Cyan

$Launcher = Join-Path $ScriptDir "run-dj-desktop.vbs"
Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $Launcher + '"')

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "               DJ DESKTOP STUDIO IS READY" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Install completed in one step."
Write-Host "Run uninstall.bat from this package whenever you want to remove the app data and shortcuts."
Start-Sleep -Seconds 2
