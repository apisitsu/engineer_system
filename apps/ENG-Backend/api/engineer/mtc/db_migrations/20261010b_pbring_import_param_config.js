'use strict';

/**
 * One-time seed of `pbring_sds_param_config` from the same source workbook
 * Phase 5 already imported (`SDS_TemplatesV3.4.2.xlsx`) — Phase 6, problem #3.
 * ------------------------------------------------------------------------------
 * Every grinding sheet's GRIND/DRESS CONDITION area already pairs each
 * `{{param}}` cell with a real static label (and usually a unit) right next
 * to it, e.g. "TOP G.W.  GRIND SPEED" beside `{{Top_GW_Speed}}` beside
 * "min-1". This migration re-derives that pairing straight from the xlsx
 * (same file, same ExcelJS read as the Phase 5 import) so nobody has to
 * retype 500+ labels/units by hand — the admin reviews/adjusts afterward via
 * the PB Ring Parameter Config page, not starting from a blank sheet.
 *
 * Scanning starts at row 16 (0-based row 15) — row 1-15 is the sheet's own
 * header block (Machine/PN/CN/Process/...), already covered by
 * `pbring_sds_param`'s own columns, not part of this table.
 *
 * Only `classifyParam(...).source === 'param'` placeholders are picked up —
 * tool-slot placeholders (Tooling_No_N, VC_N, F_DW_Maker, ...) are a
 * DIFFERENT, already-solved mechanism (`pbring_sds_condition.tool_number`,
 * resolved directly, no config table needed).
 *
 * Label/unit extraction (same heuristic verified live against all 16 sheets,
 * ~98% clean — a few multi-placeholder rows carry extra text in the label
 * that's easy to trim by eye, flagged for the admin, not auto-fixed here):
 *   - label = every non-empty, non-`{{...}}` cell to the LEFT on the same row
 *   - unit  = the first plain cell (no `{{`, doesn't end in ':') within 3
 *             columns to the RIGHT
 *
 * Idempotent: deletes + reinserts each machine's own rows only.
 * `--revert` removes every row this migration ever inserted (same 16
 * machines), not a blanket table wipe.
 */

const ExcelJS = require('exceljs');
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { classifyParam, readMappingSheet, machineTypeNameFromSheetName, DEFAULT_TEMPLATE_PATH } = require('./lib/pbringGridImport');

const revert = process.argv.includes('--revert');

const TEMPLATE_PATH = process.env.PBRING_SDS_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;
const START_ROW = 16;

// The 16 GRINDING sheets only — excludes bfd_qsm200m / bfd_qt200_500u
// (turning), which get their own config later if/when the "Turning" live
// template is brought in the same way.
const GRINDING_SHEETS = [
  'hsg_kvd300', 'hsg_kvd350', 'cgm_omiya', 'cgm_ohmiya20br200', 'cgm_ohmiya18br150',
  'cgm_nissin', 'idg_ksb22', 'idg_ksr22s2', 'gvg_ksr22s2', 'idg_15ksb80', 'gvg_ksr80d',
  'gvg_ks350r2', 'gvg_ks500rf', 'spf_ksh22', 'spf_ksh150', 'notch_gs64pfii',
];

function cellText(row, col) {
  try {
    const t = row.getCell(col).text;
    return t != null ? String(t).trim() : '';
  } catch (e) { return ''; }
}

function extractConditionParams(ws, maxCols) {
  const dims = ws.dimensions;
  const maxRow = dims ? dims.bottom : 60;
  const out = [];
  const reGlobal = /\{\{(\w+)\}\}/g;

  for (let r = START_ROW; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= maxCols; c++) {
      const text = cellText(row, c);
      if (!text || text.indexOf('{{') === -1) continue;
      reGlobal.lastIndex = 0;
      let m;
      while ((m = reGlobal.exec(text))) {
        const paramKey = m[1];
        if (classifyParam(paramKey).source !== 'param') continue;

        const labelParts = [];
        for (let lc = 1; lc < c; lc++) {
          const t = cellText(row, lc);
          if (t && t.indexOf('{{') === -1) labelParts.push(t);
        }
        let unit = '';
        for (let rc = c + 1; rc <= Math.min(c + 3, maxCols); rc++) {
          const t = cellText(row, rc);
          if (!t) continue;
          if (t.indexOf('{{') !== -1 || /:\s*$/.test(t)) break;
          unit = t;
          break;
        }
        out.push({ row: r, param_key: paramKey, label: labelParts.join(' / '), unit });
      }
    }
  }
  return out;
}

/** INSERT in chunks (see .claude/rules/db-patterns.md) — small counts here, one statement is enough. */
async function bulkInsert(rows) {
  if (!rows.length) return 0;
  const cols = ['machine_type_name', 'sort_order', 'label', 'param_key', 'unit', 'created_by'];
  const c = cols.length;
  const placeholders = rows.map((_, ri) => `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
  const values = rows.flatMap((r) => [r.machine_type_name, r.sort_order, r.label || null, r.param_key, r.unit || null, 'import:pbring-sds-template-v3.4.2']);
  await engPool.query(`INSERT INTO pbring_sds_param_config (${cols.join(',')}) VALUES ${placeholders}`, values);
  return rows.length;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (!require('fs').existsSync(TEMPLATE_PATH)) {
    throw new Error(`PB Ring SDS template workbook not found: ${TEMPLATE_PATH} (set PBRING_SDS_TEMPLATE_PATH)`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const mappingPairs = await readMappingSheet(wb);
  const byTemplateName = new Map(mappingPairs.map((p) => [p.templateName, p.sheetName]));
  const machineTypeNames = GRINDING_SHEETS.map((tn) => machineTypeNameFromSheetName(byTemplateName.get(tn) || tn, tn));

  if (revert) {
    await engPool.query('DELETE FROM pbring_sds_param_config WHERE machine_type_name = ANY($1)', [machineTypeNames]);
    console.log(`Reverted: param config rows removed for ${machineTypeNames.join(', ')}`);
    await recordRevert({ file: __filename });
    return;
  }

  let total = 0;
  for (const sheetName of GRINDING_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(sheetName, '-- NOT FOUND, skipped --'); continue; }
    const machineTypeName = machineTypeNameFromSheetName(byTemplateName.get(sheetName) || sheetName, sheetName);
    const cols = (ws.dimensions && ws.dimensions.right) || 50;
    const params = extractConditionParams(ws, cols);

    const seen = new Set();
    const rows = [];
    let order = 1;
    for (const p of params) {
      if (seen.has(p.param_key)) continue; // same key can appear in >1 cell on the sheet (rare) — keep first
      seen.add(p.param_key);
      rows.push({ machine_type_name: machineTypeName, sort_order: order++, label: p.label, param_key: p.param_key, unit: p.unit });
    }

    await engPool.query('DELETE FROM pbring_sds_param_config WHERE machine_type_name = $1', [machineTypeName]);
    const inserted = await bulkInsert(rows);
    total += inserted;
    console.log(`${machineTypeName} (${sheetName}): ${inserted} param config row(s)`);
  }

  console.log(`\nImported ${total} total param config row(s) across ${GRINDING_SHEETS.length} machine(s).`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261010b_pbring_import_param_config.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
