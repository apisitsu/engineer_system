# Runbook — get Tooling Inspection "Update data" writing to Drive from plbmp130

## Symptom

"Update data" (Tooling Inspection page) only refreshes the two CSVs on
`G:\Shared drives\ROD-Engineer\ToolingInspection` when it is pressed on **plbmp118**.
Pressing it on **plbmp130** (production) does not update the Drive files.

## Cause

The backend writes the CSVs straight to the `G:` drive letter. `G:` is **Google Drive
for Desktop**, which mounts per signed-in interactive session, not per machine. On
plbmp118 an interactive user is logged in with Drive running, so the write reaches
Drive. On plbmp130 the backend runs under the PM2 **service account**, which either
cannot see `G:` at all or hits Drive's async-sync lock (`UNKNOWN` / errno -4094).

`toolingImportService.js` already has the fix — `uploadCsvToDrive()` POSTs each CSV to
an Apps Script web app when `TI_CSV_GAS_URL` is set — but that variable has never been
configured, so the upload path is inert.

## Fix — deploy the Apps Script uploader, point plbmp130 at it

The backend uploads the CSVs over HTTPS (server-to-server, using the deploying
account's own Drive rights). No drive letter, nothing on local disk for Drive to lock.
The change is **additive**: the local `writeCsv` still runs, and an upload failure
degrades to a warning.

### 1. Confirm the diagnosis on plbmp130

Run **as the account PM2 runs the backend as** (not your own shell):

```
cd <backend dir> && node scripts/ti_check_paths.js
```

Expect the `TI_CSV_OUTPUT_DIR` line to show `FAIL` / `NOT WRITABLE` (or a very slow
write) and the `Drive upload (TI_CSV_GAS_URL)` section to say "not configured".

### 2. Deploy the GAS web app

1. Open the `ToolingInspection` folder in Drive in a browser; copy the folder ID (last
   URL segment) — this is `FOLDER_ID`.
2. <https://script.google.com> → **New Project**, name it `TI CSV Upload`.
3. Paste `api/engineer/mtc/doc/gas_ti_csv_doPost.gs` into `Code.gs`.
4. Set `FOLDER_ID` and `SHARED_SECRET` (a long random string — e.g.
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`).
5. **Deploy → New Deployment → Web App**
   - **Execute as: Me** — must be an @minebea account with write access to that Shared
     Drive folder.
   - **Who has access: Anyone within minebea.co.th**
6. Copy the `/exec` URL.

### 3. Configure plbmp130

Add to `apps/ENG-Backend/.env` on plbmp130 (leave plbmp118 unchanged):

```
TI_CSV_GAS_URL=https://script.google.com/a/macros/minebea.co.th/s/XXXX/exec
TI_CSV_GAS_SECRET=<the same SHARED_SECRET>
TI_CSV_OUTPUT_DIR=D:\ToolingInspectionCSV
```

`TI_CSV_OUTPUT_DIR` here is just a local backup the service account can actually
write; the GAS upload is what reaches Drive. Create the folder first.

### 4. Restart and verify

```
pm2 restart <backend process>
node scripts/ti_check_paths.js      # as the service account
```

The `Drive upload (TI_CSV_GAS_URL)` section should now report
`OK  deployment answered { ready: true }` and `TI_CSV_GAS_SECRET is set`.

Then press **Update data** on plbmp130. The backend console should log:

```
=== Uploaded ToolingInspection.csv to Drive (updated, N bytes) in X.Xs ===
=== Uploaded RecordForDrawingPrinted.csv to Drive (updated, N bytes) in X.Xs ===
```

Check the two files' "last modified" in Drive.

## Gotchas

- **Re-deploying the script mints a new `/exec` URL.** If uploads stop after someone
  edits the script, the stale URL is almost always why — `ti_check_paths.js` reports
  "returned HTML, not JSON" in that case.
- **Secret mismatch** → every upload fails with `Bad secret` and the step logs a
  warning (the DB sync still succeeds). `ti_check_paths.js` flags a set URL with no
  secret.
- The frontend already sends a 15-minute timeout for this endpoint, so the extra
  upload time (2 × up to 120 s) will not trip a client timeout.
