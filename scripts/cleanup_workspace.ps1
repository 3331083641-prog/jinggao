#requires -Version 7.0
param([switch]$Execute)
$ErrorActionPreference = 'Stop'
$jgRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$jgRootPrefix = $jgRoot.TrimEnd('\') + '\'
$jgTargets = [Collections.Generic.List[object]]::new()
function Add-CleanupTarget([string]$Relative, [string]$Purpose, [string]$Reason) {
    $jgPath = [IO.Path]::GetFullPath((Join-Path $jgRoot $Relative))
    if (-not $jgPath.StartsWith($jgRootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup target escaped workspace' }
    if (-not (Test-Path -LiteralPath $jgPath)) { return }
    $jgItem = Get-Item -LiteralPath $jgPath
    if ($jgItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing cleanup through a reparse point' }
    $jgFiles = @(Get-ChildItem -LiteralPath $jgPath -Recurse -File -Force)
    if (@($jgFiles | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count) { throw 'Refusing cleanup of a linked file' }
    $jgSize = ($jgFiles | Measure-Object Length -Sum).Sum
    $jgTargets.Add([pscustomobject]@{Path=$jgPath; Relative=$Relative; Bytes=[long]$jgSize; Purpose=$Purpose; Reason=$Reason})
}
Add-CleanupTarget '.pytest_cache' 'Pytest cache' 'Tests have completed; recreated automatically'
Add-CleanupTarget '.ruff_cache' 'Ruff cache' 'Static-check cache; recreated automatically'
Add-CleanupTarget '.cache/npm/_cacache' 'Downloaded npm archives' 'Installed node_modules retained; archives can be downloaded again'
Add-CleanupTarget '.cache/pip' 'Downloaded pip archives' 'Installed virtual environment retained; archives can be downloaded again'
Add-CleanupTarget '.cache/pytest' 'Synthetic pytest temporary files' 'Completed tests use isolated synthetic fixtures, never user uploads'
Add-CleanupTarget 'frontend/dist' 'Previous Vite build' 'Build output; a fresh build follows cleanup'
Add-CleanupTarget 'frontend/test-results' 'Playwright traces and failure artifacts' 'Validation results retained separately; no product source'
foreach ($jgBase in @('backend/app','tests','scripts','benchmark')) {
    foreach ($jgCache in @(Get-ChildItem -LiteralPath (Join-Path $jgRoot $jgBase) -Directory -Recurse -Force | Where-Object {$_.Name -eq '__pycache__'})) {
        Add-CleanupTarget ([IO.Path]::GetRelativePath($jgRoot,$jgCache.FullName)) 'Python bytecode' 'Recreated automatically; no source'
    }
}
$jgE2e = Join-Path $jgRoot 'tests/generated/e2e-data'
if (Test-Path -LiteralPath $jgE2e) {
    foreach ($jgRun in @(Get-ChildItem -LiteralPath $jgE2e -Directory)) {
        # Old isolated synthetic test databases only; never the user database.
        if ($jgRun.Name -match '^\d{13}$' -and $jgRun.LastWriteTime -lt (Get-Date).AddHours(-1)) {
            Add-CleanupTarget ([IO.Path]::GetRelativePath($jgRoot,$jgRun.FullName)) 'Completed synthetic E2E database' 'Older than one hour; each invocation creates a new database'
        }
    }
}
$jgLines = @('# 工程清理审计', '', '范围：仅可再生成的缓存、旧构建与已结束的合成测试运行目录。正式源码、依赖环境、用户材料、SQLite、报告和回退备份均保留。', '', 'A 必须提交：frontend/src、backend/app、规则 Schema、检测器、解析器、报告、测试、依赖清单及锁文件、README、架构和第三方披露。', '', 'B 可提交：自研程序化 assets、合成 fixture、经过审查的视觉基线、开发验证脚本。', '', 'C 禁止提交：密钥与环境配置、用户材料、SQLite、导出报告、OCR 权重与缓存、参考图片、依赖环境、截图/trace/video、回退备份、当地材料操作脚本。', '', 'D 安全删除：下表中经用途和绝对路径核对的可再生成内容。没有按文件名猜测删除旧源码。', '', '| 路径 | 字节 | 用途 | 可删除依据 |', '|---|---:|---|---|')
foreach ($jgTarget in $jgTargets) { $jgLines += "| $($jgTarget.Relative) | $($jgTarget.Bytes) | $($jgTarget.Purpose) | $($jgTarget.Reason) |" }
$jgTotal = [long](($jgTargets | Measure-Object Bytes -Sum).Sum)
$jgLines += @('', "计划清理字节：$jgTotal", '', '删除前审计已保存；执行时再次核对绝对路径。')
$jgAudit = Join-Path $jgRoot 'CLEANUP_AUDIT.md'
$jgLines | Set-Content -LiteralPath $jgAudit -Encoding utf8
if ($Execute) {
    foreach ($jgTarget in $jgTargets) {
        $jgResolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $jgTarget.Path).Path)
        if (-not $jgResolved.StartsWith($jgRootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Resolved cleanup target escaped workspace' }
        Remove-Item -LiteralPath $jgResolved -Recurse -Force
    }
    Add-Content -LiteralPath $jgAudit -Value "`n已删除 $($jgTargets.Count) 个目标；释放 $jgTotal 字节（按删除前文件长度统计，不含压缩/簇分配差异）。" -Encoding utf8
}
Write-Output ([pscustomobject]@{Targets=$jgTargets.Count; Bytes=$jgTotal; Executed=[bool]$Execute} | ConvertTo-Json -Compress)
