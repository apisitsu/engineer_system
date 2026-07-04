param(
    [string]$ConstancePath = "apps\ENG-Frontend\src\constance\constance.js"
)

# Fix constance.js to use production apiUrl (plbmp130)
# This script replaces the entire PROD/DEV apiUrl block with the correct production content.

if (-not (Test-Path $ConstancePath)) {
    Write-Host "[WARNING] Could not find constance.js at: $ConstancePath" -ForegroundColor Yellow
    exit 1
}

$content = Get-Content $ConstancePath -Raw

# The correct production block
$prodBlock = @"
// // // ----------- PROD -----------
export const apiUrl = "http://plbmp130:2005/";


// // // ----------- DEV -----------
// export const apiUrl = "http://localhost:2005/";
// export const apiUrl = "http://plbmp129:2005/";
// export const apiUrl = "http://plbmp118:2005/";
"@

# Match the entire PROD/DEV apiUrl block regardless of which line is uncommented
# Pattern: from "// ... PROD ..." through all apiUrl lines after "// ... DEV ..."
$pattern = '(?ms)//[^\r\n]*-+\s*PROD\s*-+[^\r\n]*\r?\n.*?//[^\r\n]*-+\s*DEV\s*-+[^\r\n]*(?:\r?\n[^\r\n]*apiUrl[^\r\n]*)*'

$updated = $content -replace $pattern, $prodBlock

if ($content -ne $updated) {
    Set-Content $ConstancePath -Value $updated -NoNewline -Encoding UTF8
    Write-Host "[SUCCESS] Modified constance.js to use plbmp130" -ForegroundColor Green
} else {
    Write-Host "[INFO] constance.js is already configured for production" -ForegroundColor Cyan
}
