param([switch]$CheckOnly,[string]$PythonIndex='https://pypi.org/simple',[string]$NpmRegistry='https://registry.npmjs.org')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'scripts\launcher\common.ps1')
$root=$PSScriptRoot
$paths=Get-LaunchPaths $root
$installationLock=$null
$transcribing=$false
try {
    $environment=Get-LaunchEnvironment
    New-Item -ItemType Directory -Force -Path $paths.Logs | Out-Null
    Start-Transcript -Path (Join-Path $paths.Logs 'setup.log') -Append | Out-Null
    $transcribing=$true
    $installationLock=[IO.File]::Open((Join-Path $paths.Runtime 'setup.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    Write-Host ('环境检查通过：Python 3.12 / Node.js '+$environment.NodeVersion)
    if ($CheckOnly) {
        if (-not (Test-LaunchDependencies $root $paths)) { throw '依赖缺失或锁文件已改变，请运行 .\setup.ps1（首次需要网络）。' }
        Write-Host '安装状态验证通过。';exit 0
    }
    $state=Read-LaunchState $paths $root
    if ($state -and ((Test-OwnedWrapper $state.backend $root) -or (Test-OwnedWrapper $state.frontend $root))) { throw '当前实例正在运行，请先运行 .\stop.ps1 再安装，避免改动运行中的依赖。' }
    foreach ($address in @($PythonIndex,$NpmRegistry)) {
        $uri=[uri]$address
        if ($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw '依赖源必须是无凭证、无查询参数的 HTTPS 地址。' }
    }
    Write-Host '首次安装需要网络；仅安装锁文件中的项目依赖，不安装全局软件、Ollama、模型或浏览器测试环境。'
    $env:PIP_CACHE_DIR=Join-Path $paths.Runtime 'cache\pip'
    $env:npm_config_cache=Join-Path $paths.Runtime 'cache\npm'
    $env:PIP_DISABLE_PIP_VERSION_CHECK='1'
    $env:PYTHONUTF8='1'
    if (-not (Test-Path -LiteralPath $paths.Python)) {
        Write-Host '创建仓库本地 Python 虚拟环境…'
        & $environment.Python -m venv (Join-Path $root 'backend\.venv')
        if ($LASTEXITCODE -ne 0) { throw '创建虚拟环境失败。' }
    }
    Write-Host '安装 Python 锁定依赖（显示 pip 实际进度）…'
    & $paths.Python -m pip install --index-url $PythonIndex --retries 2 --timeout 20 -r (Join-Path $root 'backend\requirements.lock.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Python 依赖安装失败。请检查网络、代理或镜像可达性；不会记录安装成功。' }
    Write-Host '安装前端锁定依赖（npm ci）…'
    & $environment.Npm --prefix (Join-Path $root 'frontend') ci --registry $NpmRegistry --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw '前端依赖安装失败。请检查网络与 npm 日志；不会记录安装成功。' }
    & $paths.Python (Join-Path $root 'scripts\launcher\verify_runtime.py') --check
    if ($LASTEXITCODE -ne 0) { throw 'Python 锁定依赖验证失败。' }
    & $paths.Python -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Python 依赖关系验证失败。' }
    & $environment.Node (Join-Path $root 'scripts\prepare-pdf-assets.mjs')
    if ($LASTEXITCODE -ne 0) { throw '本地 PDF 资源准备失败。' }
    @{pythonLock=(Get-LaunchHash (Join-Path $root 'backend\requirements.lock.txt'));nodeLock=(Get-LaunchHash (Join-Path $root 'frontend\package-lock.json'));installed=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $paths.Runtime 'installed.json') -Encoding UTF8
    if (-not (Test-LaunchDependencies $root $paths)) { throw '最终安装状态验证失败。' }
    Write-Host '项目依赖与本地 PDF/OCR 资源验证成功。请运行 .\start.ps1。'
} catch {
    Write-Host ('初始化失败：'+$_.Exception.Message) -ForegroundColor Red
    Write-Host ('安装日志：'+(Join-Path $paths.Logs 'setup.log'))
    exit 1
} finally {
    if ($installationLock) { $installationLock.Dispose() }
    if ($transcribing) { Stop-Transcript | Out-Null }
}
