$ErrorActionPreference = "Stop"
$ProjectPath = $PSScriptRoot
$LogFile = "$ProjectPath\update_progress_live.log"

# Clean old log
if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
Start-Transcript -Path $LogFile -Force

try {
    Set-Location -Path $ProjectPath

    Write-Host "Fetching from origin..." -ForegroundColor Cyan
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin main failed with exit code $LASTEXITCODE" }

    $LocalHash = git rev-parse HEAD
    $RemoteHash = git rev-parse origin/main

    if ($LocalHash -eq $RemoteHash) {
        Write-Host "No updates found on main branch. Exiting." -ForegroundColor Yellow
        node apps\ENG-Backend\scripts\log_update.js "NO_UPDATE" "No updates found on main branch" "$LocalHash" "$RemoteHash"
    } else {
        Write-Host "Update found. Resetting local repository to match origin/main..." -ForegroundColor Cyan
        git reset --hard origin/main
        if ($LASTEXITCODE -ne 0) { throw "git reset --hard origin/main failed with exit code $LASTEXITCODE" }

        # Update LocalHash after pull
        $NewLocalHash = git rev-parse HEAD

        $ConstFile = "apps\ENG-Frontend\src\constance\constance.js"
        if (Test-Path $ConstFile) {
            $ConstContent = Get-Content -Path $ConstFile -Raw
            
            # 1. Comment out all active exports of apiUrl
            $UpdatedContent = $ConstContent -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
            
            # 2. Uncomment the specific one for plbmp130
            $UpdatedContent = $UpdatedContent -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";', '$1export const apiUrl = "http://plbmp130:2005/";'
            
            if ($ConstContent -ne $UpdatedContent) {
                Write-Host "Modifying constance.js to use http://plbmp130:2005/..." -ForegroundColor Green
                Set-Content -Path $ConstFile -Value $UpdatedContent -Encoding UTF8
            } else {
                Write-Host "constance.js is already configured correctly for plbmp130." -ForegroundColor Green
            }
        } else {
            Write-Host "Could not find $ConstFile. Skipping file update." -ForegroundColor Yellow
        }

        Write-Host "Stopping existing development server processes on ports 2005 and 3000..." -ForegroundColor Cyan
        $Ports = @(2005, 3000)
        foreach ($Port in $Ports) {
            $PIDs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
            if ($PIDs) {
                foreach ($PidValue in $PIDs) {
                    Write-Host "Killing process with PID $PidValue on port $Port" -ForegroundColor Yellow
                    Stop-Process -Id $PidValue -Force -ErrorAction SilentlyContinue
                }
            }
        }

        Write-Host "Starting npm run dev in a new window..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal

        Write-Host "Process completed successfully! Logging UPDATE_SUCCESS..." -ForegroundColor Green
        node apps\ENG-Backend\scripts\log_update.js "UPDATE_SUCCESS" "System updated and restarted successfully" "$LocalHash" "$NewLocalHash"
    }
} catch {
    $ErrorMsg = $_.Exception.Message
    Write-Host "An error occurred during execution:`n$ErrorMsg" -ForegroundColor Red
    node apps\ENG-Backend\scripts\log_update.js "ERROR" "$ErrorMsg" "" ""
} finally {
    Write-Host "`nThis window will close in 10 seconds..." -ForegroundColor Magenta
    Stop-Transcript
    Start-Sleep -Seconds 10
}
