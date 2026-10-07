'use strict';

/**
 * One-time import: the 18 PB Ring machines' SDS grid templates, read from the
 * user's own pre-built workbook `SDS_TemplatesV3.4.2.xlsx` (outside this repo,
 * sibling project — same env-override convention as PBRING_IMPORT_DIR used by
 * 20261003c_pbring_import_from_prototype.js).
 * ------------------------------------------------------------------------------
 * Every sheet already has its dynamic cells written as literal {{param_key}}
 * placeholders, so both the static grid layout AND the cell->param mapping are
 * derived from the workbook in one pass (see lib/pbringGridImport.js) — no
 * hand-built admin editor needed first. Scoped to exactly the 18 machines PB
 * Ring tooling actually uses today (decided with the user 2026-10-07); the
 * other ~23 tabs in the workbook belong to machine families with zero rows in
 * pbring_tooling and would be dead config.
 *
 * machine_type_name is derived from the _Mapping sheet's SDS-spelled
 * SheetName (e.g. "HSG_kvd300") by stripping the category prefix up to the
 * first underscore and uppercasing — "HSG_kvd300" -> "KVD300", which matches
 * pbring_tooling.mc_key exactly (verified live for every overlapping machine
 * before writing this).
 *
 * Idempotent: only ever touches the 18 machine_type_name values in MACHINES
 * below (upsert pbring_machine_type, delete+reinsert that machine's
 * pbring_excel_mapping rows, insert a fresh pbring_grid_template row and
 * repoint grid_template_id — the old template row is left orphaned rather
 * than deleted, in case something still references it; a later cleanup pass
 * can remove orphaned pbring_grid_template rows if that matters).
 * `--revert` deletes only rows for these 18 machine names, not a blanket wipe.
 */

const path = require('path');
const ExcelJS = require('exceljs');
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { gridFromWorksheet, extractMappings } = require('./lib/pbringGridImport');

const revert = process.argv.includes('--revert');

const TEMPLATE_PATH = process.env.PBRING_SDS_TEMPLATE_PATH
  || 'C:\\User DATA\\PB_Ring_SDS_Project\\SDS_TemplatesV3.4.2.xlsx';

// The 18 visible, highlighted TemplateName values (xlsx tab names) confirmed
// live against pbring_tooling's actual machine roster.
const TEMPLATE_NAMES = [
  'bfd_qsm200m', 'bfd_qt200_500u', 'hsg_kvd300', 'hsg_kvd350', 'cgm_omiya',
  'cgm_ohmiya20br200', 'cgm_ohmiya18br150', 'cgm_nissin', 'idg_ksb22', 'idg_ksr22s2',
  'gvg_ksr22s2', 'idg_15ksb80', 'gvg_ksr80d', 'gvg_ks350r2', 'gvg_ks500rf',
  'spf_ksh22', 'spf_ksh150', 'notch_gs64pfii',
];

// The naive "strip category prefix, uppercase" rule only matches the real
// mc_key for 10 of the 18 sheets — the workbook's abbreviation convention
// genuinely differs from PB Ring's own mc_key spelling for the rest. Every
// value below is verified against live mc_key values in pbring_tooling AND
// pbring_sds_param/pbring_sds_condition (the latter two have broader machine
// coverage than pbring_tooling alone), not guessed from the sheet name:
//   - idg_15ksb80       -> KSB80          (the "15" is not part of the key)
//   - notch_gs64pfii    -> GS64PF         (stored key drops the "II" suffix)
//   - cgm_nissin        -> HIGRIND1D      ("NISSIN (HI-GRIND 1-D)" mc_type)
//   - cgm_ohmiya18br150 -> OC18BR150      (stored key drops "ohmiya")
//   - cgm_ohmiya20br200 -> OC20BR200
//   - bfd_qsm200m       -> QTSMART200M    (matches pbringConstants.MACHINE_ALIAS's
//                                          QUICKTURNSMART200M -> QTSMART200M)
//   - bfd_qt200_500u    -> QUICKTURN200500U
// KS-R22S2 is additionally the one machine with two DIFFERENT template sheets
// (idg_ksr22s2 = ID GRIND, process 1061; gvg_ksr22s2 = GROOVE GRIND, mostly
// process 1161) — verified live against pbring_sds_param's process_name for
// mc_key='KSR22S2'. Stripping the category prefix would collide both onto
// "KSR22S2" and silently overwrite one with the other, so gvg_ksr22s2 keeps
// a category suffix instead of a real mc_key (it's a template variant, not a
// distinct machine — the PDF route picks between the two by process_code).
const MACHINE_TYPE_NAME_OVERRIDE = {
  idg_15ksb80: 'KSB80',
  notch_gs64pfii: 'GS64PF',
  cgm_nissin: 'HIGRIND1D',
  cgm_ohmiya18br150: 'OC18BR150',
  cgm_ohmiya20br200: 'OC20BR200',
  bfd_qsm200m: 'QTSMART200M',
  bfd_qt200_500u: 'QUICKTURN200500U',
  gvg_ksr22s2: 'KSR22S2_GVG',
};

