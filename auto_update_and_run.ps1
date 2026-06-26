$ErrorActionPreference = "Stop"
$ProjectPath = "D:\97_Projects\00_System\EngineerSystem"
Set-Location -Path $ProjectPath

Write-Host "Fetching from origin..."
git fetch origin main

$LocalHash = git rev-parse HEAD
$RemoteHash = git rev-parse origin/main

if ($LocalHash -eq $RemoteHash) {
    Write-Host "No updates found on main branch. Exiting."
    exit 0
}

Write-Host "Update found. Pulling latest code..."
git pull origin main

$ConstFile = "apps\ENG-Frontend\src\constance\constance.js"
if (Test-Path $ConstFile) {
    $ConstContent = Get-Content -Path $ConstFile -Raw
    
    # 1. Comment out all active exports of apiUrl
    $UpdatedContent = $ConstContent -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
    
    # 2. Uncomment the specific one for plbmp130
    $UpdatedContent = $UpdatedContent -replace '(?m)^(\s*)//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";', '$1export const apiUrl = "http://plbmp130:2005/";'
    
    if ($ConstContent -ne $UpdatedContent) {
        Write-Host "Modifying constance.js to use http://plbmp130:2005/..."
        Set-Content -Path $ConstFile -Value $UpdatedContent -Encoding UTF8
    } else {
        Write-Host "constance.js is already configured correctly for plbmp130."
    }
} else {
    Write-Host "Could not find $ConstFile. Skipping file update."
}

Write-Host "Stopping existing development server processes on ports 2005 and 3000..."
$Ports = @(2005, 3000)
foreach ($Port in $Ports) {
    $Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($Process) {
        Write-Host "Killing process with PID $Process on port $Port"
        Stop-Process -Id $Process -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Starting npm run dev in a new window..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $ProjectPath -WindowStyle Normal

Write-Host "Process completed successfully!"
