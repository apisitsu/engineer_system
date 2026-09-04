# Backend Gotchas

Non-obvious server / Express / env pitfalls in `apps/ENG-Backend`. These bite silently — symptoms look unrelated to the cause.

## Body-parser limit (`server.js`)

`server.js` registers JSON body parsers **twice**. The FIRST one (`express.json()`) runs before the `bodyParser.json({ limit: '50mb' })` below it, so its limit wins. Both must carry the `50mb` limit or large bodies (e.g. the saved SDS grid layout) throw `PayloadTooLargeError` even though a 50mb parser exists further down.

## `.env` mixes two conventions, and nothing signposts which a key wants

The file contains both `KEY=value` and `KEY = 'value';` (JS assignment syntax). A reader has no way to tell which style a given key expects, and picking the wrong one fails in ways that do not name the cause.

**Gmail creds are the JS-assignment kind.** Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — **never** `process.env.KEY` directly — or the OAuth call gets `invalid_client` from the literal quote characters in the value.

**The `TI_*` paths accept either**, via `envPath()` in `mtcConstants.js`, because the alternative was this on plbmp130:

```
ENOENT: mkdir 'D:\00_system\EngineerSystem\apps\ENG-Backend\'D:\ToolingInspectionCSV';'
```

`TI_CSV_OUTPUT_DIR = 'D:\ToolingInspectionCSV';` was written to match the Gmail keys directly above it. The quotes and semicolon became part of the path, Node resolved that relative to the backend directory, and the error named a path nobody had typed. `envPath()` strips a trailing `;` and **matched** wrapping quotes only — a lone quote is a typo and stays, so the ENOENT still names it. Covered by `tests/mtc/envPath.test.js`.

> If you add another path-shaped env var, read it through `envPath()`. If you add a credential, read it through `cleanEnv()`.

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

**`TI_CSV_OUTPUT_DIR` defaults to `G:\Shared drives\ROD-Engineer\ToolingInspection`, and `G:` is Google Drive for Desktop — not a mapped network drive.** `Win32_LogicalDisk` reports it `DriveType 3` with an empty `ProviderName`, so **there is no UNC equivalent to point at**; earlier advice here to "set the env var to the UNC path" was wrong and would send you looking for a path that does not exist.

These machines all have Drive installed, so `G:` is normally present on each of them — do not assume its absence is the problem. Two things about it are still per-host and worth checking rather than assuming:

- **It is mounted per signed-in session, not per machine.** Installed everywhere is not the same as visible to the account running node. There is no UNC fallback, so if that account cannot see it, point `TI_CSV_OUTPUT_DIR` at an ordinary folder (a real UNC share or local disk) and move the file to Drive separately.
- **A write to it is a cloud sync, not a disk write**, so how long the two CSVs (~0.5 MB and ~1.1 MB) take depends on the host's link. `ti_check_paths.js` writes a realistic 1 MB and times it; on plbmp118 that is 0.1 s.

**The CSVs reach the Google Sheet by the BROWSER uploading them, not the backend** (see "Getting the CSVs to Drive" below). `TI_CSV_OUTPUT_DIR` is now only a local backup — `publishCsv` writes it best-effort and **never throws**; both steps warn on a failed write and return the CSV body (base64) in the `sync_csv` response's `csvs[]` for the frontend to upload.

> **`ls -l` ownership on `G:` is meaningless.** The mount reports the local user as owner for every file on it, including ones other people created years ago — so it can never tell you which host wrote a file. Use mtimes.

`M:` and `N:` on these machines **are** network drives (`\\10.121.34.19\data_rod`, `\\sanlb01\MPA-DIV`) — which is why the two *sources* are written as UNC and only need credentials for the running account. Do not generalise from them to `G:`.

**Never point `TI_CSV_OUTPUT_DIR` inside the repo.** `npm run dev` is nodemon and `package.json`'s `nodemonConfig.ignore` covers only `output/*` and `files/*`; a CSV written anywhere else under `apps/ENG-Backend/` restarts the server mid-import, which presents as the request hanging and never returning rather than as an error.

### Writing the CSV: temp file, rename, retry

`writeCsv` does **not** write the target directly, and the reason is a production failure rather than a preference. On plbmp130 `open` of the existing `RecordForDrawingPrinted.csv` inside the Drive folder failed with `UNKNOWN` / errno **-4094** while the folder itself listed and stat'd perfectly — Drive's virtual filesystem refusing a *truncating* open on a file it is syncing. Creating a new file beside it succeeds where overwriting does not, so the write goes to `.<name>.<pid>.tmp` and is renamed over the target.

That also means a reader never sees a half-written file, which matters because these CSVs are consumed by a Google Sheet.

The whole sequence retries (3 attempts, linear backoff) on `UNKNOWN`/`EBUSY`/`EPERM`/`EACCES` — all transient by nature, whether it is Drive mid-sync or someone with the CSV open in Excel — and falls back to a direct write if the rename never succeeds. A non-retryable error (`ENOENT` for a folder that does not exist) still throws, because that is the one the step needs to report. Verified against the real Drive folder: create 0.10 s, overwrite 0.06 s, no temp left behind.

> **This improves the odds; it does not make `G:` a reliable sink.** Which is why the delivery moved off it — see below.

### Getting the CSVs to Drive: the browser uploads them, not the backend

