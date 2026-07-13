$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
  $env:PATH = "$dockerBin;$env:PATH"
}

Write-Host "Checking Docker daemon..."
$ready = $false
for ($i = 1; $i -le 60; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  throw "Docker daemon is not ready. Start Docker Desktop first; if WSL was just installed, restart Windows."
}

Write-Host "Starting PostGIS..."
docker compose up -d postgres

Write-Host "Waiting for Postgres on port 5432..."
for ($i = 1; $i -le 60; $i++) {
  $conn = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
  if ($conn) { break }
  Start-Sleep -Seconds 2
}

Write-Host "Applying migrations and seed data..."
pnpm db:migrate
pnpm db:seed

Write-Host "Syncing Caltrans San Francisco public cameras..."
pnpm cameras:sync:caltrans

Write-Host "Running ingestion and deterministic demo..."
pnpm ingest:once
pnpm demo:run

Write-Host "Starting API and web if they are not already running..."
New-Item -ItemType Directory -Force -Path ".logs" | Out-Null
if (-not (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "pnpm.cmd" -ArgumentList "--filter","@road-reality/api","dev" -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput "$repo\.logs\api.log" -RedirectStandardError "$repo\.logs\api.err.log"
}
if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath "pnpm.cmd" -ArgumentList "--filter","@road-reality/web","dev" -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput "$repo\.logs\web.log" -RedirectStandardError "$repo\.logs\web.err.log"
}
$workerProcess = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*@road-reality/worker*" -or $_.CommandLine -like "*apps\\worker\\src\\index.ts worker*" } |
  Select-Object -First 1
if (-not $workerProcess) {
  Start-Process -FilePath "pnpm.cmd" -ArgumentList "--filter","@road-reality/worker","worker" -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput "$repo\.logs\worker.log" -RedirectStandardError "$repo\.logs\worker.err.log"
}

Start-Sleep -Seconds 5
Write-Host "Health:"
Invoke-RestMethod -Uri "http://localhost:4000/health" | ConvertTo-Json -Depth 5
Write-Host "Connectors:"
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/connectors" | ConvertTo-Json -Depth 5
Write-Host "Discrepancies:"
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/discrepancies" | ConvertTo-Json -Depth 5

Write-Host "Verytis is ready: http://localhost:3000"
