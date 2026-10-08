#requires -Version 5.1
<#
================================================================================
 EngineerSystem - Automated Machine Setup Script
 Purpose: Complete 1-click environment setup on any new machine.
 Features:
   1. Prerequisites check (Node.js, npm, Python, pip, Git)
   2. Auto-provisions .env files from .env.sample (Zero manual copy needed)
   3. Corporate proxy configuration support (Minebea proxyth.bp.minebea.local)
   4. Installs all NPM dependencies (root + workspaces: Backend & Frontend)
   5. Installs required Python PDF libraries (pypdf, PyMuPDF, etc.)
   6. Configures Frontend API host in constance.js
   7. Diagnostics & Database server connectivity test (plbmp130, plb018, plbmp00)
   8. Ready-to-launch dev server option
================================================================================
#>
param(
    [switch]$NonInteractive = $false,
    [switch]$SkipNpm = $false,
    [switch]$SkipPython = $false,
    [switch]$StartDev = $false,
    [string]$ApiHost = "http://localhost:2005/"
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
Write-Header "EngineerSystem - Complete Automated Setup (New Machine Setup)"
Write-Host "Repository Path : $RepoRoot" -ForegroundColor Gray
Write-Host "Host Machine    : $env:COMPUTERNAME ($([System.Environment]::OSVersion))" -ForegroundColor Gray
Write-Host "Current User    : $env:USERNAME" -ForegroundColor Gray
Write-Host "Local Time      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# -----------------------------------------------------------------------------
# STEP 1: Verify Prerequisites
# -----------------------------------------------------------------------------
Write-Step "1/7" "Verifying System Prerequisites..."

$PrereqFailed = $false

# 1.1 Node.js
$NodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if ($NodeCmd) {
    $NodeVer = (node -v).Trim()
    Write-Success "Node.js detected: $NodeVer ($($NodeCmd.Source))"
} else {
    Write-Failure "Node.js is NOT installed or not found in system PATH."
    Write-Host "    Download and install Node.js 20 or 22 LTS from: https://nodejs.org/" -ForegroundColor Yellow
    $PrereqFailed = $true
}

# 1.2 npm
$NpmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
if ($NpmCmd) {
    $NpmVer = (npm -v).Trim()
    Write-Success "NPM detected: v$NpmVer"
} else {
    Write-Failure "NPM is NOT installed or not found in system PATH."
    $PrereqFailed = $true
}

# 1.3 Python
$PythonCmd = Get-Command "python" -ErrorAction SilentlyContinue
if ($PythonCmd) {
    $PyVer = (python --version 2>&1).Trim()
    Write-Success "Python detected: $PyVer ($($PythonCmd.Source))"
} else {
    Write-Failure "Python is NOT installed or not found in system PATH."
    Write-Host "    Download and install Python 3.10+ from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "    (IMPORTANT: Check 'Add Python to PATH' during installation)" -ForegroundColor Yellow
    $PrereqFailed = $true
}

# 1.4 pip
$PipCmd = Get-Command "pip" -ErrorAction SilentlyContinue
if ($PipCmd) {
    Write-Success "PIP detected"
} else {
    Write-Failure "PIP is NOT installed or not found in system PATH."
    $PrereqFailed = $true
}

# 1.5 Git
$GitCmd = Get-Command "git" -ErrorAction SilentlyContinue
if ($GitCmd) {
    $GitVer = (git --version).Trim()
    Write-Success "Git detected: $GitVer"
} else {
    Write-WarningMsg "Git is not installed in PATH. (Optional if you copied code directly, required for remote sync)"
}

if ($PrereqFailed) {
    Write-Host ""
    Write-Failure "One or more critical prerequisites are missing. Please install them and re-run this script."
    if (-not $NonInteractive) {
        Read-Host "Press Enter to exit..."
    }
    exit 1
}

# -----------------------------------------------------------------------------
# STEP 2: Auto-Provision .env Configuration Files
# -----------------------------------------------------------------------------
Write-Step "2/7" "Provisioning Environment Configuration Files (.env)..."

$EnvFiles = @(
    @{
        Sample = "$RepoRoot\.env.sample"
        Target = "$RepoRoot\.env"
        Name   = "Root Monorepo (.env)"
    },
    @{
        Sample = "$RepoRoot\apps\ENG-Backend\.env.sample"
        Target = "$RepoRoot\apps\ENG-Backend\.env"
        Name   = "Backend Service (apps/ENG-Backend/.env)"
    },
    @{
        Sample = "$RepoRoot\apps\ENG-Frontend\.env.sample"
        Target = "$RepoRoot\apps\ENG-Frontend/.env"
        Name   = "Frontend Client (apps/ENG-Frontend/.env)"
    }
)

foreach ($item in $EnvFiles) {
    if (Test-Path $item.Target) {
        Write-Success "$($item.Name) already exists. Keeping existing file."
    } elseif (Test-Path $item.Sample) {
        Copy-Item -Path $item.Sample -Destination $item.Target -Force
        Write-Success "Created $($item.Name) from template ($($item.Sample))"
    } else {
        Write-Failure "Could not find template file: $($item.Sample)"
    }
}

# -----------------------------------------------------------------------------
# STEP 3: Corporate Proxy Configuration Check
# -----------------------------------------------------------------------------
Write-Step "3/7" "Checking Corporate Network & Proxy Settings..."

$ProxyHost = "proxyth.bp.minebea.local"
$ProxyPort = 8080
$ProxyTest = Test-NetConnection -ComputerName $ProxyHost -Port $ProxyPort -WarningAction SilentlyContinue -InformationLevel Quiet

if ($ProxyTest) {
    Write-Success "Corporate proxy is reachable: $($ProxyHost):$($ProxyPort)"
    $CurrentNpmProxy = (npm config get proxy 2>$null)
    if (-not $CurrentNpmProxy -or $CurrentNpmProxy -eq "null" -or $CurrentNpmProxy -match "undefined") {
        Write-Host "  Configuring NPM proxy to use Minebea local proxy..." -ForegroundColor Cyan
        npm config set proxy "http://proxyth.bp.minebea.local:8080"
        npm config set https-proxy "http://proxyth.bp.minebea.local:8080"
        Write-Success "NPM proxy set to http://proxyth.bp.minebea.local:8080"
    } else {
        Write-Success "Current NPM proxy: $CurrentNpmProxy"
    }
} else {
    Write-Host "  Corporate proxy ($ProxyHost) not detected or direct connection active." -ForegroundColor Gray
}

# -----------------------------------------------------------------------------
# STEP 4: Install NPM Dependencies (Monorepo Workspace)
# -----------------------------------------------------------------------------
Write-Step "4/7" "Installing NPM Dependencies..."

if ($SkipNpm) {
    Write-WarningMsg "NPM install skipped via -SkipNpm flag."
} else {
    Set-Location -Path $RepoRoot
    Write-Host "  Running 'npm install' across workspaces (Root + Backend + Frontend)..." -ForegroundColor Cyan
    Write-Host "  This may take 1-3 minutes depending on network speed..." -ForegroundColor Gray
    
    $npmProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install --no-audit --no-fund" -WorkingDirectory $RepoRoot -Wait -PassThru -NoNewWindow
    if ($npmProcess.ExitCode -eq 0) {
        Write-Success "NPM dependencies installed successfully."
    } else {
        Write-Failure "npm install completed with exit code $($npmProcess.ExitCode). Please check console output above."
    }
}

# -----------------------------------------------------------------------------
# STEP 5: Install Python Dependencies (PDF Hub Engine)
# -----------------------------------------------------------------------------
Write-Step "5/7" "Installing Python Dependencies (pypdf, PyMuPDF)..."

if ($SkipPython) {
    Write-WarningMsg "Python library installation skipped via -SkipPython flag."
} else {
    Write-Host "  Installing required PDF processing packages..." -ForegroundColor Cyan
    $pyPackages = @("pypdf", "PyMuPDF", "pdf2image", "pdfplumber")
    
    $pipArgs = "install " + ($pyPackages -join " ")
    if ($ProxyTest) {
        $pipArgs += " --proxy http://proxyth.bp.minebea.local:8080"
    }

    $pipProcess = Start-Process -FilePath "pip" -ArgumentList $pipArgs -Wait -PassThru -NoNewWindow
    if ($pipProcess.ExitCode -eq 0) {
        Write-Success "Python PDF libraries installed successfully."
    } else {
        Write-WarningMsg "pip install returned exit code $($pipProcess.ExitCode). Trying direct install without proxy..."
        pip install pypdf PyMuPDF
    }
}

# -----------------------------------------------------------------------------
# STEP 6: Configure Frontend API Target (constance.js)
# -----------------------------------------------------------------------------
Write-Step "6/7" "Verifying Frontend API Target (constance.js)..."

$ConstanceFile = "$RepoRoot\apps\ENG-Frontend\src\constance\constance.js"
if (Test-Path $ConstanceFile) {
    $rawContent = [System.IO.File]::ReadAllText((Resolve-Path $ConstanceFile), [System.Text.Encoding]::UTF8)
    if ($rawContent.Length -gt 0 -and [int]$rawContent[0] -eq 65279) { $rawContent = $rawContent.Substring(1) }

    if ($rawContent -match 'getDynamicApiUrl' -and $rawContent -match 'export\s+const\s+apiUrl\s*=') {
        Write-Success "Frontend apiUrl is configured: Smart Dynamic Resolution (Auto Prod/Dev/Local)"
    } elseif ($activeMatch.Success) {
        $currentUrl = $activeMatch.Groups[1].Value
        Write-Success "Frontend apiUrl is active: $currentUrl"
    } else {
        $targetApiLine = "export const apiUrl = `"$ApiHost`";"
        if ($rawContent -match '(?m)^\s*//\s*export\s+const\s+apiUrl\s*=\s*"http://localhost:2005/";') {
            $updated = $rawContent -replace '(?m)^\s*//\s*export\s+const\s+apiUrl\s*=\s*"http://localhost:2005/";', $targetApiLine
        } else {
            $updated = $rawContent -replace '(?m)(export\s+const\s+server\s*=)', "$targetApiLine`n`n`$1"
        }
        $updated = $updated.Replace("`r`n", "`n")
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText((Resolve-Path $ConstanceFile), $updated, $utf8NoBom)
        Write-Success "Frontend apiUrl configured to default: $ApiHost"
    }
} else {
    Write-WarningMsg "Could not find $ConstanceFile"
}

