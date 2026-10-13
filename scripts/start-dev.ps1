[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "gateway-backend"
$frontendRoot = Join-Path $repoRoot "frontend"
$envFile = Join-Path $repoRoot ".env"
$envExample = Join-Path $repoRoot ".env.example"
$runner = Join-Path $PSScriptRoot "run-dev-service.ps1"

function Stop-Startup {
    param([string]$Message)

    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Invoke-Checked {
    param(
        [string]$Description,
        [scriptblock]$Command
    )

    Write-Host $Description -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Stop-Startup "$Description failed (exit code $LASTEXITCODE)."
    }
}

Set-Location $repoRoot
Write-Host "SMS Gateway - native development startup" -ForegroundColor Green
Write-Host "Repository: $repoRoot"

if (-not (Test-Path -LiteralPath $envFile)) {
    if (-not (Test-Path -LiteralPath $envExample)) {
        Stop-Startup ".env.example is missing."
    }

    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-Host "Created .env from .env.example." -ForegroundColor Yellow
}

$pythonCandidates = @(
    (Join-Path $backendRoot ".venv\Scripts\python.exe"),
    (Join-Path $backendRoot "venv\Scripts\python.exe")
)
$python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $python) {
    $preferredVenv = Join-Path $backendRoot ".venv"
    $pyLauncher = Get-Command "py.exe" -ErrorAction SilentlyContinue
    $systemPython = Get-Command "python.exe" -ErrorAction SilentlyContinue

    Write-Host "Creating the backend virtual environment..." -ForegroundColor Yellow
    if ($pyLauncher) {
        & $pyLauncher.Source -3 -m venv $preferredVenv
    }
    elseif ($systemPython) {
        & $systemPython.Source -m venv $preferredVenv
    }
    else {
        Stop-Startup "Python 3 is not installed or is not available on PATH."
    }

    if ($LASTEXITCODE -ne 0) {
        Stop-Startup "Python could not create the virtual environment."
    }
    $python = Join-Path $preferredVenv "Scripts\python.exe"
}

$requirements = Join-Path $backendRoot "requirements.txt"
$requirementsHash = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash
$venvRoot = Split-Path -Parent (Split-Path -Parent $python)
$requirementsMarker = Join-Path $venvRoot ".requirements.sha256"
$installedRequirementsHash = if (Test-Path -LiteralPath $requirementsMarker) {
    (Get-Content -LiteralPath $requirementsMarker -Raw).Trim()
}
else {
    ""
}

& $python -c "import celery, django, redis, serial" 2>$null
$backendImportsReady = $LASTEXITCODE -eq 0
if (-not $backendImportsReady -or $installedRequirementsHash -ne $requirementsHash) {
    Invoke-Checked "Installing backend dependencies..." {
        & $python -m pip install -r $requirements
    }
    Set-Content -LiteralPath $requirementsMarker -Value $requirementsHash
}

$npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npm) {
    Stop-Startup "Node.js/npm is not installed or npm.cmd is not available on PATH."
}

$vite = Join-Path $frontendRoot "node_modules\.bin\vite.cmd"
$packageLock = Join-Path $frontendRoot "package-lock.json"
$packageHash = (Get-FileHash -LiteralPath $packageLock -Algorithm SHA256).Hash
$packageMarker = Join-Path $frontendRoot "node_modules\.package-lock.sha256"
$installedPackageHash = if (Test-Path -LiteralPath $packageMarker) {
    (Get-Content -LiteralPath $packageMarker -Raw).Trim()
}
else {
    ""
}

if (-not (Test-Path -LiteralPath $vite) -or $installedPackageHash -ne $packageHash) {
    Invoke-Checked "Installing frontend dependencies..." {
        Push-Location $frontendRoot
        try {
            & $npm.Source install
        }
        finally {
            Pop-Location
        }
    }
    Set-Content -LiteralPath $packageMarker -Value $packageHash
}

try {
    $nativeProcesses = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.CommandLine -match "(?i)manage\.py\s+runserver" -or
        $_.CommandLine -match "(?i)celery.*-A\s+core\s+(worker|beat)" -or
        $_.CommandLine -match "(?i)(npm\.cmd\s+run\s+dev|node.*vite)"
    })
    if ($nativeProcesses.Count -gt 0) {
        Stop-Startup "A native Django, Celery, or Vite process is already running. Close its terminal before running this launcher again."
    }
}
catch {
    Write-Warning "Could not inspect existing native processes; continuing with port checks."
}

$frontendPort = 80
$sitePortLine = Get-Content -LiteralPath $envFile |
    Where-Object { $_ -match "^\s*SMS_SITE_PORT\s*=\s*\d+\s*$" } |
    Select-Object -First 1
if ($sitePortLine -and $sitePortLine -match "(\d+)") {
    $frontendPort = [int]$Matches[1]
}

try {
    $portsToCheck = @(8000, $frontendPort) | Select-Object -Unique
    foreach ($port in $portsToCheck) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
            Stop-Startup "TCP port $port is already in use. Stop the program using it and run the launcher again."
        }
    }
}
catch {
    Write-Warning "Could not check whether the backend and frontend ports are available."
}

$docker = Get-Command "docker.exe" -ErrorAction SilentlyContinue
if (-not $docker) {
    Stop-Startup "Docker Desktop is required to run Redis and docker.exe is not available on PATH."
}

& $docker.Source compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Stop-Startup "Docker Compose is unavailable. Start or install Docker Desktop."
}

$runningServices = @(& $docker.Source compose ps --services --status running 2>$null)
if ($LASTEXITCODE -ne 0) {
    Stop-Startup "Docker Desktop is not responding. Start it and wait for the engine to be ready."
}

$nativeConflicts = @("backend", "worker", "beat", "frontend", "messenger") |
    Where-Object { $runningServices -contains $_ }
if ($nativeConflicts.Count -gt 0) {
    Stop-Startup ("The full Docker stack is already running ({0}). Run 'docker compose down' before starting the native stack." -f ($nativeConflicts -join ", "))
}

Invoke-Checked "Starting Redis in Docker..." {
    & $docker.Source compose up -d redis
}

Write-Host "Waiting for Redis to become healthy..." -ForegroundColor Cyan
$redisReady = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    $redisReply = & $docker.Source compose exec -T redis redis-cli ping 2>$null
    if ($LASTEXITCODE -eq 0 -and $redisReply -match "PONG") {
        $redisReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $redisReady) {
    Stop-Startup "Redis did not become ready within 30 seconds. Check 'docker compose logs redis'."
}

Invoke-Checked "Applying database migrations..." {
    Push-Location $backendRoot
    try {
        & $python manage.py migrate --noinput
    }
    finally {
        Pop-Location
    }
}

$services = @("backend", "worker", "beat", "frontend")
foreach ($service in $services) {
    $arguments = "-NoLogo -NoExit -ExecutionPolicy Bypass -File `"$runner`" -Service $service"
    Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $repoRoot
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Started four terminal windows:" -ForegroundColor Green
Write-Host "  1. Django backend       http://127.0.0.1:8000"
Write-Host "  2. Celery worker        sends queued SMS"
Write-Host "  3. Celery Beat          releases scheduled SMS"
Write-Host "  4. React frontend       http://sms.ite"
Write-Host ""
Write-Host "Redis is running in Docker. Close each terminal or press Ctrl+C in it to stop that service."
