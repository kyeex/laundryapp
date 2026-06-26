param(
  [ValidateSet("staging", "production", "all")]
  [string]$Environment = "staging",

  [switch]$DeployRules,

  [switch]$DeployFunctions,

  [switch]$AllowProductionDeploy
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

function Test-Environment($Name) {
  Write-Step "Checking $Name environment variables"
  Invoke-CheckedCommand "npm" @("run", "env:$Name`:check")
}

function Deploy-Target($Name, $Target) {
  if ($Name -eq "production" -and -not $AllowProductionDeploy) {
    throw "Production deploy requested without -AllowProductionDeploy. Re-run intentionally after staging passes."
  }

  Write-Step "Deploying $Target to $Name"
  Invoke-CheckedCommand "npm" @("run", "deploy:$Name`:$Target")
}

Set-Location $root

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

$environments = if ($Environment -eq "all") {
  @("staging", "production")
} else {
  @($Environment)
}

Write-Step "Running Cloud Functions build"
Invoke-CheckedCommand "npm" @("run", "check:functions")

foreach ($envName in $environments) {
  Test-Environment $envName
}

if ($DeployRules) {
  foreach ($envName in $environments) {
    Deploy-Target $envName "firestore"
  }
}

if ($DeployFunctions) {
  foreach ($envName in $environments) {
    Deploy-Target $envName "functions"
  }
}

Write-Step "Phase 8 readiness check complete"
Write-Host "Rules deploy requested: $DeployRules" -ForegroundColor DarkGray
Write-Host "Functions deploy requested: $DeployFunctions" -ForegroundColor DarkGray
Write-Host "Production deploy allowed: $AllowProductionDeploy" -ForegroundColor DarkGray
