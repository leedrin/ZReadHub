param(
  [int]$StaticPort = 4173,
  [int]$AdminPort = 4174
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param([int]$Port)
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) {
    Write-Host "Port ${Port}: no listening process"
    return
  }
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $pids) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Port ${Port}: stopped PID $processId"
    } catch {
      Write-Warning "Port ${Port}: failed to stop PID $processId ($($_.Exception.Message))"
    }
  }
}

Stop-PortProcess -Port $StaticPort
Stop-PortProcess -Port $AdminPort
