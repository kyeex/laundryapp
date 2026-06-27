param(
  [ValidateSet("staging", "production", "all")]
  [string]$Environment = "production",

  [switch]$SkipRegression
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-CheckedCommand($Command, $Arguments) {
  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($Arguments -join ' ')"
  }
}

function Invoke-NpmScript($ScriptName) {
  Invoke-CheckedCommand "npm" @("run", $ScriptName)
}

function Invoke-PlanScript($ScriptPath, $Arguments) {
  & powershell -ExecutionPolicy Bypass -File $ScriptPath @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $ScriptPath $($Arguments -join ' ')"
  }
}

Set-Location $root

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

$targetEnvironments = if ($Environment -eq "all") {
  @("staging", "production")
} else {
  @($Environment)
}

Write-Step "Production hardening gate"
Write-Host "Environment target: $Environment"
Write-Host "Regression skipped: $SkipRegression"

Write-Step "Cloud Functions build"
Invoke-NpmScript "check:functions"

foreach ($envName in $targetEnvironments) {
  Write-Step "Environment verification: $envName"
  Invoke-NpmScript "env:$envName`:check"

  Write-Step "Backup dry run: $envName"
  Invoke-PlanScript ".\scripts\firestore-backup-export.ps1" @(
    "-Environment",
    $envName
  )

  Write-Step "Monitoring review dry run: $envName"
  Invoke-PlanScript ".\scripts\firebase-monitoring-review.ps1" @(
    "-Environment",
    $envName
  )

  Write-Step "Admin recovery drill: $envName"
  Invoke-PlanScript ".\scripts\admin-recovery-plan.ps1" @(
    "-Environment",
    $envName
  )
}

if (-not $SkipRegression) {
  Write-Step "Security and regression check"
  Invoke-NpmScript "test:emulator"
} else {
  Write-Host ""
  Write-Host "Regression was skipped. Run npm run test:emulator before release." -ForegroundColor Yellow
}

Write-Step "Phase 6 hardening gate complete"
Write-Host "Review docs/PRODUCTION_HARDENING_PHASE_6.md before any production release." -ForegroundColor Green
