'use strict';

/**
 * Tooling Inspection "Update data" — in-process Node port of the two Python
 * scripts this used to shell out to (src/importPCtooling.py, src/importDwgPrint.py).
 *
 * Why it moved off Python: both scripts needed a venv (src/env/) and a second
 * credentials file (src/.env), and BOTH are gitignored. Deploys here are git-based,
 * so neither artefact ever reached plbmp130 — the button worked on the machine
 * where the venv had been built by hand and 500'd everywhere else. Running the
 * same logic in the backend process removes the venv, reuses `engPool` instead of
 * a duplicate DB config, and turns "script printed an error and exited 0" into a
 * real rejected step the UI can show.
 *
 * The transforms are deliberately a faithful port rather than a cleanup. Rows
 * already in `ti_list` were written by the pandas pipeline and are de-duplicated
 * against a UID assembled from these formatted values, so any change in how a
 * date, time or quantity is rendered would make every existing row look new.
 */

const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { engPool } = require('../../../../instance/eng_db');
const { PATHS } = require('../mtcConstants');
const {
  formatDate,
  formatTime,
  parseDateDayFirst,
  readSheetObjects,
  toCsv,
  toNumber,
  toText,
} = require('../utils/tabularUtils');

const TI_CSV_NAME = 'ToolingInspection.csv';
const DWG_CSV_NAME = 'RecordForDrawingPrinted.csv';

// 9 columns × 2000 rows = 18000 bind params, well under Postgres' 65535 limit.
const INSERT_CHUNK = 2000;
const TI_INSERT_COLUMNS = ['receive_date', 'time', 'w_c', 'po_no', 'item_name', 'dwg_no', 'qty', 'remark', 'fye'];

const HEADER_RENAMES = {
  'Date รับงาน': 'Receive Date',
  TIME: 'Time',
  NAME: 'Item Name',
  Spec: 'DWG. No',
  'วันที่ Insp เสร็จ': 'Issue Date',
};

const TI_DROP_COLUMNS = ['V/D', 'Item NO', 'REJECT LIST', 'งานกลับมา', 'ORDER CONFIRM'];

// Display header → ti_list column. Anything not listed here still rides along to
// the CSV; only these nine are written to the database.
const DB_COLUMN_RENAMES = {
  'Receive Date': 'receive_date',
  Time: 'time',
  'W/C': 'w_c',
  'PO No.': 'po_no',
  'Item Name': 'item_name',
  'DWG. No': 'dwg_no',
  "Q'ty": 'qty',
  Remark: 'remark',
  FYE: 'fye',
};

/**
 * Collects the human-readable trace that ends up in the `output` field of the
 * response — the frontend surfaces it verbatim when a step fails, and it is the
 * only diagnostic an engineer on the floor gets.
 */
class StepLog {
  constructor(name = 'import') {
    this.lines = [];
    this.warnings = [];
    this.name = name;
  }

  // Buffered for the HTTP response AND echoed to the server console. The buffer alone
  // is invisible when the process dies mid-run — an out-of-memory kill or a nodemon
  // restart takes the reply with it, so the only record of how far the import got would
  // be lost exactly when it matters. The console line survives.
  log(msg) {
    this.lines.push(msg);
    console.log(`[ti:${this.name}] ${msg}`);
    return this;
  }

  warn(msg) {
    this.warnings.push(msg);
    this.lines.push(`WARNING: ${msg}`);
    console.warn(`[ti:${this.name}] WARNING: ${msg}`);
    return this;
  }

  get output() {
    return this.lines.join('\n');
  }

  get stderr() {
    return this.warnings.join('\n');
  }
}

/** The fiscal year ends in March, so April onwards already belongs to the next FYE. */
function calculateFye(date) {
  if (!date) return '';
  const year = date.getUTCFullYear();
  const fyeYear = date.getUTCMonth() + 1 >= 4 ? year + 1 : year;
  return `FYE${String(fyeYear).slice(-2)}`;
}

