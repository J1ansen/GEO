param([string]$DatabaseUser = 'geo_local', [int]$DatabasePort = 5432)
$ErrorActionPreference = 'Stop'
$geoRoot = Split-Path $PSScriptRoot -Parent
$geoRepo = Join-Path $geoRoot 'repos/Elmo'
$geoTargets = @((Join-Path $geoRepo '.env'), (Join-Path $geoRepo 'apps/web/.env'))
foreach ($geoTarget in $geoTargets) {
    if (Test-Path -LiteralPath $geoTarget) { throw 'Configuration already exists. No files were changed.' }
}
if ($DatabasePort -lt 1 -or $DatabasePort -gt 65535) { throw 'Invalid database port.' }
$geoPassword = Read-Host 'Password for your LOCAL PostgreSQL account (not your web login)' -AsSecureString
$geoPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($geoPassword)
try {
    $geoPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($geoPointer)
    if ([string]::IsNullOrWhiteSpace($geoPlain)) { throw 'A database password is required.' }
    $geoUser = [Uri]::EscapeDataString($DatabaseUser)
    $geoEncoded = [Uri]::EscapeDataString($geoPlain)
    $geoRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $geoBytes = New-Object byte[] 32
        $geoRng.GetBytes($geoBytes)
        $geoAuth = [Convert]::ToBase64String($geoBytes)
        $geoRng.GetBytes($geoBytes)
        $geoEncryption = [Convert]::ToBase64String($geoBytes)
    } finally { $geoRng.Dispose() }
    $geoText = @"
DATABASE_URL=postgresql://${geoUser}:${geoEncoded}@127.0.0.1:${DatabasePort}/restaurant_p1
DEPLOYMENT_MODE=local
VITE_DEPLOYMENT_MODE=local
BETTER_AUTH_SECRET=$geoAuth
ELMO_ENCRYPTION_KEY=$geoEncryption
APP_URL=http://localhost:3010
VITE_APP_URL=http://localhost:3010
DISABLE_TELEMETRY=1
SCRAPE_TARGETS=stub:stub
ONBOARDING_LLM_TARGET=stub:stub
"@
    $geoUtf8 = New-Object System.Text.UTF8Encoding($false)
    foreach ($geoTarget in $geoTargets) { [IO.File]::WriteAllText($geoTarget, $geoText + "`n", $geoUtf8) }
    Write-Host 'Created two local configuration files with new keys. No database operation was performed.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($geoPointer)
    $geoPlain = $null
    $geoEncoded = $null
    $geoText = $null
    $geoPassword.Dispose()
}
