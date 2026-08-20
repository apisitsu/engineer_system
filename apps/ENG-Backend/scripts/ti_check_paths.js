'use strict';

/**
 * ti_check_paths.js — why "Update data" on Tooling Inspection failed, per host.
 *
 * `POST /api/tooling_inspect/sync_csv` reads two network shares and writes two CSVs, and
 * all three locations are host- and ACCOUNT-specific: git carries the code, never the
 * mounts. The same commit therefore behaves differently on plbmp118 and plbmp130, and the
 * 500 body says only which step failed. This says which PATH failed, and for whom.
 *
 * Read-only apart from a byte written and deleted in the output folder — it touches no
 * database and changes no data, so it is safe to run on production at any time.
 *
 *   cd apps/ENG-Backend && node scripts/ti_check_paths.js
 *
 * Run it AS THE ACCOUNT THAT RUNS THE BACKEND. Running it in your own shell proves
 * nothing about a service account: it prints the user it ran as, first line, for exactly
 * that reason.
 *
 * ── The trap this exists for ────────────────────────────────────────────────
 * `TI_CSV_OUTPUT_DIR` defaults to `G:\Shared drives\...`, and **G: is Google Drive for
 * Desktop, not a network share** — `Win32_LogicalDisk` reports DriveType 3 with an empty
 * ProviderName. These machines all have Drive set up, so G: is normally there; the two
 * things that still differ per host are worth checking rather than assuming:
 *
 *  - **It is mounted per signed-in session, not per machine.** Having Drive installed
 *    everywhere is not the same as the account running node being able to see G:. There
 *    is also no UNC form to fall back on, so if that account cannot, the fix is to point
 *    `TI_CSV_OUTPUT_DIR` at an ordinary folder and move the file to Drive separately.
 *  - **A write to it is a cloud sync, not a disk write.** The two CSVs are ~0.5 and
 *    ~1.1 MB, and how long that takes is a property of the host's link, not of the code.
 *    The write probe below therefore writes a realistic 1 MB and times it.
 *
 * Do not read `ls -l` ownership on G: as evidence of who wrote a file: the mount reports
 * the local user for everything on it, including files created by other people years ago.
 *
 * `TI_INSP_REC_DIR` and `TI_DWG_PRINT_FILE` are genuine UNC shares (`\\sanlb01\MPA-DIV`,
 * `\\10.121.34.19\data_rod`) and only need credentials for the running account.
 *
 * Never point `TI_CSV_OUTPUT_DIR` inside the repo: `npm run dev` is nodemon, and its
 * `nodemonConfig.ignore` covers only `output/*` and `files/*`. A CSV written anywhere else
 * under `apps/ENG-Backend/` restarts the server mid-import, which looks exactly like the
 * request hanging and never finishing.
 */

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const { PATHS } = require('../api/engineer/mtc/mtcConstants');

const started = Date.now();
const since = (t) => `${((Date.now() - t) / 1000).toFixed(1)}s`;
const problems = [];

function inspect(label, target, { needsWrite = false } = {}) {
  const t = Date.now();
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (err) {
    // A UNC path the account cannot authenticate to takes seconds to fail, and the
    // elapsed time is the tell — ENOENT in 0.0s is a wrong path, ENOENT in 20s is a
    // share that did not answer.
    console.log(`  ${label.padEnd(19)} FAIL  ${err.code}  after ${since(t)}`);
    console.log(`  ${''.padEnd(19)}       ${target}`);
    problems.push(`${label}: ${err.code} (${target})`);
    return null;
  }

  const size = stat.isDirectory() ? 'directory' : `${(stat.size / 1024 / 1024).toFixed(1)} MB`;
  let note = '';
  if (needsWrite) {
    // Write a realistic payload, not a token byte. The real CSVs are ~0.5 and ~1.1 MB,
    // and the usual target is a Google Drive folder, where a write is a sync to the
    // cloud rather than a disk write — a probe of five bytes would come back instantly
    // and prove nothing about how long the import's own writes take.
    const probe = path.join(target, `.ti_write_probe_${process.pid}.tmp`);
    const payload = Buffer.alloc(1024 * 1024, 0x2c); // 1 MB of commas
    const w = Date.now();
    try {
      fs.writeFileSync(probe, payload);
      const written = since(w);
      fs.unlinkSync(probe);
      note = ` · 1 MB write in ${written}`;
      if (Date.now() - w > 20000) {
        problems.push(`${label}: writable, but a 1 MB write took ${written} — slow enough to matter`);
      }
    } catch (err) {
      note = ` · NOT WRITABLE (${err.code})`;
      problems.push(`${label}: readable but not writable — ${err.code}`);
    }
  }
  console.log(`  ${label.padEnd(19)} OK    ${size}${note}  in ${since(t)}`);
  console.log(`  ${''.padEnd(19)}       ${target}`);
  return stat;
}

