param(
  [ValidateSet("demo", "staging", "production")]
  [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFileName = ".env.$Environment"
$envPath = Join-Path $root "apps/mobile/$envFileName"

if ($Environment -eq "demo" -and -not (Test-Path -LiteralPath $envPath)) {
  $envFileName = ".env.demo.example"
  $envPath = Join-Path $root "apps/mobile/$envFileName"
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing apps/mobile/$envFileName"
}

$required = @(
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
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

function Read-EnvValues($Path) {
  $values = @{}
  $rawValues = @{}

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmedLine = $line.Trim()

    if (-not $trimmedLine -or $trimmedLine.StartsWith("#")) {
      continue
    }

    if ($trimmedLine -match "^([^=]+)=(.*)$") {
      $name = $Matches[1].Trim()
      $rawValue = $Matches[2].Trim()
      $rawValues[$name] = $rawValue
      $values[$name] = Get-CleanEnvValue $rawValue
    }
  }

  return @{
    Values = $values
    RawValues = $rawValues
  }
}

function Assert-NotPlaceholder($Name, $Value) {
  if ($Value -match "^(replace|todo|changeme|your-|example)" -or $Value -match "placeholder") {
    throw "$Name still looks like a placeholder in apps/mobile/$envFileName."
  }
}

$envData = Read-EnvValues $envPath
$values = $envData.Values
$rawValues = $envData.RawValues

$rows = foreach ($name in $required) {
  $rawValue = if ($rawValues.ContainsKey($name)) { $rawValues[$name] } else { "" }
  $cleanValue = if ($values.ContainsKey($name)) { $values[$name] } else { "" }

  [pscustomobject]@{
    Name = $name
    Filled = [bool]$cleanValue
    WrappedInQuotes = $rawValue.StartsWith('"') -or $rawValue.StartsWith("'")
  }
}

Write-Host ""
Write-Host "Checking apps/mobile/$envFileName" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

if (
  $Environment -eq "demo" -and
  $envFileName -eq ".env.demo.example"
) {
  $requiredDemoFields = @("EXPO_PUBLIC_APP_ENV", "EXPO_PUBLIC_FIREBASE_PROJECT_ID")
  foreach ($name in $requiredDemoFields) {
    if (-not $values[$name]) {
      throw "$name is required in apps/mobile/$envFileName."
    }
  }
} elseif (($rows | Where-Object { -not $_.Filled }).Count -gt 0) {
  throw "One or more $Environment environment values are missing."
}

if ($Environment -ne "demo") {
  foreach ($name in $required) {
    Assert-NotPlaceholder $name $values[$name]
  }
}

$actualAppEnv = $values["EXPO_PUBLIC_APP_ENV"].ToLowerInvariant()
if ($actualAppEnv -ne $Environment) {
  throw "EXPO_PUBLIC_APP_ENV must be '$Environment' in apps/mobile/$envFileName. Found '$($values["EXPO_PUBLIC_APP_ENV"])'."
}

$projectId = $values["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]
if ($Environment -eq "demo" -and $projectId -match "(prod|production|staging|stage)") {
  throw "Demo Firebase project id '$projectId' looks like a staging or production project."
}

if ($Environment -eq "staging" -and $projectId -match "(prod|production)") {
  throw "Staging Firebase project id '$projectId' looks like a production project."
}

if ($Environment -eq "production") {
  if ($projectId -match "(staging|stage|demo)") {
    throw "Production Firebase project id '$projectId' looks like a non-production project."
  }

  $stagingEnvPath = Join-Path $root "apps/mobile/.env.staging"
  if (Test-Path -LiteralPath $stagingEnvPath) {
    $stagingData = Read-EnvValues $stagingEnvPath
    $stagingProjectId = $stagingData.Values["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]

    if ($stagingProjectId -and $stagingProjectId -eq $projectId) {
      throw "Production and staging are using the same Firebase project id. They must be separate projects."
    }
  }
}

$envFilesToCompare = @("demo", "staging", "production") | Where-Object { $_ -ne $Environment }
foreach ($otherEnvironment in $envFilesToCompare) {
  $otherPath = Join-Path $root "apps/mobile/.env.$otherEnvironment"

  if ($otherEnvironment -eq "demo" -and -not (Test-Path -LiteralPath $otherPath)) {
    $otherPath = Join-Path $root "apps/mobile/.env.demo.example"
  }

  if (Test-Path -LiteralPath $otherPath) {
    $otherData = Read-EnvValues $otherPath
    $otherProjectId = $otherData.Values["EXPO_PUBLIC_FIREBASE_PROJECT_ID"]

    if ($otherProjectId -and $projectId -and $otherProjectId -eq $projectId) {
      throw "$Environment and $otherEnvironment are using the same Firebase project id '$projectId'. They must be separate projects."
    }
  }
}

$stripeKey = $values["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"]
if (($Environment -eq "demo" -or $Environment -eq "staging") -and $stripeKey.StartsWith("pk_live_")) {
  throw "$Environment is using a live Stripe publishable key. Use a Stripe test key for non-production."
}

if ($Environment -eq "staging" -and -not $stripeKey.StartsWith("pk_test_")) {
  throw "Staging Stripe publishable key should start with pk_test_. Copy the test publishable key from Stripe Dashboard > Developers > API keys."
}

if ($Environment -eq "production" -and $stripeKey.StartsWith("pk_test_")) {
  throw "Production is using a Stripe test publishable key. Use a live key before production launch."
}

if (($rows | Where-Object { $_.WrappedInQuotes }).Count -gt 0) {
  Write-Host ""
  Write-Host "Some values are wrapped in quotes. The preview script will clean them, but removing the quotes from apps/mobile/$envFileName is recommended." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "$Environment env is present, separated, and filled." -ForegroundColor Green
Write-Host "Firebase project id: $projectId" -ForegroundColor DarkGray
