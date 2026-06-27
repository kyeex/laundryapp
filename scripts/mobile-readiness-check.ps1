param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$mobileRoot = Join-Path $root "apps/mobile"
$appJsonPath = Join-Path $mobileRoot "app.json"
$easJsonPath = Join-Path $mobileRoot "eas.json"
$envCheckScript = Join-Path $root "scripts/check-staging-env.ps1"
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Add-Failure($Message) {
  $failures.Add($Message) | Out-Null
  Write-Host "FAIL  $Message" -ForegroundColor Red
}

function Add-Warning($Message) {
  $warnings.Add($Message) | Out-Null
  Write-Host "WARN  $Message" -ForegroundColor Yellow
}

function Add-Pass($Message) {
  Write-Host "PASS  $Message" -ForegroundColor Green
}

Write-Step "Checking mobile project files"
foreach ($path in @($appJsonPath, $easJsonPath)) {
  if (Test-Path -LiteralPath $path) {
    Add-Pass "$([IO.Path]::GetFileName($path)) exists"
  } else {
    Add-Failure "Missing $path"
  }
}

if ($failures.Count -eq 0) {
  $appConfig = Get-Content -LiteralPath $appJsonPath -Raw | ConvertFrom-Json
  $easConfig = Get-Content -LiteralPath $easJsonPath -Raw | ConvertFrom-Json

  Write-Step "Checking native identifiers"
  if ($appConfig.expo.android.package) {
    Add-Pass "Android package: $($appConfig.expo.android.package)"
  } else {
    Add-Failure "Android package id is missing in apps/mobile/app.json"
  }

  if ($appConfig.expo.ios.bundleIdentifier) {
    Add-Pass "iOS bundle id: $($appConfig.expo.ios.bundleIdentifier)"
  } else {
    Add-Failure "iOS bundle identifier is missing in apps/mobile/app.json"
  }

  $easProjectId = $appConfig.expo.extra.eas.projectId
  if (-not $easProjectId -or $easProjectId -eq "REPLACE_WITH_EAS_PROJECT_ID") {
    Add-Failure "EAS project id is not linked. Run EAS init/login before cloud builds."
  } else {
    Add-Pass "EAS project id is linked"
  }

  Write-Step "Checking EAS build profiles"
  $profileName = if ($Environment -eq "staging") { "preview" } else { "production" }
  $profile = $easConfig.build.$profileName

  if ($profile) {
    Add-Pass "EAS '$profileName' profile exists"
  } else {
    Add-Failure "Missing EAS '$profileName' build profile"
  }

  if ($Environment -eq "staging") {
    if ($profile.android.buildType -eq "apk") {
      Add-Pass "Android staging build type is APK for easy real-device install"
    } else {
      Add-Warning "Android staging build type is '$($profile.android.buildType)'; APK is easiest for first real-device QA."
    }

    if ($profile.env.EXPO_PUBLIC_APP_ENV -eq "staging") {
      Add-Pass "Preview build is marked as staging"
    } else {
      Add-Failure "Preview build EXPO_PUBLIC_APP_ENV should be staging"
    }
  }
}

Write-Step "Checking $Environment environment file"
try {
  & $envCheckScript -Environment $Environment
  Add-Pass "$Environment environment values passed repo validation"
} catch {
  Add-Failure $_.Exception.Message
}

Write-Step "Checking local EAS login"
try {
  Push-Location $mobileRoot
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
  $whoamiOutput = & npx eas-cli whoami --non-interactive 2>&1
  $exitCode = $LASTEXITCODE
  Pop-Location

  if ($exitCode -eq 0) {
    Add-Pass "EAS CLI logged in as $whoamiOutput"
  } else {
    Add-Warning "EAS CLI is not logged in. Run: cd apps/mobile; npx eas-cli login"
  }
} catch {
  try { Pop-Location } catch {}
  Add-Warning "Could not confirm EAS login: $($_.Exception.Message)"
}

Write-Step "Mobile readiness summary"
Write-Host "Failures: $($failures.Count)"
Write-Host "Warnings: $($warnings.Count)"

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Fix failures before starting a cloud Android/iOS build." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Mobile readiness preflight passed. Warnings may still require action before real-device QA." -ForegroundColor Green
