param([switch]$TestData)
$ErrorActionPreference = 'Stop'
$geoRepo = Split-Path $PSScriptRoot -Parent
$geoEnv = if ($TestData) { '.env.p1-test' } else { '.env' }
Push-Location $geoRepo
try {
    if (-not (Test-Path -LiteralPath $geoEnv)) { throw 'Local environment file is missing.' }
    $env:GEO_PROJECT_ROOT = $geoRepo
    Write-Host 'Keep the P1 web terminal running so the local WSL database remains available.'
    Write-Host 'Only website/channel checks start; AI browser queries require a separate reviewed P0 run.'
    & node "--env-file=$geoEnv" --import tsx apps/worker/src/geo-index.ts
    if ($LASTEXITCODE -ne 0) { throw 'GEO worker stopped before becoming ready.' }
} finally { Pop-Location }