Writing into a Drive-for-Desktop folder fails intermittently with `UNKNOWN` / -4094 (async sync holding the file). The server-to-server fix — POST the CSV to an Apps Script web app — **does not work in this Workspace**: the minebea admin blocks anonymous ("Anyone") access to web apps, so a backend request with no Google session is 302'd to a login page and gets **HTML, not JSON**. Verified against all three GAS URLs in the repo, including both `GAS_EMAIL_URL` deployments (so `sendEmailViaAS` is silently returning the login page too — it never checks `data.success`).

So it works the way **Kanban** uploads Drive attachments — from the signed-in **browser**, which satisfies "Anyone within minebea.co.th":

- **Backend** (`ToolingSyncCSV`): each import returns its CSV base64-encoded; the response carries them in `csvs[]`. `publishCsv` also writes `TI_CSV_OUTPUT_DIR` as a **local backup** (best-effort, never throws), skipped by `TI_CSV_SKIP_LOCAL=1` — set that on plbmp130, whose service account cannot see `G:`. No `TI_CSV_GAS_*` on the backend any more.
- **Frontend** (`src/utils/uploadTiCsvViaGas.js`): after "Update data" succeeds, a hidden `<form>` POST (`payload` = `{files:[…]}`) to `GAS_TI_CSV_URL` targeting a hidden iframe — same mechanism as `uploadFileToDrive.js`'s `deleteFileFromDrive`. The GAS page hands the result back via `postMessage` with `_gasUploadResponse:true`.
- **GAS** (`api/engineer/mtc/doc/gas_ti_csv_doPost.gs`): deployed **Execute as: Me / Anyone within minebea.co.th**. No shared secret — the per-user browser session + org restriction is the gate, as in `Code.gs`. Writes each file in place; a re-deploy that mints a new `/exec` URL means updating `constance.js`.
- `GAS_TI_CSV_URL` empty ⇒ upload skipped, toast says so; DB sync + local backup still run.
- **The upload needs a browser signed into Google.** Fine today (always a button click); a headless/cron "Update data" would sync the DB and the local backup but not reach Drive.

Full deploy + config: `api/engineer/mtc/doc/ti_csv_drive_upload_runbook.md`.

> `node scripts/ti_check_paths.js` reports the two source shares, whether the local backup folder is writable (unless `TI_CSV_SKIP_LOCAL`), and **which account it ran as** — run it as the account that runs the backend. It touches no database. On plbmp118 as an interactive user the sources read in ~30 s (8 workbooks, ~3,100 rows, plus a 10 MB xlsm), so a request that dies in ~10 s is a client timeout and one that dies near 60 s is a proxy timeout — neither is the import itself.

### Telling apart the three ways "Update data" fails

`runStep` catches everything, so **a failing import always returns a 500 with a message**. If the browser gets *no response at all* it is not the import failing — the process or the connection went. The console tells you which:

| what you see | what it is |
|---|---|
| toast with a real message, `httpStatus: 500` | an import step failed — read `steps[]`, the path is named |
| `httpStatus: null`, died at ~10 s | a client timeout: something called the endpoint without the explicit 15-min `timeout` (`HttpClient` forces 10 s) |
| `httpStatus: null`, died at ~60 s | a reverse proxy's read timeout — `nginx.conf` sets none, so nginx's own default 60 s applies. Prod's `apiUrl` goes straight to `:2005` and bypasses it; reaching the app on port 80 does not |
| `httpStatus: null`, no fixed time, backend console shows a restart | the process died — out of memory, or nodemon restarting on a file change |

The backend console prints `[ti:importPCtooling] START · heap …` and an `OK in …s · heap …` per step. **A run that logs START and never logs OK or FAILED did not throw — the process went.** `StepLog` echoes each progress line to the console for this reason: its buffer only reaches the browser in the reply, which a dead process never sends. Watch the heap figure — the backend shares the host with a CRA dev server (`npm run dev` runs both), and this step holds several workbooks plus a 10 MB xlsm in memory at once.

The frontend logs `{ elapsedSeconds, code, httpStatus, url, body }`, and says plainly when there was no reply that the import is probably still running — pressing the button again while it runs is how you get two concurrent imports.

### Porting notes (why the Node code looks the way it does)

- **UID stability is load-bearing.** Rows already in `ti_list` were written by pandas and are de-duplicated on `po_no_receive_date_time_item_name`. `buildUid` pads a 4-char time (`9:00` → `09:00`) and strips a trailing `.0` (pandas rendered a numeric PO cell as `12345.0`, SheetJS gives `12345`). Change either and every existing row re-imports as new.
- **Excel dates are serials**; only the cell's number format identifies one. `readSheetObjects` resolves them via `XLSX.SSF.is_date(cell.z)` — hence `cellNF: true`. All conversion is in UTC so the server timezone cannot shift a date.
- **`!ref` overstates the sheet.** The drawing-print workbook declares `A1:N1048573` for 16k rows; `usedRange()` walks real cells instead, which also drops the phantom trailing `Unnamed: N` columns.
- **One deliberate difference from the Python output:** pandas rendered a date column containing any non-date cell as `2026-01-05 00:00:00` and a pure one as `2026-01-05`. Node always writes `2026-01-05` unless the serial carries a real time. Verified against the live data: 16,422/16,422 drawing-print rows and 234/234 in-window `ti_list` UIDs matched.
