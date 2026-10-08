# DJ Desktop Studio - PowerShell Uninstaller
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Red
Write-Host "         DJ DESKTOP STUDIO - إلغاء التثبيت وحذف جميع الملفات" -ForegroundColor Yellow
Write-Host "            Windows PowerShell Uninstaller & Clean-Up" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Red
Write-Host ""

$AppDir = Split-Path -Parent $PSScriptRoot
if (-not $AppDir) { $AppDir = (Get-Item -Path ".\").FullName }
$ScriptsDir = Join-Path $AppDir "scripts"

$DesktopDir = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ShortcutPath = Join-Path $DesktopDir "DJ Desktop Studio.lnk"

Write-Host "[!] تنبيه: سيتم حذف جميع الملفات المثبتة (أيقونة سطح المكتب، dist، node_modules، المشغلات)." -ForegroundColor Yellow
$Confirm = Read-Host "هل أنت متأكد من رغبتك في إلغاء التثبيت؟ (y/N)"
if ($Confirm -ne "y" -and $Confirm -ne "Y") {
    Write-Host "[✓] تم إلغاء العملية، لم يتم حذف أي ملفات." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "[1/5] جاري إيقاف أي عمليات نشطة..." -ForegroundColor Cyan
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "[2/5] جاري حذف أيقونة سطح المكتب..." -ForegroundColor Cyan
if (Test-Path $ShortcutPath) {
    Remove-Item -Path $ShortcutPath -Force -ErrorAction SilentlyContinue
    Write-Host "[✓] تم حذف اختصار سطح المكتب." -ForegroundColor Green
}
$OneDriveDesktop = Join-Path ([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)) "OneDrive\Desktop\DJ Desktop Studio.lnk"
if (Test-Path $OneDriveDesktop) {
    Remove-Item -Path $OneDriveDesktop -Force -ErrorAction SilentlyContinue
}

Write-Host "[3/5] جاري حذف مشغلات الإقلاع..." -ForegroundColor Cyan
@("$ScriptsDir\run-dj-desktop.bat", "$ScriptsDir\run-dj-desktop.vbs", "$AppDir\run-dj-desktop.bat", "$AppDir\run-dj-desktop.vbs") | ForEach-Object {
    if (Test-Path $_) { Remove-Item -Path $_ -Force -ErrorAction SilentlyContinue }
}

Write-Host "[4/5] جاري حذف ملفات البناء (dist)..." -ForegroundColor Cyan
@("$AppDir\dist", "$AppDir\dev-dist", "$AppDir\.build-outputs") | ForEach-Object {
    if (Test-Path $_) { Remove-Item -Path $_ -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host "[5/5] جاري حذف مكتبات التثبيت (node_modules)..." -ForegroundColor Cyan
if (Test-Path "$AppDir\node_modules") {
    Remove-Item -Path "$AppDir\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[✓] تم حذف node_modules بنجاح." -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "                 تم إلغاء التثبيت بنجاح بالكامل!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "يمكنك إعادة التثبيت في أي وقت بتشغيل setup.bat" -ForegroundColor Cyan