/**
 * The de-duplication key against `ti_list`.
 *
 * Two normalisations carry real weight here. `time` is padded because the source
 * sheets hold it as free text and "9:00" and "09:00" are the same inspection.
 * The trailing '.0' is stripped because pandas rendered a numeric PO cell as
 * '12345.0' while SheetJS gives '12345' — without it every purely numeric PO
 * already in the table would look new and be inserted a second time.
 */
function uidText(value) {
  return toText(value).replace(/\.0$/, '');
}

function buildUid({ po_no, receive_date, time, item_name }) {
  const t = toText(time);
  const paddedTime = t.length === 4 && t.includes(':') ? `0${t}` : t;
  return [uidText(po_no), toText(receive_date), paddedTime, uidText(item_name)].join('_').toLowerCase();
}

/** '6' → '06'; blank for anything non-numeric, matching the pandas formatter. */
function formatWorkCenter(value) {
  const n = toNumber(value);
  return n === null ? '' : String(Math.trunc(n)).padStart(2, '0');
}

/** Quantities are whole pieces; the sheets store them as floats. */
function formatQty(value) {
  const n = toNumber(value);
  return n === null ? '' : String(Math.trunc(n));
}

/** A numeric remark arrives as 42.0 — the trailing '.0' is noise, not precision. */
function formatRemark(value) {
  return toText(value).replace(/\.0$/, '').trim();
}

/**
 * Excel time cells are text in these sheets, but a cell occasionally gets typed
 * as a real time. Rendering the numeric case as HH:MM:SS matches what pandas'
 * str(datetime.time) produced, keeping the UID stable across both forms.
 */
function formatTimeCell(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const frac = value - Math.floor(value);
    const ms = Math.round(frac * 86400000);
    return formatTime(new Date(Date.UTC(1970, 0, 1) + ms));
  }
  if (value instanceof Date) return formatTime(value);
  return String(value).trim();
}

// Transient filesystem errors worth another attempt. UNKNOWN is the one that
// actually bit: on plbmp130 `open` of the existing CSV inside the Google Drive
// folder failed with `UNKNOWN` / errno -4094 while the folder itself was perfectly
// readable — Drive's virtual filesystem rejecting a truncating open on a file it is
// syncing or holding. EBUSY/EPERM are the SMB equivalents when someone has the CSV
// open in Excel.
const RETRYABLE_WRITE_ERRORS = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES']);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Write the CSV to a temp name in the same folder, then rename it over the target.
 *
 * Two reasons, both seen in production rather than imagined:
 *
 *  - **Truncating an existing file is the operation that fails.** Creating a new one
 *    usually succeeds where overwriting does not, because the lock or sync is held
 *    against the existing path. Writing beside it and renaming sidesteps that.
 *  - **A reader never sees half a file.** These CSVs are picked up by a Google Sheet;
 *    a rename swaps the whole thing at once, where a direct write leaves the file
 *    truncated and growing for as long as it takes.
 *
 * The whole sequence is retried, because the condition is transient by nature — a
 * sync finishes, a spreadsheet gets closed. If rename still fails after the retries,
 * fall back to writing the target directly: a stale file that could not be replaced
 * is worse than a torn one nobody is reading yet.
 */
// 5 attempts with a linear backoff waits 2+4+6+8 = 20s before giving up. The first
// numbers here (3 x 750ms ≈ 4.5s) were chosen for a brief file lock and are too short for
// what actually holds these files: Google Drive uploading the previous version. The two
// CSVs are ~0.5 and ~1.1 MB, and the request budget is 15 minutes, so 20s is cheap
// insurance — while still bounded, because a target that is genuinely unwritable must
// fail rather than hang.
async function writeCsv(dir, filename, columns, rows, { attempts = 5, backoffMs = 2000 } = {}) {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, filename);
  const tmp = path.join(dir, `.${filename}.${process.pid}.tmp`);
  const body = toCsv(columns, rows);

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await fs.writeFile(tmp, body, 'utf8');
      try {
        await fs.rename(tmp, target);
      } catch (renameErr) {
        // Windows will not rename onto an existing file on every filesystem; remove
        // it first and try once more before giving this attempt up.
        if (!RETRYABLE_WRITE_ERRORS.has(renameErr.code) && renameErr.code !== 'EEXIST') throw renameErr;
        await fs.unlink(target).catch(() => {});
        await fs.rename(tmp, target);
      }
      return;
    } catch (err) {
      lastError = err;
      await fs.unlink(tmp).catch(() => {});
      if (!RETRYABLE_WRITE_ERRORS.has(err.code) || attempt === attempts) break;
      await delay(backoffMs * attempt);
    }
  }

  // Last resort: the direct write this function used to do. It may well succeed where
  // the rename could not, and if it fails too the error is the real one to report.
  try {
    await fs.writeFile(target, body, 'utf8');
  } catch (directErr) {
    throw lastError && lastError.code ? lastError : directErr;
  }
}

