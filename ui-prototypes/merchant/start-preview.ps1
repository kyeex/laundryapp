$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = "C:\Program Files\nodejs\node.exe"
$port = 4182
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path -LiteralPath $node)) {
  $node = "node"
}

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath $node -ArgumentList @("server.mjs") -WorkingDirectory $scriptDir -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

$response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
Write-Host "LaundryStar merchant prototype is running: $url"
Write-Host "Status: $($response.StatusCode)"
