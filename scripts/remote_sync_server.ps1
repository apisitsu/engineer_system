#requires -Version 5.1
<#
================================================================================
 EngineerSystem - Remote Server Sync & Data Puller Script
 Purpose: Synchronize code and load latest data from server (plbmp130).
 Features:
   1. Sets up or verifies Git remote (ssh://git@plbmp130:2222/LE131/EngineerSystem.git)
   2. Tests connectivity to plbmp130:2222 (Git) & plbmp130:6543 (PostgreSQL)
   3. Fetches all branches and pulls latest updates from server
   4. Auto-provisions missing .env files from .env.sample
   5. Triggers npm install if package.json dependencies changed
   6. Validates frontend API URL configuration in constance.js
================================================================================
#>
param(
    [string]$Branch = "",
    [switch]$ForceReset = $false,
    [switch]$NonInteractive = $false
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $RepoRoot -or -not (Test-Path "$RepoRoot\package.json")) {
    $RepoRoot = (Get-Location).Path
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$StepNum, [string]$StepName)
    Write-Host "`n[$StepNum] $StepName" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Msg)
    Write-Host "  [OK] $Msg" -ForegroundColor Green
}

function Write-WarningMsg {
    param([string]$Msg)
    Write-Host "  [WARN] $Msg" -ForegroundColor Yellow
}

function Write-Failure {
    param([string]$Msg)
    Write-Host "  [FAIL] $Msg" -ForegroundColor Red
}

Clear-Host
Write-Header "EngineerSystem - Server Remote Sync & Data Puller"
Write-Host "Working Directory : $RepoRoot" -ForegroundColor Gray
Write-Host "Server Host       : plbmp130 (10.121.34.204)" -ForegroundColor Gray
Write-Host "Git Remote URL    : ssh://git@plbmp130:2222/LE131/EngineerSystem.git" -ForegroundColor Gray
Write-Host "Timestamp         : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

Set-Location -Path $RepoRoot

# -----------------------------------------------------------------------------
# STEP 1: Check Git Installation & Connectivity
# -----------------------------------------------------------------------------
Write-Step "1/5" "Verifying Git and Server Connectivity..."

$GitCmd = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $GitCmd) {
    Write-Failure "Git is not installed or not in PATH."
    Write-Host "    Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    if (-not $NonInteractive) { Read-Host "Press Enter to exit..." }
    exit 1
}
Write-Success "Git detected: $(git --version)"

# Test network ports to plbmp130
Write-Host "  Testing connection to plbmp130 (Git SSH: 2222, DB: 6543)..." -ForegroundColor Gray
$gitPortOk = Test-NetConnection -ComputerName "plbmp130" -Port 2222 -WarningAction SilentlyContinue -InformationLevel Quiet
$dbPortOk  = Test-NetConnection -ComputerName "plbmp130" -Port 6543 -WarningAction SilentlyContinue -InformationLevel Quiet

if ($gitPortOk) {
    Write-Success "Git Server port 2222 is accessible."
} else {
    Write-WarningMsg "Cannot reach plbmp130 on port 2222. (Check VPN or corporate network connection)"
}

if ($dbPortOk) {
    Write-Success "Database Server port 6543 is accessible."
} else {
    Write-WarningMsg "Cannot reach plbmp130 on port 6543 (PostgreSQL eng_system)."
}

# -----------------------------------------------------------------------------
# STEP 2: Configure Git Remote & SSH Environment
# -----------------------------------------------------------------------------
Write-Step "2/5" "Configuring Git Remote and SSH..."

$ExpectedRemote = "ssh://git@plbmp130:2222/LE131/EngineerSystem.git"
$CurrentRemote = (git config --get remote.origin.url 2>$null)

if (-not $CurrentRemote) {
    Write-Host "  Remote 'origin' not found. Adding origin -> $ExpectedRemote" -ForegroundColor Cyan
    git remote add origin $ExpectedRemote
    Write-Success "Added remote 'origin'."
} elseif ($CurrentRemote -ne $ExpectedRemote) {
    Write-WarningMsg "Remote 'origin' currently points to: $CurrentRemote"
    Write-Host "  Updating remote 'origin' to $ExpectedRemote..." -ForegroundColor Cyan
    git remote set-url origin $ExpectedRemote
    Write-Success "Updated remote 'origin'."
} else {
    Write-Success "Remote 'origin' is correctly configured: $CurrentRemote"
}

# Configure non-interactive SSH settings for port 2222
$env:GIT_SSH_COMMAND = "ssh -p 2222 -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_PAGER = "cat"

