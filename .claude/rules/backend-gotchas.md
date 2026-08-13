# Backend Gotchas

Non-obvious server / Express / env pitfalls in `apps/ENG-Backend`. These bite silently — symptoms look unrelated to the cause.

## Body-parser limit (`server.js`)

`server.js` registers JSON body parsers **twice**. The FIRST one (`express.json()`) runs before the `bodyParser.json({ limit: '50mb' })` below it, so its limit wins. Both must carry the `50mb` limit or large bodies (e.g. the saved SDS grid layout) throw `PayloadTooLargeError` even though a 50mb parser exists further down.

## Gmail creds format (`.env`)

`.env` stores Gmail values as JS assignment syntax (e.g., `GMAIL_CLIENT_ID = '47418...';`). Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — **never** `process.env.KEY` directly — or the OAuth call gets `invalid_client` from the literal quote characters in the value.

## Gitignored artifacts never reach prod ("works on plbmp118, 500s on plbmp130")

Deploys are git-based (`mtc` → `dev` → `main`), so **any runtime dependency that is gitignored simply does not exist on plbmp130**. It works on plbmp118 only because the artifact was created there by hand. The failure is environment-shaped, not code-shaped — the same commit behaves differently per host, so it never reproduces locally.

Canonical instance was Tooling Inspection "Update data", which `exec()`'d two Python scripts needing a gitignored venv (`api/engineer/mtc/src/env/`, whose `.gitignore` is `*` → 0 files tracked) and a gitignored second credentials file (`src/.env`). Neither ever reached plbmp130: missing venv → `exec` ENOENT → 500; missing `src/.env` → DB sync silently no-ops and still exits 0.

**Resolved 2026-08-04** — the scripts were ported to Node and deleted, along with the `PYTHON_EXE`/`*_IMPORT_SCRIPT` entries in `PATHS` and a second, never-routed copy of `ToolingSyncCSV` in `eng_mtc_model.js`. `src/importPCpbCost.py` (PB cost, run by hand, no code path) and the venv are untouched.

The rule stands for the rest of the codebase, which still shells out to Python in `api/engineer/pdf_hub/`, `api/engineer/system/` and `cad_worker/`: **before shipping anything that shells out or reads a config file, check whether the target is gitignored.**

Host-specific *paths* are the half git still cannot carry. See the mapped-drive note below.

## Tooling Inspection "Update data" (current shape)

`POST /api/tooling_inspect/sync_csv` → `legacyMtcController.ToolingSyncCSV` → `services/toolingImportService.runToolingImports()`. Two in-process imports run in sequence, each reported independently in the `steps[]` response array:

| Step | Function | Reads | Writes |
|---|---|---|---|
| 1 | `importPcTooling` | `TI_INSP_REC_DIR` (`\\sanlb01\MPA-DIV\...\INSP REC`) | `ti_list` via `engPool` + `ToolingInspection.csv` |
| 2 | `importDwgPrint` | `TI_DWG_PRINT_FILE` (`\\10.121.34.19\data_rod\...` `.xlsm`) | `RecordForDrawingPrinted.csv` (no DB) |

One step failing does not stop the other; the response is 500 when **any** step fails, and the frontend downgrades to a warning (and still refreshes) when `steps[]` shows a partial success.

**`TI_CSV_OUTPUT_DIR` defaults to the mapped drive `G:\Shared drives\ROD-Engineer\ToolingInspection`.** A mapped drive is per-interactive-session — the PM2 service account on plbmp130 does not have `G:` even where the same UNC path is reachable. Set the env var to the UNC path on prod. Step 1 downgrades a failed CSV write to a warning (the DB sync is the real work), but step 2's CSV *is* its only output, so there it is a hard failure.

### Porting notes (why the Node code looks the way it does)

- **UID stability is load-bearing.** Rows already in `ti_list` were written by pandas and are de-duplicated on `po_no_receive_date_time_item_name`. `buildUid` pads a 4-char time (`9:00` → `09:00`) and strips a trailing `.0` (pandas rendered a numeric PO cell as `12345.0`, SheetJS gives `12345`). Change either and every existing row re-imports as new.
- **Excel dates are serials**; only the cell's number format identifies one. `readSheetObjects` resolves them via `XLSX.SSF.is_date(cell.z)` — hence `cellNF: true`. All conversion is in UTC so the server timezone cannot shift a date.
- **`!ref` overstates the sheet.** The drawing-print workbook declares `A1:N1048573` for 16k rows; `usedRange()` walks real cells instead, which also drops the phantom trailing `Unnamed: N` columns.
- **One deliberate difference from the Python output:** pandas rendered a date column containing any non-date cell as `2026-01-05 00:00:00` and a pure one as `2026-01-05`. Node always writes `2026-01-05` unless the serial carries a real time. Verified against the live data: 16,422/16,422 drawing-print rows and 234/234 in-window `ti_list` UIDs matched.
