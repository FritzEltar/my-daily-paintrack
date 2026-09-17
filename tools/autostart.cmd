@echo off
REM Double-click once  -> start the auto-sync on every boot.
REM Double-click again -> undo it.
REM It only adds / removes a shortcut in your Windows Startup folder.

title My Daily Paintrack - Autostart

REM Windows PowerShell 5.1 reads a BOM-less UTF-8 .ps1 as ANSI, which garbles
REM the Chinese text inside it. Re-add the BOM automatically if some editor
REM stripped it (same trick as update-gallery.cmd).
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path '%~dp0' 'autostart.ps1'; $b = [System.IO.File]::ReadAllBytes($p); if (-not ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)) { $t = [System.IO.File]::ReadAllText($p, (New-Object System.Text.UTF8Encoding($false))); [System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($true))); Write-Host '[fix] re-added UTF-8 BOM to autostart.ps1' -ForegroundColor Yellow }"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart.ps1"

echo.
pause
