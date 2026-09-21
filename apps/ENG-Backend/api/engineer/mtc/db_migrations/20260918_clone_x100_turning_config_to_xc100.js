'use strict';

/**
 * XC-100 (`sds_machine_type_code` id=16, code 016) — registered since 2026-04-20 but
 * completely unconfigured (no grid template, no `sds_machine_tool` whitelist, no
 * `sds_parameter` values, zero real factory plan rows under its own DWG family 4016-xx).
 * The owner asked for it to be set up as a clone of X-100's Turning setup: same grid
 * template, same T-slot whitelist (so a CN's real factory plan resolves identically
 * regardless of which of the two machine names is picked), same Cutting-Tool (Txx)
 * static text/photo values.
 *
 * Three things this migration does NOT do, because they are handled elsewhere:
 *   - `sds_excel_mapping` (cell wiring) — re-run `20260916_seed_turning_excel_mapping_v2.js
 *     --machine="XC-100"` after this (it's already parametrized per-machine).
 *   - Shared-mapping suppression — re-run `20260916b_suppress_shared_mapping_for_turning.js
 *     --machine="XC-100"` after that (same reason: parametrized, not hardcoded).
 *   - `TURNING_FIXTURE_MACHINES` in sdsV2HeadlessController.js (which IMAGE_EXTENTS a
 *     fixture photo uses) — code, not data; added by hand alongside this migration.
 *
 * Idempotent: grid_template_id set is a plain UPDATE; `sds_machine_tool` and
 * `sds_parameter` copies delete XC-100's own rows for the copied keys first, so
 * re-running just refreshes XC-100 to match X-100's CURRENT values. `--revert` clears
 * grid_template_id back to NULL and removes the copied rows (does not touch X-100).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260918_clone_x100_turning_config_to_xc100.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260918_clone_x100_turning_config_to_xc100.js
 *   node api/engineer/mtc/db_migrations/20260918_clone_x100_turning_config_to_xc100.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const SOURCE = 'X-100';
const TARGET = 'XC-100';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const client = await engPool.connect();
  try {
    const srcRow = await client.query(`SELECT grid_template_id FROM sds_machine_type_code WHERE machine_type_name = $1`, [SOURCE]);
    if (!srcRow.rows[0]) { console.log(`[clone] source machine "${SOURCE}" not found`); return; }
    const gridTemplateId = srcRow.rows[0].grid_template_id;

    const mtRows = await client.query(
      `SELECT tool_number, process_code, tool_drawing_no FROM sds_machine_tool WHERE machine_type = $1`,
      [SOURCE]
    );
    const paramRows = await client.query(
      `SELECT param_key, param_value FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL`,
      [SOURCE]
    );

    console.log(`[clone] ${SOURCE} -> ${TARGET}: grid_template_id=${gridTemplateId}, ${mtRows.rows.length} sds_machine_tool row(s), ${paramRows.rows.length} sds_parameter row(s)`);

    if (dryRun) {
      console.log('[clone] --dry-run — no changes written');
      mtRows.rows.forEach(r => console.log(`  machine_tool: ${r.tool_number} @${r.process_code} -> ${r.tool_drawing_no}`));
      paramRows.rows.forEach(r => console.log(`  parameter: ${r.param_key} = ${r.param_value}`));
      return;
    }

    await client.query('BEGIN');

    if (revert) {
      await client.query(`UPDATE sds_machine_type_code SET grid_template_id = NULL WHERE machine_type_name = $1`, [TARGET]);
      const d1 = await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
      const d2 = await client.query(`DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL`, [TARGET]);
      await client.query('COMMIT');
      console.log(`[revert] cleared grid_template_id, removed ${d1.rowCount} machine_tool row(s), ${d2.rowCount} parameter row(s) for ${TARGET}`);
      await recordRevert({ file: __filename });
      return;
    }

    await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1 WHERE machine_type_name = $2`, [gridTemplateId, TARGET]);

    await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
    if (mtRows.rows.length) {
      await client.query(
        `INSERT INTO sds_machine_tool (machine_type, tool_number, process_code, tool_drawing_no)
         SELECT $1::text, x.tool_number, x.process_code, x.tool_drawing_no
           FROM sds_machine_tool x WHERE x.machine_type = $2`,
        [TARGET, SOURCE]
      );
    }

    await client.query(`DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
      [TARGET, paramRows.rows.map(r => r.param_key)]);
    if (paramRows.rows.length) {
      await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
         SELECT NULL, $1::text, s.param_key, s.param_value, NULL, 'clone-from-x100'
           FROM sds_parameter s WHERE s.machine_type_name = $2 AND s.cn IS NULL`,
        [TARGET, SOURCE]
      );
    }

    await client.query('COMMIT');
    console.log(`[clone] done — ${TARGET} now has grid_template_id=${gridTemplateId}, ${mtRows.rows.length} machine_tool row(s), ${paramRows.rows.length} parameter row(s)`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[clone] FAILED:', e.message); process.exit(1); });
