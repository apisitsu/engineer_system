# Test the CAM machines table + API against a scratch database on THIS machine.
#
#   cd apps/ENG-Backend
#   powershell -ExecutionPolicy Bypass -File scripts/test_cam_machine_local.ps1
#
# Creates eng_cam_test on localhost, runs the migration (twice, to show a re-run
# keeps the data), runs tests/cam/camMachine.test.js, checks --revert, and drops
# eng_cam_test at the end. Nothing else is touched: every step is pointed at
# localhost/eng_cam_test explicitly, whatever .env says.
#
# Password: not here. psql and node read it from pgpass.conf
# (%APPDATA%\postgresql\pgpass.conf, or $env:PGPASSFILE).

param(
  [string]$PgUser = 'postgres',
  [int]$PgPort = 5432
)

$ErrorActionPreference = 'Stop'
$DbName = 'eng_cam_test'
$DbHost = 'localhost'

$env:PG_NEW_HOST = $DbHost
$env:PG_NEW_PORT = "$PgPort"
$env:PG_NEW_DB = $DbName
$env:PG_NEW_USER = $PgUser
Remove-Item Env:PG_NEW_PASS -ErrorAction SilentlyContinue

function Invoke-Sql([string]$db, [string]$sql) {
  $out = & psql -h $DbHost -p $PgPort -U $PgUser -d $db -v ON_ERROR_STOP=1 -tAc $sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $sql" }
  return $out
}

function Step([string]$name) { Write-Host "`n=== $name ===" -ForegroundColor Cyan }

$failed = $false
$created = $false
try {
  Step "Create $DbName"
  if (Invoke-Sql 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$DbName'") {
    throw "$DbName already exists - drop it yourself first if it is left over from an earlier run."
  }
  Invoke-Sql 'postgres' "CREATE DATABASE $DbName" | Out-Null
  $created = $true

  Step 'Migration'
  node db_migrations/20261113_create_cam_machine.js
  if ($LASTEXITCODE -ne 0) { throw 'migration failed' }

  Step 'Re-run keeps data'
  Invoke-Sql $DbName "INSERT INTO cam_machine (id, data) VALUES ('keep-me', '{}')" | Out-Null
  node db_migrations/20261113_create_cam_machine.js --force
  if ($LASTEXITCODE -ne 0) { throw 'second migration run failed' }
  if ((Invoke-Sql $DbName "SELECT count(*) FROM cam_machine WHERE id = 'keep-me'") -ne '1') { throw 're-run lost the row' }
  Invoke-Sql $DbName "DELETE FROM cam_machine" | Out-Null
  Write-Host 'ok'

  Step 'API tests (jest)'
  $env:CAM_DB_TEST = '1'
  # node + resolved path, so it works where node_modules/.bin has no jest shim
  node (node -p "require.resolve('jest/bin/jest')") tests/cam/camMachine.test.js --runInBand
  if ($LASTEXITCODE -ne 0) { throw 'jest failed' }

  Step 'Revert'
  node db_migrations/20261113_create_cam_machine.js --revert
  if ($LASTEXITCODE -ne 0) { throw 'revert failed' }
  if (Invoke-Sql $DbName "SELECT to_regclass('cam_machine')") { throw 'cam_machine still there after --revert' }
  Write-Host 'ok'
}
catch {
  $failed = $true
  Write-Host "`nFAILED: $_" -ForegroundColor Red
}
finally {
  Remove-Item Env:CAM_DB_TEST -ErrorAction SilentlyContinue
  if ($created -and $DbName -eq 'eng_cam_test' -and $DbHost -eq 'localhost') {
    Step "Drop $DbName"
    & psql -h $DbHost -p $PgPort -U $PgUser -d postgres -tAc "DROP DATABASE IF EXISTS $DbName" | Out-Null
  }
}

if ($failed) { exit 1 }
Write-Host "`nAll passed." -ForegroundColor Green
