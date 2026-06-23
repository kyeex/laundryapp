param(
  [int]$Port = 8111,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$mobileRoot = Join-Path $root "apps/mobile"
$envPath = Join-Path $mobileRoot ".env.staging"

if (-not $OutputDir) {
  $OutputDir = "dist-staging-auth-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
}

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Normalize-EnvValue($Value) {
  $cleanValue = $Value.Trim()

  if (
    ($cleanValue.StartsWith('"') -and $cleanValue.EndsWith('"')) -or
    ($cleanValue.StartsWith("'") -and $cleanValue.EndsWith("'"))
  ) {
    return $cleanValue.Substring(1, $cleanValue.Length - 2)
  }

  return $cleanValue
}

function Test-PreviewPort() {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port" -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing apps/mobile/.env.staging. Copy apps/mobile/.env.staging.example to apps/mobile/.env.staging and fill in Firebase staging values."
}

if (Test-PreviewPort) {
  throw "Port $Port is already serving an app. Use a different port, for example: npm run preview:staging -- -Port 8120"
}

Write-Step "Loading staging environment"
Get-Content -LiteralPath $envPath | ForEach-Object {
  $line = $_.Trim()

  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
    return
  }

  $name, $value = $line.Split("=", 2)
  [Environment]::SetEnvironmentVariable($name.Trim(), (Normalize-EnvValue $value), "Process")
}

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

Write-Step "Exporting staging web preview"
Set-Location $mobileRoot
npx expo export --clear --platform web --output-dir $OutputDir

Write-Step "Starting local preview"
$env:PORT = "$Port"
$logFile = "staging-auth-preview-$Port.log"
Start-Process -FilePath "powershell" `
  -ArgumentList @(
    "-NoProfile",
    "-Command",
    "`$env:PORT='$Port'; node scripts/serve-web.mjs '$OutputDir' *> '$logFile'"
  ) `
  -WorkingDirectory $mobileRoot `
  -WindowStyle Hidden

for ($attempt = 1; $attempt -le 15; $attempt++) {
  if (Test-PreviewPort) {
    Write-Host ""
    Write-Host "Staging preview running at http://localhost:$Port" -ForegroundColor Green
    Write-Host "Serving output folder: $OutputDir" -ForegroundColor Green
    Write-Host "Server log: apps/mobile/$logFile" -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Milliseconds 500
}

Write-Host ""
throw "The preview build finished, but the local server did not respond on port $Port. Check apps/mobile/$logFile."
