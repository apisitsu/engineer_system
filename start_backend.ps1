# ============================================================================
# ENG System - Quick Start Script
# Purpose: Start backend server for General DWG Request System
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ENG System - Backend Server" -ForegroundColor Cyan
Write-Host "  General DWG Request (MTC Engineering)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
$backendDir = "C:\Users\lble485\Eng_Sys\apps\ENG-Backend"
Set-Location $backendDir

Write-Host "Directory: $backendDir" -ForegroundColor Gray
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "   Copy .env.example to .env and configure it first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Command: copy .env.example .env" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "✓ Configuration found (.env)" -ForegroundColor Green

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  Dependencies not installed. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ npm install failed!" -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Check file upload directory
$uploadDir = Join-Path $backendDir "files\tool_requests"
if (-not (Test-Path $uploadDir)) {
    Write-Host "Creating upload directory: $uploadDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
}

Write-Host "✓ Upload directory ready" -ForegroundColor Green
Write-Host ""

# Display server info
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Server Information:" -ForegroundColor White
Write-Host "  - URL: http://localhost:2005" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:2005/eng/mtc_eng/tool-request" -ForegroundColor White
Write-Host "  - API Docs: apps/ENG-Backend/api/engineer/mtc/API_DOCUMENTATION.md" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start server
npm start
