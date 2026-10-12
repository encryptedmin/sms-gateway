#Requires -RunAsAdministrator

[CmdletBinding()]
param(
    [string]$Hostname = "sms.ite"
)

$hostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
$escapedHostname = [Regex]::Escape($Hostname)
$existingEntry = Get-Content -LiteralPath $hostsPath | Where-Object {
    $_ -match "^\s*127\.0\.0\.1\s+.*(?:\s|^)$escapedHostname(?:\s|$)"
}

if ($existingEntry) {
    Write-Host "$Hostname already points to 127.0.0.1."
    exit 0
}

Add-Content `
    -LiteralPath $hostsPath `
    -Value "`r`n127.0.0.1`t$Hostname`t# SMS Gateway local hostname"

Clear-DnsClientCache
Write-Host "Installed local hostname: http://$Hostname"
