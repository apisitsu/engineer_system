'use strict';

/**
 * Moves LB12 and QTN200 onto "Turning_General" (`sds_grid_template`, created by
 * `20261104d_create_turning_general_grid_template.js`) — consolidating both
 * machines onto one template/admin workflow instead of LB12 on Turning_PB (id=9)
 * and QTN200 on the older "Turning" (id=8). Decided with the requester after
 * confirming Turning_General carries the one fixture slot QTN200 needs.
 *
 * Does NOT touch `sds_excel_mapping` or `sds_machine_tool` — those are handled by
 * the companion migrations/scripts, run in this order after this one:
 *   1. (QTN200 only) remove its now-stale "Turning" (id=8) mapping:
 *      node .../20260916_seed_turning_excel_mapping_v2.js --machine="QTN200" --revert
 *      node .../20260916b_suppress_shared_mapping_for_turning.js --machine="QTN200" --revert
 *   2. (QTN200 + LB12) seed the 12-slot Turning_PB-shape mapping — same cell
 *      addresses regardless of template id, since Turning_General is a clone:
 *      node .../20261104b_seed_turning_pb_excel_mapping.js --machine="QTN200" --machine="LB12"
 *      node .../20261104c_suppress_shared_mapping_for_turning_pb.js --machine="QTN200" --machine="LB12"
 *   3. (QTN200 + LB12) seed the new fixture slot:
 *      node .../20261104f_seed_turning_general_fixture_mapping.js --machine="QTN200" --machine="LB12"
 *
 * Idempotent: plain UPDATE. `--revert` sets both back to their PRIOR template
 * (LB12 -> 9, QTN200 -> 8) — does not touch sds_excel_mapping either; re-run the
 * original Turning/Turning_PB seeds for whichever machine needs its mapping back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104e_move_lb12_qtn200_to_turning_general.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261104e_move_lb12_qtn200_to_turning_general.js
 *   node api/engineer/mtc/db_migrations/20261104e_move_lb12_qtn200_to_turning_general.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TURNING_GENERAL_ID = 10;
const PRIOR = { LB12: 9, QTN200: 8 };

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    if (dryRun) {
      console.log(`[dry-run] would set grid_template_id=${TURNING_GENERAL_ID} for LB12 and QTN200`);
      return;
    }

    await client.query('BEGIN');

    if (revert) {
      for (const [machine, priorId] of Object.entries(PRIOR)) {
        await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1 WHERE machine_type_name = $2`, [priorId, machine]);
      }
      await client.query('COMMIT');
      console.log(`[revert] LB12 -> ${PRIOR.LB12}, QTN200 -> ${PRIOR.QTN200}`);
      await recordRevert({ file: __filename });
      return;
    }

    for (const machine of Object.keys(PRIOR)) {
      await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1 WHERE machine_type_name = $2`, [TURNING_GENERAL_ID, machine]);
    }

    await client.query('COMMIT');
    console.log(`[done] LB12 and QTN200 -> grid_template_id=${TURNING_GENERAL_ID} (Turning_General)`);
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
