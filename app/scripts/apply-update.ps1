param(
    [Parameter(Mandatory = $true)][string]$PackageUrl,
    [Parameter(Mandatory = $true)][string]$AppDir,
    [int]$ServerPid = 0
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempRoot = Join-Path $env:TEMP ("DJ-Desktop-Update-" + $stamp + "-" + [guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "update.zip"
$backupDir = "$AppDir.previous-$stamp"
$appMoved = $false

try {
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    Set-Location $env:TEMP
    Write-Host "[DJ Desktop] Downloading update package..."
    Invoke-WebRequest -Uri $PackageUrl -OutFile $zipPath -UseBasicParsing -MaximumRedirection 8
    Expand-Archive -LiteralPath $zipPath -DestinationPath $tempRoot -Force

    $sourceApp = Join-Path $tempRoot "app"
    if (-not (Test-Path (Join-Path $sourceApp "dist\index.html"))) {
        throw "The downloaded PC update is missing app\dist\index.html."
    }
    if (-not (Test-Path (Join-Path $sourceApp "scripts\server.js"))) {
        throw "The downloaded PC update is missing the application server."
    }

    if ($ServerPid -gt 0) {
        $deadline = (Get-Date).AddSeconds(45)
        while ((Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 1
        }
        if (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) {
            Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }

    if (-not (Test-Path $AppDir)) { throw "The installed application folder was not found: $AppDir" }
    Move-Item -LiteralPath $AppDir -Destination $backupDir
    $appMoved = $true
    Move-Item -LiteralPath $sourceApp -Destination $AppDir

    if (-not (Test-Path (Join-Path $AppDir "dist\index.html"))) {
        throw "Update verification failed because dist\index.html is missing."
    }
    $launcher = Join-Path $AppDir "scripts\run-dj-desktop.bat"
    if (-not (Test-Path $launcher)) { throw "The updated desktop launcher is missing." }

    Write-Host "[DJ Desktop] Update installed. Reopening the application..."
    Start-Process -FilePath "$env:WINDIR\System32\cmd.exe" -ArgumentList ('/c "' + $launcher + '"') -WorkingDirectory $AppDir
    Start-Sleep -Seconds 3
    if (Test-Path $backupDir) {
        Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
catch {
    Write-Error $_
    if ($appMoved -and (Test-Path $backupDir)) {
        if (Test-Path $AppDir) { Remove-Item -LiteralPath $AppDir -Recurse -Force -ErrorAction SilentlyContinue }
        Move-Item -LiteralPath $backupDir -Destination $AppDir -ErrorAction SilentlyContinue
    }
    exit 1
}
finally {
    if (Test-Path $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
