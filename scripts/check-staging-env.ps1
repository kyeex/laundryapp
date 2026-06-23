$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $root "apps/mobile/.env.staging"

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing apps/mobile/.env.staging"
}

$content = Get-Content -LiteralPath $envPath
$required = @(
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID"
)

$rows = foreach ($name in $required) {
  $line = $content | Where-Object { $_ -match "^$name=.+$" } | Select-Object -First 1
  [pscustomobject]@{
    Name = $name
    Filled = [bool]$line
  }
}

$rows | Format-Table -AutoSize

if (($rows | Where-Object { -not $_.Filled }).Count -gt 0) {
  throw "One or more staging Firebase environment values are missing."
}

Write-Host ""
Write-Host "Staging env is present and filled." -ForegroundColor Green
