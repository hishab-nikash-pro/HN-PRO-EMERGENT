$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$backendExe = Join-Path $backendDir ".venv\Scripts\uvicorn.exe"

function Test-PortListening {
    param([int]$Port)
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count -gt 0
}

Write-Host "Starting Hishab Nikash Pro..." -ForegroundColor Cyan

$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService) {
    if ($mongoService.Status -ne "Running") {
        Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
        Start-Service -Name "MongoDB"
    } else {
        Write-Host "MongoDB is already running." -ForegroundColor Green
    }
} else {
    Write-Host "MongoDB service not found. Make sure MongoDB is installed or use Atlas." -ForegroundColor Yellow
}

if (-not (Test-Path $backendExe)) {
    throw "Backend virtual environment is missing. Run: cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
}

if (-not (Test-PortListening -Port 8001)) {
    Write-Host "Starting backend on port 8001..." -ForegroundColor Cyan
    Start-Process -FilePath $backendExe -ArgumentList "server:app --host 0.0.0.0 --port 8001 --reload" -WorkingDirectory $backendDir
} else {
    Write-Host "Backend already appears to be running on port 8001." -ForegroundColor Green
}

if (-not (Test-PortListening -Port 3000)) {
    Write-Host "Starting frontend on port 3000..." -ForegroundColor Cyan
    Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory $frontendDir
} else {
    Write-Host "Frontend already appears to be running on port 3000." -ForegroundColor Green
}

Write-Host ""
Write-Host "Open this in your browser:" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:3000"
Write-Host ""
Write-Host "If the page does not open, wait 20-30 seconds and refresh." -ForegroundColor Gray
