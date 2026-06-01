param(
    [string]$HostAddress = '127.0.0.1',
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$phpCommand = Get-Command php -ErrorAction SilentlyContinue
if (-not $phpCommand) {
    Write-Error "PHP was not found on PATH. Install PHP 8+ or add php.exe to PATH, then try again."
    exit 1
}

$phpExe = $phpCommand.Source

# Many bundles (e.g., UniServerZ) ship multiple INIs. The CLI INI often has PDO MySQL enabled.
$phpInfo = & $phpExe -i 2>$null
$iniLine = $phpInfo | Select-String -Pattern '^Loaded Configuration File\s*=>\s*' | Select-Object -First 1
$iniPath = $null
if ($iniLine) {
    $iniPath = ($iniLine.Line -split '=>', 2)[1].Trim()
}

$iniArgs = @()
if ($iniPath -and $iniPath -ne '(none)' -and (Test-Path $iniPath)) {
    $iniArgs = @('-c', $iniPath)
}

Write-Host "Project root: $projectRoot"
Write-Host "PHP: $phpExe"
if ($iniArgs.Count -gt 0) {
    Write-Host "Using php.ini: $iniPath"
} else {
    Write-Host "Using default php.ini resolution (no explicit -c)."
}
Write-Host "Serving: http://$HostAddress`:$Port"
Write-Host "API: http://$HostAddress`:$Port/api/products.php"
Write-Host ''

Set-Location $projectRoot
& $phpExe @iniArgs -S "$HostAddress`:$Port" -t .