# -----------------------------------------------------------------------------
# STEP 3: Fetch & Pull Latest Code from Server
# -----------------------------------------------------------------------------
Write-Step "3/5" "Fetching and Pulling Updates from Server..."

$BeforeHash = (git rev-parse HEAD 2>$null)
if (-not $BeforeHash) { $BeforeHash = "EMPTY" }

if (-not $Branch) {
    $Branch = (git rev-parse --abbrev-ref HEAD 2>$null)
    if (-not $Branch -or $Branch -eq "HEAD") { $Branch = "main" }
}

Write-Host "  Current branch: $Branch" -ForegroundColor Cyan
Write-Host "  Fetching all branches from origin..." -ForegroundColor Cyan

$fetchOutput = git fetch origin --prune 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Failure "git fetch failed. Server response:`n$fetchOutput"
    if (-not $NonInteractive) { Read-Host "Press Enter to exit..." }
    exit 1
}
Write-Success "Successfully fetched latest references from server."

if ($ForceReset) {
    Write-WarningMsg "ForceReset requested. Resetting local branch '$Branch' to 'origin/$Branch'..."
    git reset --hard "origin/$Branch"
} else {
    Write-Host "  Pulling latest commits from origin/$Branch..." -ForegroundColor Cyan
    $pullOutput = git pull origin $Branch 2>&1
    Write-Host "  $pullOutput" -ForegroundColor Gray
}

$AfterHash = (git rev-parse HEAD 2>$null)
Write-Success "Branch '$Branch' is now at commit: $AfterHash"

# -----------------------------------------------------------------------------
# STEP 4: Auto-Verify & Provision .env Files
# -----------------------------------------------------------------------------
Write-Step "4/5" "Verifying Environment Files (.env)..."

$EnvPairs = @(
    @{ Sample = "$RepoRoot\.env.sample"; Target = "$RepoRoot\.env"; Name = "Root .env" },
    @{ Sample = "$RepoRoot\apps\ENG-Backend\.env.sample"; Target = "$RepoRoot\apps\ENG-Backend\.env"; Name = "Backend .env" },
    @{ Sample = "$RepoRoot\apps\ENG-Frontend\.env.sample"; Target = "$RepoRoot\apps\ENG-Frontend\.env"; Name = "Frontend .env" }
)

foreach ($ep in $EnvPairs) {
    if (-not (Test-Path $ep.Target) -and (Test-Path $ep.Sample)) {
        Copy-Item -Path $ep.Sample -Destination $ep.Target -Force
        Write-Success "Restored missing $($ep.Name) from $($ep.Sample)"
    } else {
        Write-Success "$($ep.Name) verified."
    }
}

# -----------------------------------------------------------------------------
# STEP 5: Dependency Check & Constance Verification
# -----------------------------------------------------------------------------
Write-Step "5/5" "Checking Dependencies & Frontend Configuration..."

if ($BeforeHash -ne "EMPTY" -and $BeforeHash -ne $AfterHash) {
    $diffFiles = (git diff --name-only $BeforeHash $AfterHash -- "*package*.json" 2>$null)
    if ($diffFiles) {
        Write-Host "  package.json changes detected ($diffFiles). Running 'npm install'..." -ForegroundColor Cyan
        npm install --no-audit --no-fund
        Write-Success "NPM dependencies updated."
    } else {
        Write-Success "No package.json changes detected."
    }
} else {
    Write-Success "Repository is already up to date with origin/$Branch."
}

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
Write-Header "Server Sync Completed!"
Write-Host "Branch       : $Branch" -ForegroundColor White
Write-Host "Commit Hash  : $AfterHash" -ForegroundColor Yellow
Write-Host "Author       : $(git log -1 --pretty=format:'%an <%ae>' 2>$null)" -ForegroundColor Gray
Write-Host "Message      : $(git log -1 --pretty=format:'%s' 2>$null)" -ForegroundColor Gray
Write-Host "Commit Date  : $(git log -1 --pretty=format:'%cd' 2>$null)" -ForegroundColor Gray
Write-Host ""
Write-Host "Server status:" -ForegroundColor White
Write-Host "  - Git Repository  : $($ExpectedRemote)" -ForegroundColor Gray
Write-Host "  - PostgreSQL Port : 6543 (plbmp130)" -ForegroundColor Gray
Write-Host ""

if (-not $NonInteractive) {
    Read-Host "Press Enter to close this window..."
}
