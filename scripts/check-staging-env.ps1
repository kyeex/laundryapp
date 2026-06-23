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

function Get-CleanEnvValue($Value) {
  $cleanValue = $Value.Trim()

  if (
    ($cleanValue.StartsWith('"') -and $cleanValue.EndsWith('"')) -or
    ($cleanValue.StartsWith("'") -and $cleanValue.EndsWith("'"))
  ) {
    return $cleanValue.Substring(1, $cleanValue.Length - 2)
  }

  return $cleanValue
}

$rows = foreach ($name in $required) {
  $line = $content | Where-Object { $_ -match "^$name=.+$" } | Select-Object -First 1
  $rawValue = if ($line) { ($line -split "=", 2)[1].Trim() } else { "" }
  $cleanValue = Get-CleanEnvValue $rawValue

  [pscustomobject]@{
    Name = $name
    Filled = [bool]$cleanValue
    WrappedInQuotes = $rawValue.StartsWith('"') -or $rawValue.StartsWith("'")
  }
}

$rows | Format-Table -AutoSize

if (($rows | Where-Object { -not $_.Filled }).Count -gt 0) {
  throw "One or more staging Firebase environment values are missing."
}

if (($rows | Where-Object { $_.WrappedInQuotes }).Count -gt 0) {
  Write-Host ""
  Write-Host "Some values are wrapped in quotes. The preview script will clean them, but removing the quotes from apps/mobile/.env.staging is recommended." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Staging env is present and filled." -ForegroundColor Green