/**
 * Push a CSV to Google Drive through the Apps Script web app, when one is configured.
 *
 * Writing into a Drive for Desktop folder is what produced the `UNKNOWN` / -4094
 * failures: Drive holds the file while it syncs, asynchronously, long after whatever
 * triggered the sync. Uploading removes the contended file entirely — there is nothing
 * on the local disk for Drive to be busy with.
 *
 * Deliberately additive. The local write in `writeCsv` still happens and is still the
 * step's real output; this only mirrors it. So a Drive outage, an expired deployment
 * URL or a network blip degrades to a warning instead of failing an import that
 * otherwise succeeded.
 *
 * Off unless `TI_CSV_GAS_URL` is set, so nothing changes for a host that has not been
 * configured for it. See api/engineer/mtc/doc/gas_ti_csv_doPost.gs for the script and how to deploy it.
 */
async function uploadCsvToDrive(filename, columns, rows, log) {
  const url = PATHS.TI_CSV_GAS_URL;
  if (!url) return { skipped: true };

  const body = toCsv(columns, rows);
  const started = Date.now();
  try {
    // `proxy: false` matches emailService's call to the other GAS endpoint — this
    // shell exports HTTP_PROXY globally and routing an internal request through the
    // corporate gateway returns a McAfee page with HTTP 200 rather than an error.
    const response = await axios.post(url, {
      secret: PATHS.TI_CSV_GAS_SECRET,
      fileName: filename,
      base64Data: Buffer.from(body, 'utf8').toString('base64'),
    }, {
      proxy: false,
      maxRedirects: 5,
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });

    const data = response.data || {};
    if (!data.success) throw new Error(data.error || 'Apps Script reported no success flag');
    log.log(`=== Uploaded ${filename} to Drive (${data.action}, ${data.bytes} bytes) in ${((Date.now() - started) / 1000).toFixed(1)}s ===`);
    return data;
  } catch (err) {
    // A 302 to a Google login page means the deployment is not "Anyone within the
    // organisation", and an HTML body means the URL is stale — both are worth naming.
    const detail = err.response?.data && typeof err.response.data === 'string'
      ? 'the URL returned HTML, not JSON — the deployment URL is probably stale'
      : (err.response?.data?.error || err.message);
    log.warn(`Cannot upload ${filename} to Drive: ${detail}`);
    return { error: detail };
  }
}

/** Every .xlsx under the share, minus the ~$ lock files Excel leaves behind. */
async function findWorkbooks(dir) {
  const found = [];
  const walk = async (current) => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.toLowerCase().endsWith('.xlsx') && !entry.name.startsWith('~$')) found.push(full);
    }
  };
  await walk(dir);
  return found.sort();
}

// ---------------------------------------------------------------------------
// Step 1 — INSP REC workbooks → ti_list + ToolingInspection.csv
// ---------------------------------------------------------------------------

/**
 * Merges every inspection workbook on the share, appends rows `ti_list` has not
 * seen, then re-exports the whole table to CSV for the Google Sheet that reads it.
 *
 * Only the last two months are compared. That window is a deliberate performance
 * trade, inherited from the Python: an inspection record backdated further than
 * that will not be picked up.
 */
