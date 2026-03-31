# PowerShell script to run database migration
# Run this in PowerShell: .\db\migrations\run_migration.ps1

$ErrorActionPreference = "Stop"

# Database configuration
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "eng_system"
$dbUser = "postgres"
$migrationFile = "tool_request_constraints.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Database Migration - Tool Request" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
try {
    $psqlPath = (Get-Command psql -ErrorAction Stop).Source
    Write-Host "✓ Found psql at: $psqlPath" -ForegroundColor Green
} catch {
    Write-Host "✗ psql not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add PostgreSQL bin directory to your PATH:" -ForegroundColor Yellow
    Write-Host "  Example: C:\Program Files\PostgreSQL\15\bin" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run the migration manually in pgAdmin:" -ForegroundColor Yellow
    Write-Host "  1. Open pgAdmin" -ForegroundColor Yellow
    Write-Host "  2. Connect to 'eng_system' database" -ForegroundColor Yellow
    Write-Host "  3. Open Query Tool" -ForegroundColor Yellow
    Write-Host "  4. Copy and paste contents from: $migrationFile" -ForegroundColor Yellow
    Write-Host "  5. Execute (F5)" -ForegroundColor Yellow
    exit 1
}

# Run migration
$migrationPath = Join-Path $PSScriptRoot $migrationFile

if (-not (Test-Path $migrationPath)) {
    Write-Host "✗ Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found migration file: $migrationPath" -ForegroundColor Green
Write-Host ""
Write-Host "Connecting to database: $dbName" -ForegroundColor Cyan
Write-Host "User: $dbUser" -ForegroundColor Cyan
Write-Host "Host: $dbHost:$dbPort" -ForegroundColor Cyan
Write-Host ""

# Prompt for password
$securePassword = Read-Host "Enter PostgreSQL password" -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential($dbUser, $securePassword)

Write-Host ""
Write-Host "Running migration..." -ForegroundColor Yellow
Write-Host ""

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $credential.GetNetworkCredential().Password

# Run psql
& psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationPath

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Migration completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Migration failed! Check errors above." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  1. Wrong password - try again" -ForegroundColor Yellow
    Write-Host "  2. Database doesn't exist - create 'eng_system' first" -ForegroundColor Yellow
    Write-Host "  3. Permission denied - run as postgres superuser" -ForegroundColor Yellow
    Write-Host "  4. Columns don't exist - run tool_request_workflow.sql first" -ForegroundColor Yellow
}

# Clear password from environment
$env:PGPASSWORD = $null
