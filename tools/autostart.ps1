<#
    autostart.ps1
    ------------------------------------------------------------
    开机自启开关，由 tools\autostart.cmd 双击调用（.cmd 里不写中文，
    免得 cmd.exe 按 ANSI 读 UTF-8 的批处理时把中文拆坏）。

    它做的事只有一件：在 Windows 的「启动」文件夹里
    放一个指向 auto-push.cmd 的快捷方式；再跑一次就删掉。
    不写注册表、不加计划任务，随时可以撤销。
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $PSScriptRoot 'auto-push.cmd'
$startup = [Environment]::GetFolderPath('Startup')

# 快捷方式的名字必须用纯 ASCII：WScript.Shell 的 Save() 碰到中文文件名会
# 直接报 "Unable to save shortcut"（这台机器上实测如此）。名字只是个标签。
$lnk = Join-Path $startup 'My Daily Paintrack Auto Sync.lnk'

if (-not (Test-Path -LiteralPath $cmd)) {
    Write-Host "找不到 $cmd" -ForegroundColor Red
    exit 1
}

if (Test-Path -LiteralPath $lnk) {
    Remove-Item -LiteralPath $lnk -Force
    Write-Host ''
    Write-Host '  已取消开机自启（删掉了启动文件夹里的快捷方式）' -ForegroundColor Yellow
    Write-Host "  $lnk" -ForegroundColor DarkGray
}
else {
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut($lnk)
    $s.TargetPath = $cmd
    $s.WorkingDirectory = $root
    $s.WindowStyle = 7          # 7 = 最小化启动
    $s.Description = 'My Daily Paintrack auto sync'
    $s.Save()

    Write-Host ''
    Write-Host '  已设为开机自启（下次开机自动在后台最小化运行）' -ForegroundColor Green
    Write-Host "  快捷方式：$lnk" -ForegroundColor DarkGray
    Write-Host '  想取消就再双击一次 tools\autostart.cmd' -ForegroundColor DarkGray
}
