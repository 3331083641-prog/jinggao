param([switch]$NoBrowser,[ValidateRange(1024,65535)][int]$BackendPort=8000,[ValidateRange(1024,65535)][int]$FrontendPort=5173)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'scripts\launcher\common.ps1')
$root=$PSScriptRoot
$paths=Get-LaunchPaths $root
$launchLock=$null
$state=$null
$started=@()
$transcribing=$false
try {
    New-Item -ItemType Directory -Force -Path $paths.Logs | Out-Null
    Start-Transcript -Path (Join-Path $paths.Logs 'start.log') -Append | Out-Null
    $transcribing=$true
    if ($BackendPort -eq $FrontendPort) { throw '前后端端口不能相同。' }
    $environment=Get-LaunchEnvironment
    New-Item -ItemType Directory -Force -Path $paths.Logs | Out-Null
    $launchLock=[IO.File]::Open((Join-Path $paths.Runtime 'launch.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $state=Read-LaunchState $paths $root
    if ($state -and $state.backend -and $state.frontend -and ($state.backend.port -ne $BackendPort -or $state.frontend.port -ne $FrontendPort)) { throw '当前目录已有其他端口的启动记录，请先运行 .\stop.ps1。' }
    foreach ($item in @(@{name='backend';port=$BackendPort},@{name='frontend';port=$FrontendPort})) {
        $owners=@(Get-PortOwners $item.port)
        if ($owners.Count -gt 0 -and (-not $state -or -not (Test-ServicePort $state.($item.name) $root))) { throw ('端口 '+$item.port+' 已被其他程序或非本入口启动的服务占用。不会接管或停止它。请手动停止对应服务，或使用 -BackendPort 8001 -FrontendPort 5174。') }
    }
    if (-not (Test-LaunchDependencies $root $paths)) {
        if ($state -and ((Test-OwnedWrapper $state.backend $root) -or (Test-OwnedWrapper $state.frontend $root))) { throw '依赖已变化，先运行 .\stop.ps1 再启动，避免修改运行中的依赖。' }
        Write-Host '项目依赖尚未完整准备，调用 setup.ps1…'
        & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'setup.ps1')
        if ($LASTEXITCODE -ne 0) { throw '首次初始化失败，详情见 setup.log。' }
    }
    $env:PYTHONUTF8='1'
    if (-not $env:JINGGAO_DATA_DIR) { $env:JINGGAO_DATA_DIR=Join-Path $root 'backend\data' }
    $dataDir=[IO.Path]::GetFullPath($env:JINGGAO_DATA_DIR)
    Write-Host '检查本地 SQLite 与 PDF/OCR 资源…'
    & $paths.Python (Join-Path $root 'scripts\launcher\verify_runtime.py') --initialize
    if ($LASTEXITCODE -ne 0) { throw '本地数据库或 OCR 资源检查失败。' }
    & $environment.Node (Join-Path $root 'scripts\prepare-pdf-assets.mjs')
    if ($LASTEXITCODE -ne 0) { throw '本地 PDF 资源准备失败。' }
    if (-not $state) { $state=@{version=1;root=$root;backend=$null;frontend=$null} }
    foreach ($item in @(@{name='backend';port=$BackendPort},@{name='frontend';port=$FrontendPort})) {
        $service=$state.($item.name)
        if ($service -and (Test-OwnedWrapper $service $root)) { Write-Host ($item.name+' 已由当前实例启动，复用进程。') }
        else {
            Write-Host ('启动 '+$item.name+'…')
            $service=Start-OwnedService $item.name $item.port $BackendPort $root $paths $environment $dataDir
            $state.($item.name)=$service
            $started+=$service
            Write-LaunchState $paths $state
        }
        $ready=$false
        for ($attempt=0;$attempt -lt 60;$attempt++) {
            if (-not (Test-OwnedWrapper $service $root)) { break }
            if (Test-ServicePort $service $root) {
                if ($item.name -eq 'backend') { $ready=Test-BackendHealth $BackendPort }
                else { $ready=Test-FrontendHealth $FrontendPort $BackendPort }
                if ($ready) { break }
            }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw ($item.name+' 未通过服务身份与访问检查，请查看对应日志。') }
    }
    Write-Host '可选本地 AI Provider 检查（不发送用户材料）…'
    & $paths.Python (Join-Path $root 'scripts\launcher\verify_runtime.py') --providers
    $url='http://127.0.0.1:'+$FrontendPort+'/'
    Write-Host ('净稿已启动：'+$url) -ForegroundColor Green
    Write-Host ('停止：.\stop.ps1；日志：'+$paths.Logs)
    Write-Host '评委演示：导入 demos\metadata-rule.txt，上传 benchmark\fixtures\synthetic-cleanup.pdf；完整步骤见 docs\WINDOWS_START.md。'
    if (-not $NoBrowser) {
        try { Start-Process $url -ErrorAction Stop | Out-Null }
        catch { Write-Host ('浏览器打开被权限或系统策略阻止，请手动点击：'+$url) -ForegroundColor Yellow }
    }
} catch {
    foreach ($service in $started) { Stop-OwnedService $service $root }
    Write-Host ('启动失败：'+$_.Exception.Message) -ForegroundColor Red
    Write-Host ('错误日志：'+$paths.Logs+'；安装日志：setup.log；服务日志：backend-error.log / frontend-error.log')
    exit 1
} finally { if ($launchLock) { $launchLock.Dispose() };if ($transcribing) { Stop-Transcript | Out-Null } }
