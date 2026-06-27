param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging",

  [string]$AdminEmail = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$firebasercPath = Join-Path $root ".firebaserc"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
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

Write-Step "Admin recovery plan"
Write-Host "Environment: $Environment"
Write-Host "Firebase project: $projectId"

if ($AdminEmail) {
  Write-Host "Admin email to search: $AdminEmail"
} else {
  Write-Host "Admin email to search: not provided"
}

Write-Host ""
Write-Host "Firebase Auth users:"
Write-Host "https://console.firebase.google.com/project/$projectId/authentication/users"
Write-Host ""
Write-Host "Firestore users collection:"
Write-Host "https://console.firebase.google.com/project/$projectId/firestore/databases/-default-/data/~2Fusers"
Write-Host ""
Write-Host "Required Firestore role fields for users/{uid}:"
Write-Host '{'
Write-Host '  "role": "admin",'
Write-Host '  "active": true'
Write-Host '}'
Write-Host ""
Write-Host "Runbook:"
Write-Host "docs/ADMIN_RECOVERY_PROCESS.md"
Write-Host ""
Write-Host "This helper is read-only. It does not create users or modify Firestore." -ForegroundColor Green