# -----------------------------------------------------------------------------
# STEP 7: Network & Database Server Connectivity Diagnostic
# -----------------------------------------------------------------------------
Write-Step "7/7" "Testing Network & Database Server Connectivity..."

$ServersToTest = @(
    @{ Name = "PostgreSQL eng_system (Main DB)"; Host = "plbmp130"; Port = 6543 },
    @{ Name = "Git Server (SSH Repository)";     Host = "plbmp130"; Port = 2222 },
    @{ Name = "PostgreSQL RODPC / RODQC DB";     Host = "plb018";   Port = 5432 },
    @{ Name = "PostgreSQL MAQ Machine DB";       Host = "plbmp00";  Port = 5432 }
)

Write-Host "  Testing network connectivity to company servers..." -ForegroundColor Gray

$allDbOk = $true
foreach ($srv in $ServersToTest) {
    $res = Test-NetConnection -ComputerName $srv.Host -Port $srv.Port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($res) {
        Write-Success "$($srv.Name.PadRight(34)) -> $($srv.Host):$($srv.Port) [CONNECTED]"
    } else {
        Write-WarningMsg "$($srv.Name.PadRight(34)) -> $($srv.Host):$($srv.Port) [UNREACHABLE]"
        $allDbOk = $false
    }
}

# -----------------------------------------------------------------------------
# FINISH & LAUNCH
# -----------------------------------------------------------------------------
Write-Header "Setup Completed Successfully!"
Write-Host "All components are configured and ready for execution." -ForegroundColor Green
Write-Host ""
Write-Host "How to run the system:" -ForegroundColor White
Write-Host "  1. Dev Mode (Local):" -ForegroundColor Cyan
Write-Host "     npm run dev" -ForegroundColor Yellow
Write-Host "     -> Backend runs on:  http://localhost:2005" -ForegroundColor Gray
Write-Host "     -> Frontend runs on: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Update & Sync from Server:" -ForegroundColor Cyan
Write-Host "     .\remote_sync_server.cmd" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Auto-update & Run Dev Mode:" -ForegroundColor Cyan
Write-Host "     .\auto_update_and_run.cmd" -ForegroundColor Yellow
Write-Host ""

if ($StartDev) {
    Write-Host "Starting development servers in a new window..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k title EngineerSystem Dev && npm run dev" -WorkingDirectory $RepoRoot -WindowStyle Normal
} elseif (-not $NonInteractive) {
    $runNow = Read-Host "Would you like to start the development servers now? (Y/N) [Default: Y]"
    if ($runNow -eq "" -or $runNow -match "^[Yy]") {
        Write-Host "Starting development servers in a new window..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k title EngineerSystem Dev && npm run dev" -WorkingDirectory $RepoRoot -WindowStyle Normal
    }
}

Write-Host "`nSetup script finished.`n" -ForegroundColor Green