/** "HSG_kvd300" -> "KVD300" (strip the category prefix up to the first underscore, uppercase). */
function machineTypeNameFromSheetName(sheetName, templateName) {
  if (templateName && MACHINE_TYPE_NAME_OVERRIDE[templateName]) return MACHINE_TYPE_NAME_OVERRIDE[templateName];
  const idx = sheetName.indexOf('_');
  const tail = idx === -1 ? sheetName : sheetName.slice(idx + 1);
  return tail.toUpperCase();
}

async function readMappingSheet(wb) {
  const ws = wb.getWorksheet('_Mapping');
  const pairs = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header: SheetName, TemplateName
    const sheetName = row.getCell(1).value;
    const templateName = row.getCell(2).value;
    if (sheetName && templateName) pairs.push({ sheetName: String(sheetName), templateName: String(templateName) });
  });
  return pairs;
}

/** INSERT in chunks — never a per-row loop (see .claude/rules/db-patterns.md). */
async function bulkInsertMappings(rows) {
  if (!rows.length) return 0;
  const cols = ['machine_type_name', 'cell_address', 'param_key', 'source', 'tool_number', 'condition_field'];
  const c = cols.length;
  const placeholders = rows.map((_, ri) => `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
  const values = rows.flatMap((r) => [r.machine_type_name, r.cell_address, r.param_key, r.source, r.tool_number || null, r.condition_field || null]);
  await engPool.query(`INSERT INTO pbring_excel_mapping (${cols.join(',')}) VALUES ${placeholders}`, values);
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

  // Not every tab has a _Mapping row (e.g. "cgm_omiya" is a real, visible tab
  // with no corresponding SheetName entry in the legend) — fall back to
  // deriving straight from the tab's own TemplateName in that case.
  const machineTypeNames = TEMPLATE_NAMES.map((tn) => machineTypeNameFromSheetName(byTemplateName.get(tn) || tn, tn));

  if (revert) {
    await engPool.query('DELETE FROM pbring_excel_mapping WHERE machine_type_name = ANY($1)', [machineTypeNames]);
    const { rows: tmplIds } = await engPool.query(
      `SELECT grid_template_id FROM pbring_machine_type WHERE machine_type_name = ANY($1) AND grid_template_id IS NOT NULL`,
      [machineTypeNames]
    );
    await engPool.query('DELETE FROM pbring_machine_type WHERE machine_type_name = ANY($1)', [machineTypeNames]);
    if (tmplIds.length) {
      await engPool.query('DELETE FROM pbring_grid_template WHERE id = ANY($1)', [tmplIds.map((r) => r.grid_template_id)]);
    }
    console.log(`Reverted: ${machineTypeNames.length} machine(s) — mapping/machine_type/grid_template rows removed for ${machineTypeNames.join(', ')}`);
    await recordRevert({ file: __filename });
    return;
  }

  let totalMappingRows = 0;
  for (const templateName of TEMPLATE_NAMES) {
    const sheetName = byTemplateName.get(templateName) || templateName;
    const machineTypeName = machineTypeNameFromSheetName(sheetName, templateName);

    const ws = wb.getWorksheet(templateName);
    if (!ws) throw new Error(`Workbook has no worksheet tab named "${templateName}"`);
    const dims = ws.dimensions;
    const rows = dims ? dims.bottom : 56;
    const cols = dims ? dims.right : 50;

    const grid = gridFromWorksheet(ws, rows, cols);
    const mappings = extractMappings(ws, rows, cols).map((m) => ({ ...m, machine_type_name: machineTypeName }));

    const client = await engPool.connect();
    try {
      await client.query('BEGIN');

      const { rows: gtRows } = await client.query(
        `INSERT INTO pbring_grid_template (name, grid_json, is_default, created_by)
         VALUES ($1, $2, false, 'import:pbring-sds-template-v3.4.2') RETURNING id`,
        [`${machineTypeName} (imported v3.4.2)`, JSON.stringify(grid)]
      );
      const gridTemplateId = gtRows[0].id;

      await client.query(
        `INSERT INTO pbring_machine_type (machine_type_name, source_sheet_name, grid_template_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (machine_type_name) DO UPDATE
           SET source_sheet_name = EXCLUDED.source_sheet_name, grid_template_id = EXCLUDED.grid_template_id, updated_at = now()`,
        [machineTypeName, sheetName, gridTemplateId]
      );

      await client.query('DELETE FROM pbring_excel_mapping WHERE machine_type_name = $1', [machineTypeName]);

      await client.query('COMMIT');
      console.log(`${machineTypeName} (${sheetName} / ${templateName}): grid ${rows}x${cols}, ${Object.keys(grid.cells).length} cell(s), ${grid.merges.length} merge(s)`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Bulk-insert mapping rows outside the transaction's per-row path (still
    // one statement, chunking isn't needed at this row count — dozens, not
    // thousands — but kept as its own statement for clarity).
    const inserted = await bulkInsertMappings(mappings);
    totalMappingRows += inserted;
    console.log(`  -> ${inserted} mapping row(s)`);
  }

  console.log(`\nImported ${TEMPLATE_NAMES.length} machine(s), ${totalMappingRows} total mapping row(s).`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261009_pbring_import_grid_templates.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