function listWorkbooks(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listWorkbooks(full));
    // Skip Excel's lock files; they are not workbooks and cannot be read.
    else if (/\.xls[xm]?$/i.test(entry.name) && !entry.name.startsWith('~$')) out.push(full);
  }
  return out;
}

console.log(`host ${os.hostname()} · running as ${os.userInfo().username} · node ${process.version}`);
console.log('\n--- configuration ---');
for (const key of ['TI_INSP_REC_DIR', 'TI_DWG_PRINT_FILE', 'TI_CSV_OUTPUT_DIR']) {
  console.log(`  ${key.padEnd(19)} ${process.env[key] ? 'from .env' : 'DEFAULT (not set in .env)'}`);
}

console.log('\n--- paths ---');
const srcOk = inspect('TI_INSP_REC_DIR', PATHS.TI_INSP_REC_DIR);
const dwgOk = inspect('TI_DWG_PRINT_FILE', PATHS.TI_DWG_PRINT_FILE);
inspect('TI_CSV_OUTPUT_DIR', PATHS.TI_CSV_OUTPUT_DIR, { needsWrite: true });

if (/^[A-Za-z]:/.test(PATHS.TI_CSV_OUTPUT_DIR)) {
  console.log(`\n  NOTE  TI_CSV_OUTPUT_DIR is a drive letter (${PATHS.TI_CSV_OUTPUT_DIR.slice(0, 2)}).`);
  console.log('        Drive letters are mounted per signed-in session, not per machine, so this');
  console.log('        line only proves it exists for the account above. G: is Google Drive and');
  console.log('        has no UNC form to fall back on — if the backend account cannot see it,');
  console.log('        use an ordinary folder and move the file to Drive separately.');
}

const repoRoot = path.resolve(__dirname, '..');
if (path.resolve(PATHS.TI_CSV_OUTPUT_DIR).startsWith(repoRoot)) {
  console.log('\n  PROBLEM  TI_CSV_OUTPUT_DIR is inside apps/ENG-Backend. nodemon only ignores');
  console.log('           output/* and files/*, so writing the CSV here restarts the server');
  console.log('           mid-import and the request never returns.');
  problems.push('TI_CSV_OUTPUT_DIR is inside the repo — nodemon will restart mid-import');
}

if (srcOk) {
  console.log('\n--- step 1: importPcTooling sources ---');
  const t = Date.now();
  let files = [];
  try {
    files = listWorkbooks(PATHS.TI_INSP_REC_DIR);
  } catch (err) {
    console.log(`  cannot walk the folder: ${err.code}`);
    problems.push(`TI_INSP_REC_DIR unreadable while walking: ${err.code}`);
  }
  console.log(`  ${files.length} workbooks, listed in ${since(t)}`);
  if (!files.length && srcOk) problems.push('TI_INSP_REC_DIR is readable but holds no workbooks — check the year folder');
  const readStart = Date.now();
  let rows = 0;
  for (const file of files) {
    try {
      const wb = XLSX.readFile(file, { cellNF: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (ws && ws['!ref']) rows += XLSX.utils.decode_range(ws['!ref']).e.r;
    } catch (err) {
      console.log(`  unreadable: ${path.basename(file)} — ${err.message}`);
      problems.push(`unreadable workbook ${path.basename(file)}`);
    }
  }
  console.log(`  read them all in ${since(readStart)} (~${rows} rows)`);
}

if (dwgOk) {
  console.log('\n--- step 2: importDwgPrint source ---');
  const t = Date.now();
  try {
    const wb = XLSX.readFile(PATHS.TI_DWG_PRINT_FILE, { cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    console.log(`  read in ${since(t)} · declared range ${ws && ws['!ref']}`);
  } catch (err) {
    console.log(`  FAILED to read: ${err.message}`);
    problems.push(`TI_DWG_PRINT_FILE unreadable: ${err.message}`);
  }
}

console.log(`\n--- verdict --- (${since(started)} total; the real request also does the DB work)`);
if (!problems.length) {
  console.log('  All three paths are reachable and the output folder is writable AS THIS USER.');
  console.log('  If the button still fails, confirm the backend runs as this same account.');
} else {
  for (const p of problems) console.log(`  · ${p}`);
}
