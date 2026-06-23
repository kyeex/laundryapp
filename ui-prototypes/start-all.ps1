$ErrorActionPreference = "Stop"

& "$PSScriptRoot\customer\start-preview.ps1"
& "$PSScriptRoot\merchant\start-preview.ps1"
& "$PSScriptRoot\driver\start-preview.ps1"

Write-Host ""
Write-Host "Customer prototype: http://127.0.0.1:4181/"
Write-Host "Merchant prototype: http://127.0.0.1:4182/"
Write-Host "Driver prototype: http://127.0.0.1:4183/"
