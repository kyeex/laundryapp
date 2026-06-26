param(
  [ValidateSet("demo", "staging", "production")]
  [string]$Environment = "staging",

  [ValidateSet("all", "firestore", "functions")]
  [string]$Target = "all",

  [switch]$SkipFunctionsBuild
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebasercPath = Join-Path $root ".firebaserc"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "'$Name' was not found. Install Node.js/npm and run: npm run firebase:login"
  }
}

Set-Location $root

if (-not ($env:NODE_OPTIONS -like "*--use-system-ca*")) {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

Write-Step "Checking Firebase deployment prerequisites"
Assert-Command "npm"

if (-not (Test-Path $firebasercPath)) {
  throw "Missing .firebaserc. Copy .firebaserc.example to .firebaserc and replace the staging/production project ids."
}

$firebaserc = Get-Content -Raw -LiteralPath $firebasercPath | ConvertFrom-Json
$projectId = $firebaserc.projects.$Environment

if (-not $projectId -or $projectId -like "your-*") {
  throw "The '$Environment' project id in .firebaserc is missing or still a placeholder."
}

Write-Host "Using Firebase alias '$Environment' -> '$projectId'"

if (-not $SkipFunctionsBuild -and ($Target -eq "all" -or $Target -eq "functions")) {
  Write-Step "Building Cloud Functions"
  npm --prefix apps/functions run build

  if ($LASTEXITCODE -ne 0) {
    throw "Cloud Functions build failed."
  }
}

$deployOnly = switch ($Target) {
  "firestore" { "firestore" }
  "functions" { "functions" }
  default { "firestore,functions" }
}

Write-Step "Deploying $deployOnly to $Environment"
npx firebase-tools deploy --only $deployOnly --project $Environment

if ($LASTEXITCODE -ne 0) {
  throw "Firebase deploy failed for '$Environment' target '$deployOnly'."
}

Write-Step "Done"
