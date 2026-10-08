$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'scripts\launcher\common.ps1')
$root=$PSScriptRoot
$paths=Get-LaunchPaths $root
$launchLock=$null
$transcribing=$false
try {
    New-Item -ItemType Directory -Force -Path $paths.Logs | Out-Null
    Start-Transcript -Path (Join-Path $paths.Logs 'stop.log') -Append | Out-Null
    $transcribing=$true
    $launchLock=[IO.File]::Open((Join-Path $paths.Runtime 'launch.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $state=Read-LaunchState $paths $root
    if (-not $state) { Write-Host '当前目录没有由正式入口启动的实例，不停止其他程序。';exit 0 }
    foreach ($name in @('frontend','backend')) { if ($state.$name) { Stop-OwnedService $state.$name $root } }
    for ($attempt=0;$attempt -lt 20;$attempt++) {
        if (-not (Test-OwnedWrapper $state.frontend $root) -and -not (Test-OwnedWrapper $state.backend $root)) { break }
        Start-Sleep -Milliseconds 250
    }
    foreach ($name in @('frontend','backend')) { if ($state.$name -and (Test-OwnedWrapper $state.$name $root)) { throw '进程仍在运行，已保留实例记录，请查看系统权限。' } }
    $state.backend=$null
    $state.frontend=$null
    Write-LaunchState $paths $state
    Write-Host '当前净稿实例停止检查完成。数据库、原稿、副本、历史和报告均保留。'
} catch {
    Write-Host ('停止失败：'+$_.Exception.Message) -ForegroundColor Red
    Write-Host ('请核对实例记录：'+$paths.State+'；不会按进程名批量停止程序。')
    exit 1
} finally { if ($launchLock) { $launchLock.Dispose() };if ($transcribing) { Stop-Transcript | Out-Null } }
