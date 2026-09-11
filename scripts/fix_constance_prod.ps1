param(
    [string]$ConstancePath = ""
)

# Fix constance.js to use production apiUrl (plbmp130)
# Automatically resolves relative paths from repo root if executed from scripts directory or elsewhere.

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
}

$RepoRoot = Split-Path -Parent $ScriptDir
if (-not (Test-Path (Join-Path $RepoRoot "apps\ENG-Frontend"))) {
    $RepoRoot = (Get-Location).Path
}

if (-not $ConstancePath) {
    $ConstancePath = Join-Path $RepoRoot "apps\ENG-Frontend\src\constance\constance.js"
} elseif (-not (Test-Path $ConstancePath)) {
    $candidate = Join-Path $RepoRoot $ConstancePath
    if (Test-Path $candidate) {
        $ConstancePath = $candidate
    }
}

if (-not (Test-Path $ConstancePath)) {
    Write-Host "[WARNING] Could not find constance.js at: $ConstancePath" -ForegroundColor Yellow
    exit 1
}

$resolvedPath = (Resolve-Path $ConstancePath).Path
$content = [System.IO.File]::ReadAllText($resolvedPath, [System.Text.Encoding]::UTF8)
if ($content.Length -gt 0 -and [int]$content[0] -eq 65279) {
    $content = $content.Substring(1)
}

# The correct production block (normalizes to LF to adhere to .gitattributes text eol=lf)
$prodBlock = @"
// // // ----------- PROD -----------
export const apiUrl = "http://plbmp130:2005/";


// // // ----------- DEV -----------
// export const apiUrl = "http://localhost:2005/";
// export const apiUrl = "http://plbmp129:2005/";
// export const apiUrl = "http://10.121.50.38:2005/";
// export const apiUrl = "http://plbmp118:2005/";
"@.Replace("`r`n", "`n")

# Match the entire PROD/DEV apiUrl block regardless of which line is uncommented
$pattern = '(?ms)//[^\r\n]*-+\s*PROD\s*-+[^\r\n]*\r?\n.*?//[^\r\n]*-+\s*DEV\s*-+[^\r\n]*(?:\r?\n[^\r\n]*apiUrl[^\r\n]*)*'

if ($content -match $pattern) {
    $updated = ($content -replace $pattern, $prodBlock).Replace("`r`n", "`n")
} else {
    # Robust fallback: comment out any active apiUrl, ensure plbmp130 is active
    $updated = $content -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
    if ($updated -match '(?m)^\s*//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";') {
        $updated = $updated -replace '(?m)^\s*//\s*export const apiUrl\s*=\s*"http://plbmp130:2005/";', 'export const apiUrl = "http://plbmp130:2005/";'
    } else {
        $updated = $updated -replace '(?m)(export const server\s*=)', "export const apiUrl = ""http://plbmp130:2005/"";`n`n`$1"
    }
    $updated = $updated.Replace("`r`n", "`n")
}

$normalizedOriginal = $content.Replace("`r`n", "`n")
if ($normalizedOriginal -ne $updated) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($resolvedPath, $updated, $utf8NoBom)
    Write-Host "[SUCCESS] Modified constance.js to use plbmp130 (LF, without BOM)" -ForegroundColor Green
} else {
    Write-Host "[INFO] constance.js is already configured for production" -ForegroundColor Cyan
}
