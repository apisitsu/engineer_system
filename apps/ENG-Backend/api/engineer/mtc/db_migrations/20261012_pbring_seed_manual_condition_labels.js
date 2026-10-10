'use strict';

/**
 * Seeds the LABEL (column A) and UNIT (column F) cells of PB Ring's new
 * manual-entry condition grid (`pbring_sds_parameter`, machine default)
 * from the same source workbook already read for Phase 5/6
 * (`SDS_TemplatesV3.4.2.xlsx`) — re-derives the exact extraction
 * `20261010b_pbring_import_param_config.js` did (same heuristic: label =
 * every non-`{{...}}` cell to the left on the row, unit = the first plain
 * cell within 3 columns to the right that isn't another placeholder and
 * doesn't end in ':'), but writes it into the NEW manual-grid shape instead
 * of the now-dropped `pbring_sds_param_config`.
 *
 * Deliberately does NOT write the VALUE cell (column E) — that is the
 * whole point of the manual-entry pivot (2026-10-08): every value is
 * hand-typed by an admin, same as the real SDS "Excel Parameter Config"
 * tab. Labels and units are static descriptive text lifted from the
 * original xlsx, not part values, so pre-filling them is just sparing the
 * admin from retyping ~500 labels — it does not reintroduce any
 * auto-resolution of actual grinding-condition data.
 *
 * Only the 16 GRINDING sheets (same list `20261010b_` used) — the 2
 * turning machines have no free-form condition area on their template.
 *
 * Row numbers map 1:1 onto the live grid's own rows (16-58, same as
 * `PBRING_ROW_RANGE` in pbringGridService.js) — a machine with more than
 * 43 condition params has the excess logged and skipped rather than
 * silently overflowing into the Grinding Wheel Config area below it.
 *
 * Idempotent: re-extracts and re-upserts each machine's own row_N_A/row_N_F
 * cells every run (`alwaysRerun` — this IS the refresh if the workbook is
 * replaced). Never touches row_N_E (value), row_N_*_type, row_N_is_header,
 * or any CN-override row — those are the admin's own data once entered.
 * `--revert` deletes exactly the row_N_A/row_N_F keys this migration would
 * write, for the same 16 machines, nothing else.
 */

const ExcelJS = require('exceljs');
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { classifyParam, readMappingSheet, machineTypeNameFromSheetName, DEFAULT_TEMPLATE_PATH } = require('./lib/pbringGridImport');
const { saveManualParams, PBRING_ROW_RANGE } = require('../../pbring/pbringGridService');

const revert = process.argv.includes('--revert');

const TEMPLATE_PATH = process.env.PBRING_SDS_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;
const START_ROW = 16;
const MAX_ROWS = PBRING_ROW_RANGE.length; // 43 (rows 16-58)

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
        out.push({ param_key: paramKey, label: labelParts.join(' / '), unit });
      }
    }
  }
  return out;
}

async function main() {
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  if (!require('fs').existsSync(TEMPLATE_PATH)) {
    throw new Error(`PB Ring SDS template workbook not found: ${TEMPLATE_PATH} (set PBRING_SDS_TEMPLATE_PATH)`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const mappingPairs = await readMappingSheet(wb);
  const byTemplateName = new Map(mappingPairs.map((p) => [p.templateName, p.sheetName]));
  const machineTypeNames = GRINDING_SHEETS.map((tn) => machineTypeNameFromSheetName(byTemplateName.get(tn) || tn, tn));

  if (revert) {
    const params = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const rowNum = PBRING_ROW_RANGE[i];
      params.push({ param_key: `row_${rowNum}_A`, delete: true }, { param_key: `row_${rowNum}_F`, delete: true });
    }
    for (const name of machineTypeNames) {
      await saveManualParams(name, null, null, params, 'import:pbring-sds-template-v3.4.2-labels');
    }
    console.log(`Reverted: row_N_A/row_N_F cleared for ${machineTypeNames.join(', ')}`);
    await recordRevert({ file: __filename });
    return;
  }

  let total = 0;
  for (const sheetName of GRINDING_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(sheetName, '-- NOT FOUND, skipped --'); continue; }
    const machineTypeName = machineTypeNameFromSheetName(byTemplateName.get(sheetName) || sheetName, sheetName);
    const cols = (ws.dimensions && ws.dimensions.right) || 50;
    const extracted = extractConditionParams(ws, cols);

    const seen = new Set();
    const deduped = [];
    for (const p of extracted) {
      if (seen.has(p.param_key)) continue; // same key can appear in >1 cell on the sheet (rare) — keep first
      seen.add(p.param_key);
      deduped.push(p);
    }
    if (deduped.length > MAX_ROWS) {
      console.log(`${machineTypeName}: ${deduped.length} condition params found, grid only has ${MAX_ROWS} rows — skipping the last ${deduped.length - MAX_ROWS}`);
    }

    const params = [];
    deduped.slice(0, MAX_ROWS).forEach((p, i) => {
      const rowNum = PBRING_ROW_RANGE[i];
      params.push({ param_key: `row_${rowNum}_A`, param_value: p.label || '' });
      params.push({ param_key: `row_${rowNum}_F`, param_value: p.unit || '' });
    });

    const saved = await saveManualParams(machineTypeName, null, null, params, 'import:pbring-sds-template-v3.4.2-labels');
    total += saved.length;
    console.log(`${machineTypeName} (${sheetName}): ${Math.min(deduped.length, MAX_ROWS)} label/unit row(s)`);
  }

  console.log(`\nSeeded ${total} label/unit cell(s) across ${GRINDING_SHEETS.length} machine(s). Value column (E) left blank for hand entry.`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261012_pbring_seed_manual_condition_labels.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
