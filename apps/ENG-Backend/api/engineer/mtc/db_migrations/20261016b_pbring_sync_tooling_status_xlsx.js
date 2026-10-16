'use strict';

/**
 * Sync `pbring_tooling` from the user's updated "Tooling status for all of PB
 * Ring Parts.xlsx" (sheet "Raw Data Tooling List"), per request 2026-10-16.
 *
 * Matching key: (mc_key, part_no, process_code, tool_code_base, tooling_item).
 * `tool_code_base` is the leading whitespace-token of `tool_code` — confirmed
 * live against the DB's own derivation (e.g. "B325N75DS22X  305x76.3x10x28.5T"
 * -> "B325N75DS22X"), same rule pbringGridService.js's `leadingToken` uses.
 * `mc_key` comes from the same `mk()`/`ALIAS`/`nk()` normalization the ORIGINAL
 * import (20261003c_pbring_import_from_prototype.js) used, so machine names
 * line up exactly with what is already in the table.
 *
 * Only SOFT fields are ever written — part_name, process_name, mc_no,
 * tool_code, maker, po_no, machine_qty, order_qty, unit_price, total_price,
 * receive_date, status, remark, pic, new_dwg_no, rank. Never cn, mc_key,
 * tool_code_base (except via the secondary tool_code-change pass below), id,
 * created_by. This is a sync of tracking/cost data, not a re-import.
 *
 * COST-FIELD PROTECTION (user decision, 2026-10-16): for a row whose
 * `cost_source = 'maqdb'` — meaning an approver already confirmed its cost
 * against the real factory purchase record via Cost Update Found
 * (`pbringCostDetectService.approvePending`) — the 6 fields that approval
 * writes (po_no, unit_price, order_qty, total_price, receive_date, status)
 * are EXCLUDED from this sync, even when the Excel sheet disagrees. maqdb is
 * the authoritative source for those once approved; the spreadsheet is the
 * slower, human-maintained copy. Every other field (tooling_item, remark,
 * pic, rank, …) still syncs normally for such a row. A real difference in a
 * protected field is reported at the end, never written, for manual review.
 * A row that is still `cost_source != 'maqdb'` (the normal case) syncs ALL
 * soft fields exactly as before — this protection is scoped narrowly.
 *
 * Two passes:
 *   1. Primary match (full 5-part key) — updates any of the soft fields that
 *      differ. Verified live before this migration was written: 1298/2043
 *      rows identical, 739 differ (mostly total_price/receive_date/status/
     *      unit_price/order_qty/po_no), 6 unmatched per side.
 *   2. Secondary match for the small 6/6 leftover, by (mc_key, part_no,
 *      process_code, tooling_item) WITHOUT tool_code_base — these are the
 *      same physical line item whose tool_code itself changed (e.g. a
 *      placeholder "Wait" replaced by a real drawing number), not a new or
 *      deleted item. Only applied when exactly one candidate remains on each
 *      side after the primary pass; anything still unresolved is reported,
 *      never inserted or deleted (would need to fabricate a `cn` / silently
 *      drop real history — out of scope for a sync run).
 *
 * Safety: the whole table is snapshotted to `pbring_tooling_sync_backup_20261016`
 * before any write (created once; a second run under guard() never re-snapshots
 * over itself). `--revert` restores the table from that snapshot verbatim.
 *
 * Idempotent: a clean re-run finds zero diffs (this is itself the proof the
 * sync worked) and writes nothing.
 */

const XLSX = require('xlsx');
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const XLSX_PATH = process.env.PBRING_TOOLING_XLSX
  || 'C:\\User DATA\\PB_Ring_SDS_Project\\Tooling status for all of PB Ring Parts.xlsx';
const BACKUP_TABLE = 'pbring_tooling_sync_backup_20261016';

const nk = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALIAS = {
  KVD300CRII: 'KVD300', KVD350C: 'KVD350', NISSINHIGRIND1D: 'HIGRIND1D',
  QUICKTURNSMART200M: 'QTSMART200M', KSB80PB: 'KSB80',
};
const mk = (s) => { const k = nk(s); return ALIAS[k] || k; };