async function importPcTooling(log = new StepLog()) {
  const sourceDir = PATHS.TI_INSP_REC_DIR;
  const outputDir = PATHS.TI_CSV_OUTPUT_DIR;

  let files;
  try {
    files = await findWorkbooks(sourceDir);
  } catch (err) {
    // Almost always the share being unreachable or unreadable by the account
    // running the backend, which is worth saying out loud — the generic ENOENT
    // sends people looking for a missing file instead of missing credentials.
    throw new Error(`Cannot read source folder ${sourceDir}: ${err.message}`);
  }

  log.log(`=== Found excel file ${files.length} files ===`);
  if (!files.length) {
    throw new Error(
      `Cannot find any excel files under: ${sourceDir}. Check the network share is mounted and readable by the account running this process.`
    );
  }

  log.log('=== Starting to merge all Excel files ===');
  const columns = [];
  const seenColumns = new Set();
  const merged = [];

  for (const file of files) {
    const sheet = readSheetObjects(file, 1); // headers live on row 2
    const renamed = sheet.columns.map((c) => HEADER_RENAMES[c] || c);
    for (const col of renamed) {
      if (!seenColumns.has(col)) {
        seenColumns.add(col);
        columns.push(col);
      }
    }
    for (const row of sheet.rows) {
      const out = {};
      sheet.columns.forEach((original, i) => {
        out[renamed[i]] = row[original];
      });
      merged.push(out);
    }
  }

  // A row without a PO number is a spacer or a running total, not an inspection.
  const rows = merged.filter((r) => toText(r['PO No.']) !== '');

  for (const row of rows) {
    const receive = parseDateDayFirst(row['Receive Date']);
    row.FYE = calculateFye(receive);
    row['Receive Date'] = formatDate(receive);
    if ('Issue Date' in row) row['Issue Date'] = formatDate(parseDateDayFirst(row['Issue Date']));
    if ('W/C' in row) row['W/C'] = formatWorkCenter(row['W/C']);
    if ("Q'ty" in row) row["Q'ty"] = formatQty(row["Q'ty"]);
    if ('Remark' in row) row.Remark = formatRemark(row.Remark);
    if ('Time' in row) row.Time = formatTimeCell(row.Time);
  }

  // Column order for the CSV: drop the unused ones, then pull Time and W/C to the
  // front so the exported sheet reads the way the inspection team expects.
  const csvColumns = columns.filter((c) => !TI_DROP_COLUMNS.includes(c));
  if (!csvColumns.includes('FYE')) csvColumns.push('FYE');
  for (const front of ['W/C', 'Time']) {
    const i = csvColumns.indexOf(front);
    if (i > 0) csvColumns.splice(1, 0, csvColumns.splice(i, 1)[0]);
  }

  log.log(`=== Merge complete! Total ${rows.length} rows ===`);

  // Backup copy of the merged sheet, written before the database round trip so a
  // DB outage still leaves the team something to look at. Step 5 overwrites it
  // with the authoritative export.
  try {
    await writeCsv(outputDir, TI_CSV_NAME, csvColumns, rows);
    log.log(`=== Backup CSV saved to ${outputDir} ===`);
  } catch (err) {
    log.warn(`Cannot save backup CSV to ${outputDir}: ${err.message}`);
  }

  // Only the last two full months are reconciled.
  const now = new Date();
  const cutoff = formatDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  log.log(`=== Filtering data from: ${cutoff} to present ===`);

  // `ti_list` stores all of these as text, so coerce here rather than letting a
  // numeric cell reach the driver — the value that gets written has to be the
  // same one buildUid() hashed, or the row comes back as new next run.
  const dbRows = rows
    .map((row) => {
      const out = {};
      for (const [header, column] of Object.entries(DB_COLUMN_RENAMES)) out[column] = toText(row[header]);
      return out;
    })
    .filter((row) => row.receive_date && row.receive_date >= cutoff);

  log.log(`=== Records to check (Last 2 months): ${dbRows.length} rows ===`);

  const existing = await engPool.query(
    `SELECT po_no, receive_date::text AS receive_date, time, item_name
       FROM ti_list
      WHERE receive_date >= $1`,
    [cutoff]
  );
  const known = new Set(existing.rows.map(buildUid));
  log.log(`=== Existing records in database (Last 2 months): ${known.size} ===`);

  // Rows an engineer has explicitly rejected. Without this they come back on the
  // next run, because the source workbook still contains them.
  let blacklisted = new Set();
  try {
    const bl = await engPool.query(
      `SELECT po_no, receive_date::text AS receive_date, time, item_name FROM ti_list_blacklist`
    );
    blacklisted = new Set(bl.rows.map((r) => buildUid({ ...r, receive_date: toText(r.receive_date).slice(0, 10) })));
    log.log(`=== Blacklisted records (will be skipped): ${blacklisted.size} ===`);
  } catch (err) {
    log.warn(`Could not load blacklist (skipping blacklist check): ${err.message}`);
  }

  const newRows = dbRows.filter((row) => {
    const uid = buildUid(row);
    return !known.has(uid) && !blacklisted.has(uid);
  });
  log.log(`=== New records found to update: ${newRows.length} ===`);

  if (newRows.length) {
    // Realign the identity sequence first: rows inserted with an explicit id in
    // the past leave the sequence behind MAX(id) and the next insert collides.
    await engPool.query(
      `SELECT setval(pg_get_serial_sequence('ti_list', 'id'), COALESCE(MAX(id), 1)) FROM ti_list`
    );

    const cols = TI_INSERT_COLUMNS.length;
    for (let i = 0; i < newRows.length; i += INSERT_CHUNK) {
      const chunk = newRows.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk
        .map((_, r) => `(${Array.from({ length: cols }, (__, c) => `$${r * cols + c + 1}`).join(',')})`)
        .join(',');
      // Order here must track TI_INSERT_COLUMNS exactly — a swap writes valid-looking
      // data into the wrong columns without erroring.
      const values = chunk.flatMap((row) => [
        row.receive_date,
        row.time,
        row.w_c,
        row.po_no,
        row.item_name,
        row.dwg_no,
        row.qty === '' ? null : toNumber(row.qty),
        row.remark,
        row.fye,
      ]);
      await engPool.query(
        `INSERT INTO ti_list (${TI_INSERT_COLUMNS.join(', ')}) VALUES ${placeholders}`,
        values
      );
    }
    log.log(`=== Inserted ${newRows.length} new records ===`);
  } else {
    log.log('=== No new records to update (Database is already up to date) ===');
  }

  // Export the table, not the merged sheet: the CSV feeds a Google Sheet that has
  // to show the inspection results engineers filled in through the web app, which
  // only exist in the database.
  const exported = await engPool.query(`SELECT * FROM ti_list ORDER BY id ASC`);
  const exportColumns = exported.fields.map((f) => f.name).filter((n) => n !== 'id' && n !== 'updated_at');
  const exportRows = exported.rows.map((row) => {
    const out = {};
    for (const col of exportColumns) {
      const v = row[col];
      out[col] = v instanceof Date ? formatDate(v) : col === 'remark' ? toText(v) : v ?? '';
    }
    return out;
  });

  try {
    await writeCsv(outputDir, TI_CSV_NAME, exportColumns, exportRows);
    log.log(`=== Successfully exported ${exportRows.length} rows from Database to ${outputDir} ===`);
    // Only the authoritative export is mirrored, not the backup written earlier in this
    // step — the backup exists for the case where the DB round trip fails, and pushing
    // both would upload the same filename twice a run for no gain.
    await uploadCsvToDrive(TI_CSV_NAME, exportColumns, exportRows, log);
  } catch (err) {
    log.warn(`Cannot export from Database to ${outputDir}: ${err.message}`);
  }

  return { inserted: newRows.length, scanned: dbRows.length, exported: exportRows.length };
}

