# Windows PowerShell 5.1 / PowerShell 7 shared launcher helpers.
Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'
function Get-LaunchPaths($Root) {
    $runtime=Join-Path $Root 'runtime\launcher'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    return @{Runtime=$runtime;State=(Join-Path $runtime 'instance.json');Logs=(Join-Path $runtime 'logs');Python=(Join-Path $Root 'backend\.venv\Scripts\python.exe')}
}
function Get-LaunchHash($Path) {
    $stream=[IO.File]::OpenRead($Path)
    $hash=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','') }
    finally { $stream.Dispose();$hash.Dispose() }
}
function Get-LaunchEnvironment {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw '此入口仅支持 Windows 10/11。' }
    $python=$null
    foreach ($name in @('python.exe','py.exe')) {
        $command=Get-Command $name -ErrorAction SilentlyContinue
        if (-not $command) { continue }
        $arguments=@('-c','import sys; print(sys.executable) if sys.version_info[:2] == (3,12) and sys.maxsize > 2**32 else sys.exit(1)')
        if ($name -eq 'py.exe') { $arguments=@('-3.12')+$arguments }
        try { $output=& $command.Source @arguments 2>$null } catch { continue }
        if ($LASTEXITCODE -eq 0 -and $output -and (Test-Path -LiteralPath ([string]$output))) { $python=[string]$output;break }
    }
    if (-not $python) { throw '未找到 Python 3.12（64 位）。安装地址：https://www.python.org/downloads/windows/ ；不会自动安装全局软件。' }
    $node=Get-Command node.exe -ErrorAction SilentlyContinue
    $npm=Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) { throw '未找到 Node.js / npm。请安装 Node.js 22.12+：https://nodejs.org/en/download' }
    $nodeVersion=(& $node.Source --version).Trim().TrimStart('v')
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'22.12.0') { throw 'Node.js 版本不满足 22.12+：https://nodejs.org/en/download' }
    & $npm.Source --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'npm 无法运行，请修复 Node.js 安装。' }
    return @{Python=$python;Node=$node.Source;Npm=$npm.Source;NodeVersion=$nodeVersion}
}
function Test-LaunchDependencies($Root,$Paths) {
    if (-not (Test-Path -LiteralPath $Paths.Python)) { return $false }
    & $Paths.Python (Join-Path $Root 'scripts\launcher\verify_runtime.py') --check *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
    foreach ($file in @('vite/bin/vite.js','react/package.json','pdfjs-dist/cmaps/78-EUC-H.bcmap','@react-three/fiber/package.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root ('frontend\node_modules\'+$file)))) { return $false }
    }
    Push-Location -LiteralPath (Join-Path $Root 'frontend')
    try {
        & npm.cmd ls --depth=0 --silent *> $null
        if ($LASTEXITCODE -ne 0) { return $false }
        $stampPath=Join-Path $Paths.Runtime 'installed.json'
        if (-not (Test-Path -LiteralPath $stampPath)) { return $false }
        $stamp=Get-Content -LiteralPath $stampPath -Raw -Encoding UTF8 | ConvertFrom-Json
        return ($stamp.pythonLock -eq (Get-LaunchHash (Join-Path $Root 'backend\requirements.lock.txt')) -and $stamp.nodeLock -eq (Get-LaunchHash (Join-Path $Root 'frontend\package-lock.json')))
    } finally { Pop-Location }
}
function Get-LaunchProcess($ProcessId) { return Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$ProcessId) -ErrorAction SilentlyContinue }
function Test-OwnedWrapper($Service,$Root) {
    if (-not $Service) { return $false }
    if ([string]$Service.token -notmatch '^[a-f0-9]{32}$') { return $false }
    $process=Get-LaunchProcess $Service.pid
    if (-not $process -or -not $process.CommandLine) { return $false }
    return ($process.CreationDate.ToUniversalTime().ToString('o') -eq $Service.created -and $process.ExecutablePath -eq $Service.executable -and $process.CommandLine.Contains([string]$Service.token) -and $process.CommandLine.Contains((Join-Path $Root 'scripts\launcher\run-service.ps1')))
}
function Test-Descendant($ChildId,$ParentId) {
    $seen=@{}
    $childCreated=$null
    for ($i=0;$i -lt 32;$i++) {
        if ($seen.ContainsKey([int]$ChildId)) { return $false }
        $seen[[int]$ChildId]=$true
        $process=Get-LaunchProcess $ChildId
        if (-not $process) { return $false }
        if ($childCreated -and $process.CreationDate -gt $childCreated) { return $false }
        if ([int]$ChildId -eq [int]$ParentId) { return $true }
        if ($process.ParentProcessId -eq 0) { return $false }
        $childCreated=$process.CreationDate
        $ChildId=$process.ParentProcessId
    }
    return $false
}
function Get-PortOwners($Port) { return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) }
function Test-ServicePort($Service,$Root) {
    if (-not (Test-OwnedWrapper $Service $Root)) { return $false }
    $owners=@(Get-PortOwners $Service.port)
    if ($owners.Count -eq 0) { return $false }
    foreach ($owner in $owners) { if (-not (Test-Descendant $owner $Service.pid)) { return $false } }
    return $true
}
function Read-LocalResponse($Url) {
    # PS 5.1 may decode UTF-8 JSON without charset as ANSI; decode explicitly.
    $request=[Net.HttpWebRequest]::Create($Url)
    $request.Proxy=$null
    $request.AllowAutoRedirect=$false
    $request.Timeout=3000
    $request.ReadWriteTimeout=3000
    $response=$null
    $reader=$null
    try {
        $response=$request.GetResponse()
        if ([int]$response.StatusCode -ne 200) { throw '本地服务未返回 200。' }
        $reader=New-Object IO.StreamReader($response.GetResponseStream(),[Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } finally { if ($reader) { $reader.Dispose() };if ($response) { $response.Close() } }
}
function Test-BackendHealth($Port) {
    try {
        $health=Read-LocalResponse ('http://127.0.0.1:'+$Port+'/health') | ConvertFrom-Json
        $schema=Read-LocalResponse ('http://127.0.0.1:'+$Port+'/openapi.json') | ConvertFrom-Json
        return ($health.status -eq 'ok' -and $health.processing -eq 'local' -and $health.storage -eq 'SQLite' -and $schema.info.title -eq '净稿 · Local-first' -and $schema.paths.PSObject.Properties.Name -contains '/api/generate')
    } catch { return $false }
}
function Test-FrontendHealth($Port,$BackendPort) {
    try {
        $html=Read-LocalResponse ('http://127.0.0.1:'+$Port+'/')
        $entry=Read-LocalResponse ('http://127.0.0.1:'+$Port+'/src/main.tsx')
        $proxy=Read-LocalResponse ('http://127.0.0.1:'+$Port+'/api/health') | ConvertFrom-Json
        return ($html.Contains('净稿') -and $html.Contains('/src/main.tsx') -and $entry.Contains('createRoot') -and $proxy.status -eq 'ok' -and (Test-BackendHealth $BackendPort))
    } catch { return $false }
}
function Write-LaunchState($Paths,$State) { $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Paths.State -Encoding UTF8 }
function Read-LaunchState($Paths,$Root) {
    if (-not (Test-Path -LiteralPath $Paths.State)) { return $null }
    $state=Get-Content -LiteralPath $Paths.State -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.root -ne $Root -or $state.version -ne 1) { throw '实例记录不属于当前目录。请核对 runtime\launcher\instance.json；不会停止其中的进程。' }
    return $state
}
function Stop-OwnedService($Service,$Root) {
    if (-not (Test-OwnedWrapper $Service $Root)) { Write-Host '进程已退出或身份不符，未停止任何未知进程。';return }
    $snapshot=@(Get-CimInstance Win32_Process)
    $depths=@{([int]$Service.pid)=0}
    for ($depth=1;$depth -le 32;$depth++) {
        $changed=$false
        foreach ($process in $snapshot) {
            if (-not $depths.ContainsKey([int]$process.ProcessId) -and $depths.ContainsKey([int]$process.ParentProcessId)) { $depths[[int]$process.ProcessId]=$depths[[int]$process.ParentProcessId]+1;$changed=$true }
        }
        if (-not $changed) { break }
    }
    $selected=@($snapshot | Where-Object {$depths.ContainsKey([int]$_.ProcessId)} | Sort-Object { $depths[[int]$_.ProcessId] } -Descending)
    # Verify snapshot creation time and ancestry again immediately before stopping.
    foreach ($process in ($selected | Where-Object {$_.ProcessId -ne $Service.pid})) {
        $current=Get-LaunchProcess $process.ProcessId
        if ($current -and $current.CreationDate -eq $process.CreationDate -and (Test-OwnedWrapper $Service $Root) -and (Test-Descendant $current.ProcessId $Service.pid)) { Stop-Process -Id $current.ProcessId -ErrorAction SilentlyContinue }
    }
    if (Test-OwnedWrapper $Service $Root) { Stop-Process -Id $Service.pid -ErrorAction SilentlyContinue }
}
function Quote-LaunchArgument([string]$Value) {
    if ($Value.Contains('"')) { throw '路径或启动参数中含有不支持的双引号。' }
    return '"'+$Value+'"'
}
function Start-OwnedService($Name,$Port,$BackendPort,$Root,$Paths,$Environment,$DataDir) {
    $token=[guid]::NewGuid().ToString('N')
    $hostExe=(Get-Process -Id $PID).Path
    $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Quote-LaunchArgument (Join-Path $Root 'scripts\launcher\run-service.ps1')),'-Kind',$Name,'-Port',$Port,'-BackendPort',$BackendPort,'-Root',(Quote-LaunchArgument $Root),'-Token',$token,'-Node',(Quote-LaunchArgument $Environment.Node),'-DataDir',(Quote-LaunchArgument $DataDir))
    $process=Start-Process -FilePath $hostExe -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Paths.Logs ($Name+'.log')) -RedirectStandardError (Join-Path $Paths.Logs ($Name+'-error.log'))
    $identity=Get-LaunchProcess $process.Id
    if (-not $identity) { throw ($Name+'进程启动后立即退出，请查看日志。') }
    return @{pid=$process.Id;created=$identity.CreationDate.ToUniversalTime().ToString('o');executable=$identity.ExecutablePath;token=$token;port=$Port}
}
