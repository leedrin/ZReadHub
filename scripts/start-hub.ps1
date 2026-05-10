param(
  [int]$StaticPort = 4173,
  [int]$AdminPort = 4174,
  [string]$BindHost = "127.0.0.1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-PortInUse {
  param([int]$Port)
  try {
    $hit = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return $null -ne $hit
  } catch {
    return $false
  }
}

function Resolve-PythonExe {
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  if (Get-Command python3 -ErrorAction SilentlyContinue) { return "python3" }
  throw "Python not found. Please install Python 3 first."
}

function Wait-HttpReady {
  param([string]$Url, [int]$TimeoutSec = 20)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 300
  }
  return $false
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

if (Test-PortInUse -Port $StaticPort) {
  throw "Static port $StaticPort is already in use on $BindHost."
}
if (Test-PortInUse -Port $AdminPort) {
  throw "Admin port $AdminPort is already in use on $BindHost."
}

$pythonExe = Resolve-PythonExe

$staticProc = $null
$adminProc = $null
$logDir = Join-Path $rootDir "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$staticOut = Join-Path $logDir "hub-static.out.log"
$staticErr = Join-Path $logDir "hub-static.err.log"
$adminOut = Join-Path $logDir "hub-admin.out.log"
$adminErr = Join-Path $logDir "hub-admin.err.log"

try {
  $staticProc = Start-Process -FilePath $pythonExe `
    -ArgumentList "-m", "http.server", $StaticPort, "--bind", $BindHost `
    -WorkingDirectory $rootDir `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $staticOut `
    -RedirectStandardError $staticErr

  $adminProc = Start-Process -FilePath "node" `
    -ArgumentList (Join-Path $rootDir "hub\admin-server.mjs") `
    -WorkingDirectory $rootDir `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $adminOut `
    -RedirectStandardError $adminErr

  $siteUrl = "http://$BindHost`:$StaticPort/hub/index.html"
  $adminHealth = "http://$BindHost`:$AdminPort/health"

  $siteOk = Wait-HttpReady -Url $siteUrl
  $adminOk = Wait-HttpReady -Url $adminHealth

  if (-not $siteOk) { throw "Static site failed to start: $siteUrl" }
  if (-not $adminOk) { throw "Admin API failed to start: $adminHealth" }

  Write-Host ""
  Write-Host "Wiki Hub started successfully." -ForegroundColor Green
  Write-Host "Site : $siteUrl"
  Write-Host "Admin: $adminHealth"
  Write-Host "Static PID: $($staticProc.Id)"
  Write-Host "Admin  PID: $($adminProc.Id)"
  Write-Host ""
  Write-Host "Press Ctrl+C to stop both services."

  while ($true) {
    if ($staticProc.HasExited) { throw "Static server exited unexpectedly." }
    if ($adminProc.HasExited) {
      $errText = ""
      if (Test-Path $adminErr) { $errText = (Get-Content $adminErr -Raw) }
      if (-not $errText -and (Test-Path $adminOut)) { $errText = (Get-Content $adminOut -Raw) }
      if ($errText) {
        throw "Admin server exited unexpectedly. Details: $errText"
      }
      throw "Admin server exited unexpectedly."
    }
    Start-Sleep -Seconds 1
  }
} finally {
  foreach ($proc in @($staticProc, $adminProc)) {
    if ($null -ne $proc) {
      try {
        if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
      } catch {}
    }
  }
}
