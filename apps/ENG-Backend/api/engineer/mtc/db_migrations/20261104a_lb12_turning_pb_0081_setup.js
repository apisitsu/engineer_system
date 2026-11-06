'use strict';

/**
 * LB12 (`sds_machine_type_code` id=211, process 0081 "Turning_PB") — CN314110
 * needs a Setup Data Sheet here. LB12 had `grid_template_id = NULL` (no sheet
 * could render). CN314110's factory process plan at 0081 carries no tooling at
 * all (confirmed via sdsV2SearchService), so no `sds_machine_tool` row is added
 * here — there is nothing to whitelist yet. Add one later if a CN that needs
 * tooling at (LB12, 0081) turns up.
 *
 * This migration only sets `grid_template_id`. `sds_excel_mapping` (cell wiring)
 * and the shared-mapping suppression are handled by the companion seeds — run
 * after this:
 *   node api/engineer/mtc/db_migrations/20261104b_seed_turning_pb_excel_mapping.js --machine="LB12"
 *   node api/engineer/mtc/db_migrations/20261104c_suppress_shared_mapping_for_turning_pb.js --machine="LB12"
 *
 * Idempotent: plain UPDATE. `--revert` clears grid_template_id back to NULL.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104a_lb12_turning_pb_0081_setup.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261104a_lb12_turning_pb_0081_setup.js
 *   node api/engineer/mtc/db_migrations/20261104a_lb12_turning_pb_0081_setup.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const MACHINE = 'LB12';
const GRID_TEMPLATE_ID = 9; // "Turning_PB"

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    if (dryRun) {
      console.log(`[dry-run] would set sds_machine_type_code.grid_template_id=${GRID_TEMPLATE_ID} for ${MACHINE}`);
      return;
    }

    await client.query('BEGIN');

    if (revert) {
      await client.query(`UPDATE sds_machine_type_code SET grid_template_id = NULL WHERE machine_type_name = $1`, [MACHINE]);
      await client.query('COMMIT');
      console.log(`[revert] cleared grid_template_id for ${MACHINE}`);
      await recordRevert({ file: __filename });
      return;
    }

    await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1 WHERE machine_type_name = $2`, [GRID_TEMPLATE_ID, MACHINE]);

    await client.query('COMMIT');
    console.log(`[done] ${MACHINE}: grid_template_id=${GRID_TEMPLATE_ID}`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[FAILED]', e.message); process.exit(1); });
