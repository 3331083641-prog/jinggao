param([ValidateSet('backend','frontend')][string]$Kind,[int]$Port,[int]$BackendPort,[string]$Root,[string]$Token,[string]$Node,[string]$DataDir)
$ErrorActionPreference='Stop'
$env:PYTHONUTF8='1'
$env:PYTHONUNBUFFERED='1'
$env:JINGGAO_DATA_DIR=$DataDir
$env:CI='true'
$env:JINGGAO_API_ORIGIN='http://127.0.0.1:'+$BackendPort
Set-Location -LiteralPath $Root
try {
    if ($Kind -eq 'backend') {
        & (Join-Path $Root 'backend\.venv\Scripts\python.exe') -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port $Port
    } else {
        Set-Location -LiteralPath (Join-Path $Root 'frontend')
        & $Node 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port $Port --strictPort
    }
    exit $LASTEXITCODE
} catch { Write-Error ('服务启动失败：'+$_.Exception.Message);exit 1 }
