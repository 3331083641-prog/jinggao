param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$pythonPath=Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
if(-not(Test-Path -LiteralPath $pythonPath)){throw '请先按照 README 安装后端依赖。'}
$backendLog=Join-Path $projectRoot 'backend\data\backend.log'
$frontendLog=Join-Path $projectRoot 'backend\data\frontend.log'
New-Item -ItemType Directory -Force (Join-Path $projectRoot 'backend\data') | Out-Null
try{Invoke-RestMethod 'http://127.0.0.1:8000/health' | Out-Null}catch{
 Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError (Join-Path $projectRoot 'backend\data\backend-error.log')
}
$healthy=$false
for($attempt=0;$attempt -lt 30;$attempt++){try{Invoke-RestMethod 'http://127.0.0.1:8000/health' | Out-Null;$healthy=$true;break}catch{Start-Sleep -Milliseconds 500}}
if(-not $healthy){throw '后端健康检查未通过，请检查本地日志。'}
$nodePath=(Get-Command node.exe).Source
& $nodePath (Join-Path $projectRoot 'scripts\prepare-pdf-assets.mjs')
try{Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing | Out-Null}catch{
 Start-Process -FilePath $nodePath -ArgumentList 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError (Join-Path $projectRoot 'backend\data\frontend-error.log')
}
Write-Output '净稿：http://127.0.0.1:5173  后端：http://127.0.0.1:8000/health'
if(-not $NoBrowser){Start-Process 'http://127.0.0.1:5173'}
