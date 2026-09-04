# Runbook — Tooling Inspection CSVs to Drive (browser upload, "like Kanban")

## Why the browser does it

The minebea Google Workspace **blocks anonymous access** to Apps Script web apps.
A request from the backend carries no Google session, so it is redirected to a
login page and gets HTML, not JSON — verified against all three GAS URLs in the
codebase, including the two `GAS_EMAIL_URL` deployments.

A POST from the **signed-in browser** satisfies "Anyone within minebea.co.th".
So the flow is the one Kanban uses for Drive attachments
(`api/kanban/gas/Code.gs` + `src/utils/uploadFileToDrive.js`):

| step | who | what |
|---|---|---|
| 1 | Backend | "Update data" runs the two imports and returns the 2 CSVs (base64) in `csvs[]`. `TI_CSV_OUTPUT_DIR` is written only as a local backup (skip with `TI_CSV_SKIP_LOCAL=1`). |
| 2 | Frontend | `uploadTiCsvViaGas(csvs)` — a hidden `<form>` POST per run to the GAS web app, from the user's session. |
| 3 | GAS | `doPost` writes each file into the Drive folder (updating in place), replies with an HTML page that `postMessage`s the result back. |
| 4 | Frontend | folds the result into the toast. |

No GCP project, no service account, no key files.

## Deploy

1. Open the `ToolingInspection` folder in Drive in a browser; copy the folder ID
   (last URL segment).
2. <https://script.google.com> → **New Project**, name it `TI CSV Upload`.
3. Paste `api/engineer/mtc/doc/gas_ti_csv_doPost.gs` into `Code.gs`; set `FOLDER_ID`.
4. **Deploy → New Deployment → Web App**
   - **Execute as: Me** — an @minebea account with write access to that folder.
   - **Who has access: Anyone within minebea.co.th.**
   - On the first deploy Google prompts to authorize the Drive scope — do it.
5. Copy the `/exec` URL into `apps/ENG-Frontend/src/constance/constance.js` as
   `GAS_TI_CSV_URL` (rebuild / redeploy the frontend).

> Editing an existing deployment (Manage deployments → pencil → Deploy) keeps the
> `/exec` URL; only a brand-new deployment mints a new one.

## Configure the backend

- **plbmp130** `apps/ENG-Backend/.env`: add `TI_CSV_SKIP_LOCAL=1` (the PM2 service
  account cannot see the `G:` default, and the browser upload is the real delivery).
- **plbmp118**: leave it unset — the `G:` backup write works there.

Nothing else. There is no `TI_CSV_GAS_*` on the backend any more.

## Verify

1. `node scripts/ti_check_paths.js` (as the backend's account) — confirms the two
   source shares are reachable and reports whether the local backup is on/off.
2. On the **Tooling Inspection page**, press **Update data**. After the imports
   finish the toast goes `Data updated successfully` → `Uploading CSVs to Drive...`
   → `Uploaded 2 file(s) to Drive`; check `ToolingInspection.csv` and
   `RecordForDrawingPrinted.csv` "last modified" in the Drive folder.

> To test the exact prod path on plbmp118 first, set `TI_CSV_SKIP_LOCAL=1` there
> too and restart — then the browser upload is the only delivery, as on plbmp130.

## Notes

- The upload needs a browser signed into Google (minebea). It cannot run headless
  or on a schedule. "Update data" is always a button click, so this is fine.
- `GAS_TI_CSV_URL` empty ⇒ the upload step is skipped and the toast says so; the
  DB sync and the local backup still happen.
- A re-deploy that mints a new `/exec` URL means updating `constance.js` and
  redeploying the frontend.
