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
 * before writing this). See lib/pbringGridImport.js for the per-machine
 * override list and why 8 of the 18 needed one.
 *
 * The actual import logic (importAllTemplates/importOneMachine) lives in
 * lib/pbringGridImport.js and is SHARED with the admin "re-import" route
 * (pbringGridController.js) — this file is just the guarded, idempotent
 * one-time entry point; the route is the same logic run on demand.
 *
 * Idempotent: only ever touches the 18 machine_type_name values in
 * TEMPLATE_NAMES (upsert pbring_machine_type, delete+reinsert that machine's
 * pbring_excel_mapping rows, insert a fresh pbring_grid_template row and
 * repoint grid_template_id — the old template row is left orphaned rather
 * than deleted, in case something still references it; a later cleanup pass
 * can remove orphaned pbring_grid_template rows if that matters).
 * `--revert` deletes only rows for these 18 machine names, not a blanket wipe.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const {
  TEMPLATE_NAMES, DEFAULT_TEMPLATE_PATH,
  machineTypeNameFromSheetName, readMappingSheet, importAllTemplates,
} = require('./lib/pbringGridImport');

const revert = process.argv.includes('--revert');

const TEMPLATE_PATH = process.env.PBRING_SDS_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    if (!require('fs').existsSync(TEMPLATE_PATH)) {
      throw new Error(`PB Ring SDS template workbook not found: ${TEMPLATE_PATH} (set PBRING_SDS_TEMPLATE_PATH)`);
    }
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const mappingPairs = await readMappingSheet(wb);
    const byTemplateName = new Map(mappingPairs.map((p) => [p.templateName, p.sheetName]));
    const machineTypeNames = TEMPLATE_NAMES.map((tn) => machineTypeNameFromSheetName(byTemplateName.get(tn) || tn, tn));

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

  const results = await importAllTemplates({ templatePath: TEMPLATE_PATH });
  for (const r of results) {
    console.log(`${r.machineTypeName} (${r.sheetName} / ${r.templateName}): ${r.cellCount} cell(s), ${r.mergeCount} merge(s)`);
    console.log(`  -> ${r.mappingCount} mapping row(s)`);
  }
  const totalMappingRows = results.reduce((s, r) => s + r.mappingCount, 0);

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
