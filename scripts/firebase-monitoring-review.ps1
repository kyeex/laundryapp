param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging",

  [int]$Limit = 50,

  [switch]$RunLogs,

  [switch]$AllowProduction
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebasercPath = Join-Path $root ".firebaserc"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command($Name, $Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "'$Name' was not found. $Hint"
  }
}

Set-Location $root

if (-not (Test-Path $firebasercPath)) {
  throw "Missing .firebaserc. Copy .firebaserc.example to .firebaserc and set project aliases."
}

$firebaserc = Get-Content -Raw -LiteralPath $firebasercPath | ConvertFrom-Json
$projectId = $firebaserc.projects.$Environment

if (-not $projectId -or $projectId -like "your-*") {
  throw "The '$Environment' project id in .firebaserc is missing or still a placeholder."
}

$functionsLogCommand = "npx firebase-tools functions:log --project `"$projectId`" --limit $Limit"

Write-Step "Monitoring review plan"
Write-Host "Environment: $Environment"
Write-Host "Firebase project: $projectId"
Write-Host "Function log limit: $Limit"
Write-Host ""
Write-Host "Firebase Console:"
Write-Host "https://console.firebase.google.com/project/$projectId/overview"
Write-Host ""
Write-Host "Cloud Functions:"
Write-Host "https://console.firebase.google.com/project/$projectId/functions"
Write-Host ""
Write-Host "Firestore usage:"
Write-Host "https://console.firebase.google.com/project/$projectId/firestore/usage"
Write-Host ""
Write-Host "Authentication users:"
Write-Host "https://console.firebase.google.com/project/$projectId/authentication/users"
Write-Host ""
Write-Host "Command:"
Write-Host $functionsLogCommand -ForegroundColor Yellow

if (-not $RunLogs) {
  Write-Host ""
  Write-Host "Dry run only. Add -RunLogs to read recent Cloud Functions logs." -ForegroundColor Green
  exit 0
}

if ($Environment -eq "production" -and -not $AllowProduction) {
  throw "Production log review requires -AllowProduction. This prevents accidental production access during routine work."
}

Assert-Command "npm" "Install Node.js/npm first."

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

Write-Step "Recent Cloud Functions logs"
npx firebase-tools functions:log --project $projectId --limit $Limit

if ($LASTEXITCODE -ne 0) {
  throw "Unable to read Firebase Functions logs."
}

Write-Step "Review complete"
