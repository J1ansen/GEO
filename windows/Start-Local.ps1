$ErrorActionPreference = 'Stop'
$geoRoot = Split-Path $PSScriptRoot -Parent
$geoRepo = Join-Path $geoRoot 'repos/Elmo'
Push-Location $geoRepo
try {
    if (-not (Test-Path -LiteralPath '.env')) { throw 'Run windows/Initialize-Config.ps1 first.' }
    & node --env-file=.env (Join-Path $PSScriptRoot 'check-db.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Database is not ready; see windows/README.txt.' }
    Set-Location (Join-Path $geoRepo 'apps/web')
    Write-Host 'Open http://localhost:3010/app/org/default/restaurants after Vite is ready.'
    Write-Host 'This starts only the local web app. Ctrl+C stops it.'
    & node --env-file=../../.env node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3010 --strictPort
    if ($LASTEXITCODE -ne 0) { throw 'Web app stopped with an error.' }
} finally { Pop-Location }
