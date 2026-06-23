$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = "C:\Program Files\nodejs\node.exe"
$url = "http://127.0.0.1:4177/"

if (-not (Test-Path -LiteralPath $node)) {
  $node = "node"
}

$existing = Get-NetTCPConnection -LocalPort 4177 -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath $node -ArgumentList @("server.mjs") -WorkingDirectory $scriptDir -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

try {
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
  Write-Host "LaundryApp UI prototype is running: $url"
  Write-Host "Status: $($response.StatusCode)"
} catch {
  Write-Error "Could not load $url. $($_.Exception.Message)"
}
