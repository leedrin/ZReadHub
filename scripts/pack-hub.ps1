param(
  [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $rootDir "dist"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$bundleName = "wikihub-bundle"
$stageDir = Join-Path $OutputDir $bundleName
if (Test-Path $stageDir) { Remove-Item -Path $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$includePaths = @(
  "hub",
  "hub-data",
  "scripts\start-hub.ps1",
  "scripts\start-hub.sh",
  "scripts\pack-hub.ps1",
  "scripts\pack-hub.sh",
  "README-HUB.md",
  "test-page.html"
)

foreach ($item in $includePaths) {
  $src = Join-Path $rootDir $item
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $stageDir $item
  $parent = Split-Path -Parent $dst
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -Path $src -Destination $dst -Recurse -Force
}

$zipPath = Join-Path $OutputDir "${bundleName}.zip"
if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }
Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Package created successfully." -ForegroundColor Green
Write-Host "ZIP: $zipPath"
Write-Host ""
