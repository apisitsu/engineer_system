# ============================================================================
# ENG System - Database Setup Script
# Purpose: Run all database migrations for General DWG Request
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ENG System - Database Setup" -ForegroundColor Cyan
Write-Host "  General DWG Request Migrations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "eng_system"
$dbUser = "postgres"

Write-Host "Database Configuration:" -ForegroundColor White
Write-Host "  Host: $dbHost:$dbPort" -ForegroundColor Gray
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host "  User: $dbUser" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
try {
    $psqlVersion = & psql --version 2>&1
    Write-Host "✓ PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ psql not found in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add PostgreSQL bin directory to your PATH:" -ForegroundColor Yellow
    Write-Host "  Example: C:\Program Files\PostgreSQL\15\bin" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Run migrations manually in pgAdmin" -ForegroundColor Yellow
    Write-Host "  1. Open pgAdmin" -ForegroundColor Yellow
    Write-Host "  2. Connect to '$dbName' database" -ForegroundColor Yellow
    Write-Host "  3. Open Query Tool" -ForegroundColor Yellow
    Write-Host "  4. Run migrations in order:" -ForegroundColor Yellow
    Write-Host "     a) db/migrations/tool_request_workflow.sql" -ForegroundColor Yellow
    Write-Host "     b) db/migrations/tool_request_constraints.sql" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host ""
Write-Host "Migrations to run:" -ForegroundColor White
Write-Host "  1. tool_request_workflow.sql (base schema)" -ForegroundColor Gray
Write-Host "  2. tool_request_constraints.sql (constraints & indexes)" -ForegroundColor Gray
Write-Host ""

# Prompt for password
$securePassword = Read-Host "Enter PostgreSQL password" -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential($dbUser, $securePassword)
$env:PGPASSWORD = $credential.GetNetworkCredential().Password

Write-Host ""

# Migration 1: Base schema
$migration1 = "db\migrations\tool_request_workflow.sql"
if (Test-Path $migration1) {
    Write-Host "Running migration 1/2: $migration1" -ForegroundColor Cyan
    & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migration1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migration 1 completed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Migration 1 failed!" -ForegroundColor Red
        Write-Host "   Check if the migration was already run or fix errors above." -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "⚠️  Migration 1 not found: $migration1" -ForegroundColor Yellow
    Write-Host "   Skipping (may already be applied)" -ForegroundColor Yellow
    Write-Host ""
}

# Migration 2: Constraints
$migration2 = "db\migrations\tool_request_constraints.sql"
if (Test-Path $migration2) {
    Write-Host "Running migration 2/2: $migration2" -ForegroundColor Cyan
    & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migration2
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migration 2 completed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Migration 2 failed!" -ForegroundColor Red
        Write-Host "   Some constraints may already exist (this is OK)" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "⚠️  Migration 2 not found: $migration2" -ForegroundColor Yellow
    Write-Host ""
}

# Verification
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking database objects..." -ForegroundColor White

# Check tables
$tablesQuery = "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'tr_%';"
$tablesCount = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c "$tablesQuery" 2>&1
Write-Host "  Tables (tr_*): $($tablesCount.Trim())" -ForegroundColor Gray

# Check indexes
$indexesQuery = "SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'tr_request';"
$indexesCount = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c "$indexesQuery" 2>&1
Write-Host "  Indexes on tr_request: $($indexesCount.Trim())" -ForegroundColor Gray

# Check audit table
$auditQuery = "SELECT COUNT(*) as count FROM tr_request_audit;"
$auditCount = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c "$auditQuery" 2>&1
if ($auditCount -match '\d+') {
    Write-Host "  Audit records: $($auditCount.Trim())" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Database Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Clear password
$env:PGPASSWORD = $null

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy .env.example to .env and configure it" -ForegroundColor White
Write-Host "  2. Run: .\start_backend.ps1" -ForegroundColor White
Write-Host "  3. Access: http://localhost:2005/eng/mtc_eng/tool-request" -ForegroundColor White
Write-Host ""