function toolCodeBase(toolCode) {
  if (!toolCode) return null;
  return String(toolCode).trim().split(/\s+/)[0] || null;
}
function normStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function normNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
// For COMPARISON only — a display-normalized d/m/yyyy string. Never passed to
// Postgres directly (see dateForWrite below): the sheet's Receive Date column
// also carries free-text notes ("(In stock 1 Pc.)", "(Common Item)") that are
// not dates at all, and `receive_date` is a real `date` column — one bad
// string here throws `invalid input syntax for type date` mid-UPDATE. Caught
// live 2026-10-16 on exactly such a row; the fix is dateForWrite() treating a
// non-parsing value as "no update" rather than sending it to Postgres.
function normDate(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  return s;
}

// For WRITING — an ISO 'YYYY-MM-DD' string Postgres' `date` column accepts, or
// `undefined` (sentinel: field is left out of the UPDATE entirely, keeping
// whatever the DB already has) when the cell is not a real date.
function dateForWrite(v) {
  if (v === undefined || v === null || v === '') return null; // explicit blank → NULL is fine
  const disp = normDate(v); // d/m/yyyy, day/month zero-padded
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(disp);
  if (!m) return undefined; // not a real date (a note like "(Common Item)") → don't touch the column
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function readExcelRows() {
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const ws = wb.Sheets['Raw Data Tooling List'];
  if (!ws) throw new Error(`Sheet "Raw Data Tooling List" not found in ${XLSX_PATH}`);
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return raw.map((r) => ({
    part_group: normStr(r['Part']),
    part_name: normStr(r['Part Name']),
    part_no: normStr(r['Part No.']),
    process_code: normStr(r['Process Code']),
    process_name: normStr(r['Process Name']),
    mc_type: normStr(r['M/C Type']),
    mc_key: mk(r['M/C Type']),
    mc_no: normStr(r['M/C No.']),
    tooling_item: normStr(r['Tooling Item']),
    tool_code: normStr(r['Tool code']),
    tool_code_base: toolCodeBase(r['Tool code']),
    maker: normStr(r['Maker']),
    po_no: normStr(r['P/O No.']),
    machine_qty: normNum(r["Machine Q'ty (Pcs.)"]),
    order_qty: normNum(r["Order Q'ty (Pcs.)"]),
    unit_price: normNum(r['Unit Price (THB)']),
    total_price: normNum(r['Total Price (THB)']),
    receive_date: normDate(r['Receive Date']),
    receive_date_write: dateForWrite(r['Receive Date']),
    status: normStr(r['Status']),
    remark: normStr(r['Remark']),
    pic: normStr(r['Person In Charge (PIC)']),
    new_dwg_no: normStr(r['New DWG No.']),
    rank: normNum(r['Rank']),
  })).filter((r) => r.part_group || r.tool_code || r.tooling_item);
}

const SOFT_FIELDS = [
  'part_name', 'process_name', 'mc_no', 'tool_code', 'maker', 'po_no',
  'machine_qty', 'order_qty', 'unit_price', 'total_price', 'receive_date',
  'status', 'remark', 'pic', 'new_dwg_no', 'rank',
];
const NUMERIC_FIELDS = new Set(['machine_qty', 'order_qty', 'unit_price', 'total_price', 'rank']);

// The exact 6 fields `pbringCostDetectService.approvePending()` writes when an
// admin approves a detected maqdb cost match. User decision (2026-10-16): once
// a row's cost has been confirmed against the real factory purchase record
// (cost_source='maqdb'), the Excel sync must never silently overwrite these —
// the spreadsheet is the slower-moving, human-maintained copy, maqdb is the
// authoritative one. Every OTHER field (tooling_item, remark, pic, rank, …)
// still syncs normally even for a maqdb-sourced row — only cost itself is
// protected, so a renamed tooling_item or corrected PIC still comes through.
const MAQDB_PROTECTED_FIELDS = ['po_no', 'unit_price', 'order_qty', 'total_price', 'receive_date', 'status'];

function fieldsToSync(dbRow) {
  if (dbRow.cost_source === 'maqdb') return SOFT_FIELDS.filter((f) => !MAQDB_PROTECTED_FIELDS.includes(f));
  return SOFT_FIELDS;
}

function fieldDiffs(excelRow, dbRow, fields) {
  const diffs = [];
  for (const f of fields) {
    const ev = excelRow[f];
    let dv = dbRow[f];
    if (NUMERIC_FIELDS.has(f)) dv = dv === null || dv === undefined ? null : Number(dv);
    else if (f === 'receive_date') dv = normDate(dv);
    else dv = normStr(dv);
    if (String(ev) !== String(dv)) diffs.push(f);
  }
  return diffs;
}

// For reporting only — which protected fields would have differed, on a
// maqdb-sourced row, had they not been skipped. Lets the sync output name the
// exact rows worth a manual look rather than silently doing nothing.
function protectedFieldDiffs(excelRow, dbRow) {
  if (dbRow.cost_source !== 'maqdb') return [];
  return fieldDiffs(excelRow, dbRow, MAQDB_PROTECTED_FIELDS);
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const r of arr) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rows: exists } = await engPool.query(
      `SELECT to_regclass($1) AS t`, [BACKUP_TABLE]
    );
    if (!exists[0].t) {
      console.log(`no backup table ${BACKUP_TABLE} found — nothing to revert`);
      await recordRevert({ file: __filename });
      return;
    }
    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM pbring_tooling`);
      await client.query(`INSERT INTO pbring_tooling SELECT * FROM ${BACKUP_TABLE}`);
      await client.query(`SELECT setval(pg_get_serial_sequence('pbring_tooling','id'), COALESCE((SELECT MAX(id) FROM pbring_tooling), 1))`);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    console.log('reverted: pbring_tooling restored from', BACKUP_TABLE);
    await recordRevert({ file: __filename });
    return;
  }

  const excelRows = readExcelRows();
  console.log(`Excel rows: ${excelRows.length}`);

  const { rows: dbRows } = await engPool.query(
    `SELECT id, part_group, cn, part_name, part_no, process_code, process_name, mc_type, mc_key,
            mc_no, tooling_item, tool_code, tool_code_base, tool_rev, maker, po_no, machine_qty,
            order_qty, unit_price, total_price, receive_date, status, remark, pic, new_dwg_no, rank,
            cost_source
       FROM pbring_tooling`
  );
  console.log(`DB rows (pbring_tooling): ${dbRows.length}`);

  await engPool.query(`CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} AS SELECT * FROM pbring_tooling`);
  console.log(`backup snapshot: ${BACKUP_TABLE} (created if it did not already exist)`);

  const fullKey = (r) => [r.mc_key || '', r.part_no || '', r.process_code || '', r.tool_code_base || '', r.tooling_item || ''].join('\u0001');
  const dbGroups = groupBy(dbRows, fullKey);
  const excelGroups = groupBy(excelRows, fullKey);
  const allKeys = new Set([...dbGroups.keys(), ...excelGroups.keys()]);

  let updated = 0, unchanged = 0, skippedBadDate = 0;
  const leftoverExcel = [];
  const leftoverDb = [];
  const plannedUpdates = []; // { id, er, dr, fields, includeToolCode }
  const maqdbProtected = []; // rows where a protected cost field differed and was left alone

  for (const k of allKeys) {
    const eList = excelGroups.get(k) || [];
    const dList = dbGroups.get(k) || [];
    const n = Math.min(eList.length, dList.length);
    for (let i = 0; i < n; i++) {
      const er = eList[i], dr = dList[i];
      const fields = fieldsToSync(dr);
      const diffs = fieldDiffs(er, dr, fields);
      const protDiffs = protectedFieldDiffs(er, dr);
      if (protDiffs.length) maqdbProtected.push({ dr, er, protDiffs });
      if (!diffs.length) { unchanged++; continue; }
      plannedUpdates.push({ id: dr.id, er, fields, includeToolCode: false });
      updated++;
    }
    for (let i = n; i < eList.length; i++) leftoverExcel.push(eList[i]);
    for (let i = n; i < dList.length; i++) leftoverDb.push(dList[i]);
  }

  // Secondary pass: same (mc_key, part_no, process_code, tooling_item), tool_code
  // itself changed. Only when exactly one candidate remains on each side.
  const looseKey = (r) => [r.mc_key || '', r.part_no || '', r.process_code || '', r.tooling_item || ''].join('\u0001');
  const leftoverExcelByLoose = groupBy(leftoverExcel, looseKey);
  const leftoverDbByLoose = groupBy(leftoverDb, looseKey);
  let tooling_code_updated = 0;
  const stillUnmatchedExcel = [];
  const stillUnmatchedDb = [];
  const matchedDbIds = new Set();

  for (const [k, eList] of leftoverExcelByLoose) {
    const dList = leftoverDbByLoose.get(k) || [];
    if (eList.length === 1 && dList.length === 1) {
      const er = eList[0], dr = dList[0];
      const fields = fieldsToSync(dr);
      const protDiffs = protectedFieldDiffs(er, dr);
      if (protDiffs.length) maqdbProtected.push({ dr, er, protDiffs });
      plannedUpdates.push({ id: dr.id, er, fields, includeToolCode: true });
      matchedDbIds.add(dr.id);
      tooling_code_updated++;
    } else {
      for (const er of eList) stillUnmatchedExcel.push(er);
    }
  }
  for (const [k, dList] of leftoverDbByLoose) {
    const eList = leftoverExcelByLoose.get(k) || [];
    if (!(eList.length === 1 && dList.length === 1)) {
      for (const dr of dList) if (!matchedDbIds.has(dr.id)) stillUnmatchedDb.push(dr);
    }
  }

  // Everything below runs as ONE transaction — a bad value anywhere rolls the
  // whole sync back rather than leaving a partial write (caught live
  // 2026-10-16: an unguarded per-statement run left 2 rows updated before a
  // bad receive_date crashed it, requiring a manual restore from backup).
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, er, fields: rowFields, includeToolCode } of plannedUpdates) {
      const fields = rowFields.filter((f) => f !== 'receive_date');
      const setParts = [];
      const params = [];
      let i = 1;
      for (const f of fields) {
        setParts.push(`${f} = $${i}`);
        params.push(er[f]);
        i++;
      }
      if (!rowFields.includes('receive_date')) {
        // maqdb-protected row — receive_date isn't in this row's sync scope at all
      } else if (er.receive_date_write === undefined) {
        skippedBadDate++;
      } else {
        setParts.push(`receive_date = $${i}`);
        params.push(er.receive_date_write);
        i++;
      }
      if (includeToolCode) {
        setParts.push(`tool_code_base = $${i}`);
        params.push(er.tool_code_base);
        i++;
      }
      setParts.push(`updated_at = NOW()`);
      params.push(id);
      await client.query(
        `UPDATE pbring_tooling SET ${setParts.join(', ')} WHERE id = $${i}`,
        params
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  console.log('\n=== RESULT ===');
  console.log(`unchanged: ${unchanged}`);
  console.log(`updated (soft fields): ${updated}`);
  console.log(`updated (tool_code changed, secondary match): ${tooling_code_updated}`);
  console.log(`receive_date left as-is (Excel cell was a note, not a date): ${skippedBadDate}`);
  console.log(`still unresolved (only in Excel, not written — needs manual review): ${stillUnmatchedExcel.length}`);
  for (const r of stillUnmatchedExcel) console.log(`    [${r.part_group}] ${r.mc_key} / ${r.part_no} / ${r.process_code} / ${r.tooling_item} / ${r.tool_code}`);
  console.log(`still unresolved (only in DB, not touched — needs manual review): ${stillUnmatchedDb.length}`);
  for (const r of stillUnmatchedDb) console.log(`    [${r.part_group}] ${r.mc_key} / ${r.part_no} / ${r.process_code} / ${r.tooling_item} / ${r.tool_code} (id=${r.id}, cn=${r.cn})`);
  console.log(`cost fields skipped — row is cost_source='maqdb' (approved against real purchase data, Excel's copy not trusted to overwrite it): ${maqdbProtected.length}`);
  for (const { dr, protDiffs } of maqdbProtected) {
    console.log(`    [${dr.part_group}] ${dr.mc_key} / ${dr.part_no} / ${dr.process_code} / ${dr.tooling_item} (id=${dr.id}) — differs in: ${protDiffs.join(', ')}`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261016b_pbring_sync_tooling_status_xlsx.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
