param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging",

  [string]$Bucket = "",

  [string]$Prefix = "",

  [switch]$RunExport,

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

if (-not $Bucket) {
  $Bucket = "laundryapp-$Environment-firestore-backups"
}

if (-not $Prefix) {
  $timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
  $Prefix = "manual-$timestamp"
}

$destination = "gs://$Bucket/$Prefix"
$exportCommand = "gcloud firestore export `"$destination`" --project `"$projectId`""

Write-Step "Firestore export plan"
Write-Host "Environment: $Environment"
Write-Host "Firebase project: $projectId"
Write-Host "Destination: $destination"
Write-Host ""
Write-Host "Command:"
Write-Host $exportCommand -ForegroundColor Yellow

if (-not $RunExport) {
  Write-Host ""
  Write-Host "Dry run only. Add -RunExport to execute the export." -ForegroundColor Green
  exit 0
}

if ($Environment -eq "production" -and -not $AllowProduction) {
  throw "Production export requires -AllowProduction. This prevents accidental production operations."
}

Assert-Command "gcloud" "Install Google Cloud CLI and run 'gcloud auth login' first."

Write-Step "Starting Firestore export"
& gcloud firestore export $destination --project $projectId

if ($LASTEXITCODE -ne 0) {
  throw "Firestore export failed."
}

Write-Step "Export requested"
Write-Host "Check Google Cloud Console for export status:"
Write-Host "Project: $projectId"
Write-Host "Bucket path: $destination"
