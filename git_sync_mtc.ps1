#requires -Version 5
<#
  git_sync_mtc.ps1 — automate the doc/git_method.md release flow, from branch `mtc`.

  Usage (PowerShell, run from repo root):
    .\git_sync_mtc.ps1 "your commit message"   # commit working changes, then sync everywhere
    .\git_sync_mtc.ps1                          # no new commit; just re-sync branches

  Flow: commit on mtc -> push mtc (origin+github) -> merge mtc into dev (origin+github)
        -> push dev -> force-push dev to github main. Stops on any error / merge conflict.
        Includes a safety gate: aborts before touching main if dev's apiUrl is not the
        prod host (plbmp130), so a dev apiUrl can never be force-pushed to production.
#>
param([string]$Message = "")

$ErrorActionPreference = 'Stop'
$PROD_API_HOST = 'plbmp130'
$CONSTANCE = 'apps/ENG-Frontend/src/constance/constance.js'

# Resolve the real git executable ONCE so the wrapper below can never recurse into
# itself (a function named 'Git' would otherwise shadow the 'git' command).
$GIT = (Get-Command git -CommandType Application | Select-Object -First 1).Source

# Run a git command; throw (halt the script) if it fails.
function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  Write-Host "> git $($GitArgs -join ' ')" -ForegroundColor Cyan
  & $GIT @GitArgs
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed (exit $LASTEXITCODE)" }
}

# Must start on mtc (the feature/working branch).
$branch = (& $GIT rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'mtc') { throw "Run this from branch 'mtc' (currently on '$branch')." }

# 1-2. Stage + commit working changes. Skip cleanly when there is nothing to commit.
Invoke-Git add .
& $GIT diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  if (-not $Message) { throw "Staged changes exist but no message given. Run: .\git_sync_mtc.ps1 ""your message""" }
  Invoke-Git commit -m $Message
} else {
  Write-Host "nothing to commit - skipping commit" -ForegroundColor Yellow
}

# 3. Push mtc to both remotes.
Invoke-Git push origin mtc
Invoke-Git push github mtc

# 4-6 (origin). Merge mtc into dev on origin.
Invoke-Git checkout dev
Invoke-Git pull origin dev --no-edit
Invoke-Git merge mtc --no-edit

# --- Safety gate: dev must keep the prod apiUrl before anything reaches main ---
$apiLine = (Select-String -Path $CONSTANCE -Pattern '^export const apiUrl' | Select-Object -First 1).Line
if ($apiLine -and ($apiLine -notmatch $PROD_API_HOST)) {
  Invoke-Git checkout mtc
  throw "ABORT: dev apiUrl is '$apiLine' - expected '$PROD_API_HOST' for prod. Fix $CONSTANCE on dev, then re-run."
}
Write-Host "apiUrl OK on dev: $apiLine" -ForegroundColor Green

Invoke-Git push origin dev

# 4-6 (github). Merge mtc into dev on github, then force-push to main.
Invoke-Git pull github dev --no-edit
Invoke-Git merge mtc --no-edit
Invoke-Git push github dev
Invoke-Git push github dev:main --force

# Return to the working branch.
Invoke-Git checkout mtc
Write-Host "All done - mtc / dev / github main are synced." -ForegroundColor Green
