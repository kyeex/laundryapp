$ErrorActionPreference = "Stop"

function Assert-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required for Firebase emulator tests. $InstallHint"
  }
}

Assert-Command "npm" "Install Node.js/npm first."
Assert-Command "java" "Install Java 21 or newer, then reopen PowerShell so java is on PATH."

$javaVersionOutput = cmd /c "java -version 2>&1"
$javaVersionText = ($javaVersionOutput | Out-String).Trim()

if (-not $javaVersionText) {
  throw "Java was found, but its version could not be read."
}

Write-Host "Firebase emulator prerequisites are available." -ForegroundColor Green
Write-Host $javaVersionText
