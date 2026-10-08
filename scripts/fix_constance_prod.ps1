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
}
elseif (-not (Test-Path $ConstancePath)) {
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

# If constance.js already uses getDynamicApiUrl, it supports Production, Dev (129/118), and Local automatically
if ($content -match 'getDynamicApiUrl' -and $content -match 'export const apiUrl =') {
    # Check for any stray duplicate active apiUrl lines
    $activeApiLines = [regex]::Matches($content, '(?m)^\s*export\s+const\s+apiUrl\s*=')
    if ($activeApiLines.Count -eq 1) {
        Write-Host "[INFO] constance.js is already configured with smart dynamic API URL resolution (Production & Dev ready)" -ForegroundColor Cyan
        exit 0
    }
}

# The canonical smart dynamic block (normalizes to LF to adhere to .gitattributes text eol=lf)
$prodBlock = @"
// ============================================================================
// API URL Configuration
// - Default: Automatically detects Host (Production, Dev 129/118, Localhost)
// - Manual Override: Set MANUAL_OVERRIDE_URL if you need to force a specific host
// ============================================================================
const MANUAL_OVERRIDE_URL = ""; // e.g. "http://plbmp130.lb.minebea.local:2005/"

const getDynamicApiUrl = () => {
  let resolvedUrl = "http://plbmp130.lb.minebea.local:2005/";
  let matchedRule = "Production Fallback";

  if (process.env.REACT_APP_API_URL) {
    resolvedUrl = process.env.REACT_APP_API_URL.endsWith('/')
      ? process.env.REACT_APP_API_URL
      : `${process.env.REACT_APP_API_URL}/`;
    matchedRule = "ENV (REACT_APP_API_URL)";
  } else if (typeof window !== 'undefined' && window.location) {
    const host = (window.location.hostname || '').toLowerCase();

    // 1. Localhost / Local Development
    if (host === 'localhost' || host === '127.0.0.1') {
      resolvedUrl = "http://localhost:2005/";
      matchedRule = `Localhost (${host})`;
    }
    // 2. Production Server (plbmp130)
    else if (host.includes('plbmp130')) {
      resolvedUrl = "http://plbmp130.lb.minebea.local:2005/";
      matchedRule = `Production (${host})`;
    }
    // 3. Dev Server 129 (plbmp129)
    else if (host.includes('plbmp129')) {
      resolvedUrl = "http://plbmp129.lb.minebea.local:2005/";
      matchedRule = `Dev 129 (${host})`;
    }
    // 4. Dev Server 118 (plbmp118)
    else if (host.includes('plbmp118')) {
      resolvedUrl = "http://plbmp118.lb.minebea.local:2005/";
      matchedRule = `Dev 118 (${host})`;
    }
    // 5. Intranet Hostname without domain (append .lb.minebea.local for network-wide accessibility)
    else if (host && !host.includes('.')) {
      resolvedUrl = `http://${host}.lb.minebea.local:2005/`;
      matchedRule = `Intranet Host (${host} -> ${host}.lb.minebea.local)`;
    }
    // 6. Direct IP or other FQDN Host (e.g. 10.121.50.38)
    else if (host) {
      resolvedUrl = `${window.location.protocol}//${host}:2005/`;
      matchedRule = `Custom Host / IP (${host})`;
    }
  }

  return { resolvedUrl, matchedRule };
};

const _detectedApi = getDynamicApiUrl();
export const apiUrl = MANUAL_OVERRIDE_URL || _detectedApi.resolvedUrl;

// Developer diagnostic log in browser console
if (typeof window !== 'undefined') {
  const currentHost = window.location.hostname || 'unknown';
  const activeMode = MANUAL_OVERRIDE_URL ? `MANUAL OVERRIDE (${MANUAL_OVERRIDE_URL})` : _detectedApi.matchedRule;
  console.log(
    `%c[API Host Detect]%c Host: %c${currentHost}%c | Target API: %c${apiUrl}%c | Rule: %c${activeMode}`,
    'color: #ffffff; background: #0284c7; padding: 2px 6px; border-radius: 3px 0 0 3px; font-weight: bold;',
    'color: #334155; background: #f1f5f9; padding: 2px 4px;',
    'color: #0369a1; background: #f1f5f9; font-weight: bold; padding: 2px 4px;',
    'color: #64748b; background: #f1f5f9; padding: 2px 4px;',
    'color: #15803d; background: #f1f5f9; font-weight: bold; padding: 2px 4px;',
    'color: #64748b; background: #f1f5f9; padding: 2px 4px;',
    'color: #7c3aed; background: #f1f5f9; font-weight: bold; padding: 2px 4px; border-radius: 0 3px 3px 0;'
  );
}
"@.Replace("`r`n", "`n")

# Match either the dynamic block or the legacy PROD/DEV apiUrl block
$pattern = '(?ms)//[^\r\n]*(=+|-+)\s*API URL Configuration.*?(?=export\s+const\s+server\s*=)|//[^\r\n]*-+\s*PROD\s*-+[^\r\n]*\r?\n.*?//[^\r\n]*-+\s*DEV\s*-+[^\r\n]*(?:\r?\n[^\r\n]*apiUrl[^\r\n]*)*'

if ($content -match $pattern) {
    $updated = ($content -replace $pattern, "$prodBlock`n`n").Replace("`r`n", "`n")
}
else {
    # Robust fallback: comment out any active apiUrl, ensure prodBlock is active before export const server
    $cleanContent = $content -replace '(?m)^(\s*)export const apiUrl\s*=', '$1// export const apiUrl ='
    $updated = $cleanContent -replace '(?m)(export const server\s*=)', "$prodBlock`n`n`$1"
    $updated = $updated.Replace("`r`n", "`n")
}

$normalizedOriginal = $content.Replace("`r`n", "`n")
if ($normalizedOriginal -ne $updated) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($resolvedPath, $updated, $utf8NoBom)
    Write-Host "[SUCCESS] Updated constance.js with smart dynamic API URL resolution (LF, without BOM)" -ForegroundColor Green
}
else {
    Write-Host "[INFO] constance.js is already up to date" -ForegroundColor Cyan
}
