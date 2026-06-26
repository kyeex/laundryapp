param(
  [int]$Port = 8128,
  [string]$OutputDir = "dist-route-check-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$mobileRoot = Join-Path $root "apps/mobile"
$outputPath = Join-Path $mobileRoot $OutputDir
$logFile = "route-refresh-$Port.log"
$errorLogFile = "route-refresh-$Port.err.log"
$routes = @(
  "/",
  "/sign-in",
  "/new-order",
  "/orders",
  "/batches",
  "/users",
  "/demo-control",
  "/my-orders/demo-order/track"
)

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-PreviewPort() {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port" -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-PreviewPort) {
  throw "Port $Port is already serving an app. Run with another port, for example: npm run test:routes:refresh -- -Port 8130"
}

if (Test-Path -LiteralPath $outputPath) {
  $resolvedOutputPath = Resolve-Path -LiteralPath $outputPath
  $resolvedMobileRoot = Resolve-Path -LiteralPath $mobileRoot

  if (-not $resolvedOutputPath.Path.StartsWith($resolvedMobileRoot.Path)) {
    throw "Refusing to delete output path outside apps/mobile: $resolvedOutputPath"
  }

  Remove-Item -Recurse -Force -LiteralPath $resolvedOutputPath.Path
}

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

Write-Step "Exporting web build for direct-route refresh checks"
Set-Location $mobileRoot
npx expo export --platform web --output-dir $OutputDir

Write-Step "Starting preview server with SPA fallback"
$env:PORT = "$Port"
$process = Start-Process -FilePath "node" `
  -ArgumentList @("scripts/serve-web.mjs", $OutputDir) `
  -WorkingDirectory $mobileRoot `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorLogFile `
  -WindowStyle Hidden `
  -PassThru

try {
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    if (Test-PreviewPort) {
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not (Test-PreviewPort)) {
    throw "Preview server did not respond on port $Port. Check apps/mobile/$logFile."
  }

  Write-Step "Checking direct route refreshes"
  foreach ($route in $routes) {
    $uri = "http://localhost:$Port$route"
    $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 5

    if ($response.StatusCode -ne 200) {
      throw "$route returned status $($response.StatusCode)"
    }

    if (-not ($response.Content -match "<html|<div id=`"root`"|_expo/static/js")) {
      throw "$route did not return the exported app shell."
    }

    Write-Host "PASS $route" -ForegroundColor Green
  }
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    Wait-Process -Id $process.Id -Timeout 5 -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }

  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -Recurse -Force -LiteralPath $outputPath -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $outputPath) {
      Write-Host "Warning: route test output is still locked and was left at $outputPath" -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "Direct route refresh checks passed." -ForegroundColor Green
