param([switch]$NoBrowser,[int]$BackendPort=8000,[int]$FrontendPort=5173)
# Compatibility entry: root start.ps1 is the only implementation.
& (Join-Path (Split-Path -Parent $PSScriptRoot) 'start.ps1') -NoBrowser:$NoBrowser -BackendPort $BackendPort -FrontendPort $FrontendPort
