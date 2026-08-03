# Backend Gotchas

Non-obvious server / Express / env pitfalls in `apps/ENG-Backend`. These bite silently — symptoms look unrelated to the cause.

## Body-parser limit (`server.js`)

`server.js` registers JSON body parsers **twice**. The FIRST one (`express.json()`) runs before the `bodyParser.json({ limit: '50mb' })` below it, so its limit wins. Both must carry the `50mb` limit or large bodies (e.g. the saved SDS grid layout) throw `PayloadTooLargeError` even though a 50mb parser exists further down.

## Gmail creds format (`.env`)

`.env` stores Gmail values as JS assignment syntax (e.g., `GMAIL_CLIENT_ID = '47418...';`). Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — **never** `process.env.KEY` directly — or the OAuth call gets `invalid_client` from the literal quote characters in the value.

## Gitignored artifacts never reach prod ("works on plbmp118, 500s on plbmp130")

Deploys are git-based (`mtc` → `dev` → `main`), so **any runtime dependency that is gitignored simply does not exist on plbmp130**. It works on plbmp118 only because the artifact was created there by hand. The failure is environment-shaped, not code-shaped — the same commit behaves differently per host, so it never reproduces locally.

Known instance — Tooling Inspection "Update data" (`POST /api/tooling_inspect/sync_csv` → `legacyMtcController.ToolingSyncCSV`, paths from `PATHS` in `mtcConstants.js`). The button `exec()`s **two** scripts in sequence, each reported independently in the `steps[]` response array:

| Step | Script | `PATHS` key / env override | Reads | Writes |
|---|---|---|---|---|
| 1 | `src/importPCtooling.py` | `TOOLING_IMPORT_SCRIPT` | `\\sanlb01\MPA-DIV\...\INSP REC` | `ti_list` + `G:\...\ToolingInspection.csv` |
| 2 | `src/importDwgPrint.py` | `DWG_PRINT_IMPORT_SCRIPT` | `\\10.121.34.19\data_rod\...` `.xlsm` | `G:\...\RecordForDrawingPrinted.csv` (no DB) |

Both env overrides are optional — unset falls back to the tracked `src/*.py`. One step failing does not stop the other; the response is 500 when **any** step fails, and the frontend downgrades to a warning (and still refreshes) when `steps[]` shows a partial success.

1. **Python venv** `api/engineer/mtc/src/env/` — `env/.gitignore` is `*`, so 0 files tracked. Missing venv → invalid `python.exe` path → `exec` ENOENT → 500.
2. **`api/engineer/mtc/src/.env`** — matched by `apps/ENG-Backend/.gitignore` line 5 (`.env`). Holds the Python-side `DB_USER/PASS/HOST/PORT/NAME`. Missing → DB sync silently no-ops (swallowed by try/except, exits 0).

Fix is operational, not code: create the venv on prod (`pandas`, `sqlalchemy`, `psycopg2-binary`, `python-dotenv`, `openpyxl` — no `requirements.txt` exists; deps confirmed from the working plbmp118 venv) and copy `src/.env`.

**Before shipping anything that shells out or reads a config file, check whether the target is gitignored.** Also watch host-specific paths that git cannot carry either — both scripts read UNC shares (`\\sanlb01\MPA-DIV\...`, `\\10.121.34.19\data_rod\...`) and write to the **mapped drive letter `G:`**. A mapped drive is per-interactive-session: the PM2 service account on plbmp130 will not have `G:` even when the same UNC path is reachable. `importDwgPrint.py` writes *only* to `G:`, so on prod it can fail (or silently produce nothing) while step 1 still updates `ti_list` fine — this is exactly the partial-failure case the `steps[]` response exists to surface.
