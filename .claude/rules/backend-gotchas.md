# Backend Gotchas

Non-obvious server / Express / env pitfalls in `apps/ENG-Backend`. These bite silently — symptoms look unrelated to the cause.

## Body-parser limit (`server.js`)

`server.js` registers JSON body parsers **twice**. The FIRST one (`express.json()`) runs before the `bodyParser.json({ limit: '50mb' })` below it, so its limit wins. Both must carry the `50mb` limit or large bodies (e.g. the saved SDS grid layout) throw `PayloadTooLargeError` even though a 50mb parser exists further down.

## Gmail creds format (`.env`)

`.env` stores Gmail values as JS assignment syntax (e.g., `GMAIL_CLIENT_ID = '47418...';`). Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — **never** `process.env.KEY` directly — or the OAuth call gets `invalid_client` from the literal quote characters in the value.

## Gitignored artifacts never reach prod ("works on plbmp118, 500s on plbmp130")

Deploys are git-based (`mtc` → `dev` → `main`), so **any runtime dependency that is gitignored simply does not exist on plbmp130**. It works on plbmp118 only because the artifact was created there by hand. The failure is environment-shaped, not code-shaped — the same commit behaves differently per host, so it never reproduces locally.

Known instance — Tooling Inspection "Update data" (`POST /api/tooling_inspect/sync_csv` → `legacyMtcController.ToolingSyncCSV` → `exec()` of `api/engineer/mtc/src/importPCtooling.py`, paths from `PATHS` in `mtcConstants.js`):

1. **Python venv** `api/engineer/mtc/src/env/` — `env/.gitignore` is `*`, so 0 files tracked. Missing venv → invalid `python.exe` path → `exec` ENOENT → 500.
2. **`api/engineer/mtc/src/.env`** — matched by `apps/ENG-Backend/.gitignore` line 5 (`.env`). Holds the Python-side `DB_USER/PASS/HOST/PORT/NAME`. Missing → DB sync silently no-ops (swallowed by try/except, exits 0).

Fix is operational, not code: create the venv on prod (`pandas`, `sqlalchemy`, `psycopg2-binary`, `python-dotenv`, `openpyxl` — no `requirements.txt` exists; deps confirmed from the working plbmp118 venv) and copy `src/.env`.

**Before shipping anything that shells out or reads a config file, check whether the target is gitignored.** Also watch host-specific paths that git cannot carry either — this script reads a UNC share (`\\sanlb01\MPA-DIV\...`) that the prod service account may not be able to reach.