// ---------------------------------------------------------------------------
// Step 2 — drawing-print record .xlsm → RecordForDrawingPrinted.csv
// ---------------------------------------------------------------------------

/**
 * Converts the drawing-print log to CSV. There is no database side to this one —
 * the CSV *is* the deliverable, so a failed write is a failed step rather than a
 * warning the way it is above.
 */
async function importDwgPrint(log = new StepLog()) {
  const sourceFile = PATHS.TI_DWG_PRINT_FILE;
  const outputDir = PATHS.TI_CSV_OUTPUT_DIR;
  const outputPath = path.join(outputDir, DWG_CSV_NAME);

  try {
    await fs.access(sourceFile);
  } catch {
    throw new Error(`Cannot find source workbook: ${sourceFile}`);
  }

  log.log(`=== Reading ${path.basename(sourceFile)} ===`);
  const sheet = readSheetObjects(sourceFile, 0);

  const columns = sheet.columns.filter((c) => c !== 'NO.' && c !== 'Unnamed: 11');
  const rows = sheet.rows
    .filter((r) => toText(r['LOT NO.']) !== '')
    .map((r) => {
      const out = {};
      for (const col of columns) out[col] = r[col];
      if ('ชุด' in out) out['ชุด'] = formatQty(out['ชุด']);
      return out;
    });

  log.log(`=== Loading complete. Total current Excel rows: ${rows.length} ===`);

  // Row-count delta against the previous export. Purely informational, but it is
  // how the team notices the source workbook was truncated or replaced.
  try {
    const previous = await fs.readFile(outputPath, 'utf8');
    const previousRows = previous.split(/\r?\n/).filter((l) => l.trim() !== '').length - 1;
    const delta = rows.length - previousRows;
    if (delta > 0) log.log(`=== Found ${delta} NEW records! ===`);
    else if (delta === 0) log.log('=== No new records. Data count is the same as backup ===');
    else log.warn(`Current Excel has ${Math.abs(delta)} FEWER rows than the backup`);
  } catch {
    log.log(`=== First time saving. All ${rows.length} records are new! ===`);
  }

  await writeCsv(outputDir, DWG_CSV_NAME, columns, rows);
  log.log(`=== Complete csv to ${outputDir}! File name: ${DWG_CSV_NAME} ===`);
  await uploadCsvToDrive(DWG_CSV_NAME, columns, rows, log);

  return { rows: rows.length };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Runs one import and reports the outcome instead of throwing: the caller needs
 * every step's result so a later failure cannot hide an earlier success.
 */
async function runStep(name, fn) {
  const log = new StepLog(name);
  // Heap is worth printing: this reads several workbooks plus a 10 MB xlsm into memory
  // while a CRA dev server shares the host, and an out-of-memory kill is one of the few
  // failures runStep cannot catch — the process simply goes, and the request never gets
  // a reply. A rising number here across the two steps is the tell.
  const heap = () => `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`;
  const started = Date.now();
  console.log(`[ti:${name}] START · heap ${heap()}`);
  try {
    const detail = await fn(log);
    console.log(`[ti:${name}] OK in ${((Date.now() - started) / 1000).toFixed(1)}s · heap ${heap()}`);
    return { name, ok: true, detail, stderr: log.stderr, output: log.output };
  } catch (error) {
    console.error(`[ti:${name}] FAILED after ${((Date.now() - started) / 1000).toFixed(1)}s:`, error);
    return { name, ok: false, error: error.message, stderr: log.stderr || error.message, output: log.output };
  }
}

/**
 * Both imports, in the order the button has always run them. They read unrelated
 * sources, so one failing never blocks the other.
 */
async function runToolingImports() {
  return [
    await runStep('importPCtooling', importPcTooling),
    await runStep('importDwgPrint', importDwgPrint),
  ];
}

module.exports = {
  runToolingImports,
  importPcTooling,
  importDwgPrint,
  // exported for tests
  buildUid,
  calculateFye,
  formatQty,
  formatRemark,
  formatTimeCell,
  formatWorkCenter,
  StepLog,
  writeCsv,
  uploadCsvToDrive,
};
