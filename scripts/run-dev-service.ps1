[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet("backend", "worker", "beat", "frontend")]
    [string]$Service
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "gateway-backend"
$frontendRoot = Join-Path $repoRoot "frontend"

$titles = @{
    backend  = "SMS Gateway - Django Backend"
    worker   = "SMS Gateway - Celery Worker"
    beat     = "SMS Gateway - Celery Beat"
    frontend = "SMS Gateway - React Frontend"
}
$Host.UI.RawUI.WindowTitle = $titles[$Service]

$pythonCandidates = @(
    (Join-Path $backendRoot ".venv\Scripts\python.exe"),
    (Join-Path $backendRoot "venv\Scripts\python.exe")
)
$python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($Service -ne "frontend" -and -not $python) {
    Write-Host "No backend virtual environment was found." -ForegroundColor Red
    exit 1
}

Write-Host "Starting $($titles[$Service])..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop this service." -ForegroundColor DarkGray
Write-Host ""

switch ($Service) {
    "backend" {
        Set-Location $backendRoot
        & $python manage.py runserver 127.0.0.1:8000
    }
    "worker" {
        Set-Location $backendRoot
        & $python -m celery -A core worker --pool=threads --concurrency=2 -l info
    }
    "beat" {
        Set-Location $backendRoot
        $scheduleFile = Join-Path $env:TEMP "sms-gateway-celerybeat-schedule"
        & $python -m celery -A core beat -l info --schedule $scheduleFile
    }
    "frontend" {
        Set-Location $frontendRoot
        & npm.cmd run dev
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "$($titles[$Service]) stopped with exit code $LASTEXITCODE." -ForegroundColor Red
}
