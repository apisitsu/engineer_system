'use strict';

/**
 * Register a brand-new machine, "XD-8T" (floor code SBT-16 — documentation only, no DB
 * column for it, same as HAMAI 5B's VSG-02 in CLAUDE.md), and assign it the Turning grid
 * template. No DWG family exists for it in the factory (it is a genuinely new machine,
 * not a rename), so `machine_type_code` has no natural value to derive — 041 is simply
 * the first unused 3-digit code, picked the same way `20260815_` picked codes for the
 * other brand-new machines that week.
 *
 * This migration ONLY creates the registry row and assigns the grid template. Two more
 * steps still need to run by hand afterward (both already parametrized by --machine,
 * unchanged from the XC-100 clone):
 *   node .../20260916_seed_turning_excel_mapping_v2.js --machine="XD-8T"
 *   node .../20260916b_suppress_shared_mapping_for_turning.js --machine="XD-8T"
 *
 * Idempotent: `ON CONFLICT (machine_type_code) DO NOTHING` on insert (checked by code,
 * not name, since machine_type_code is the actual unique key); a re-run after the row
 * exists just confirms it and moves on. `--revert` deletes the row IF it has no
 * sds_parameter / sds_excel_mapping / sds_machine_tool data left — refuses otherwise, so
 * a revert never silently discards config that was seeded after registration.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260919_register_xd8t_machine.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260919_register_xd8t_machine.js
 *   node api/engineer/mtc/db_migrations/20260919_register_xd8t_machine.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const MACHINE_TYPE_CODE = '041';
const MACHINE_NAME = 'XD-8T';
const TURNING_TEMPLATE_ID = 8;
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const paramCount = await client.query(`SELECT count(*) FROM sds_parameter WHERE machine_type_name = $1`, [MACHINE_NAME]);
      const mapCount = await client.query(`SELECT count(*) FROM sds_excel_mapping WHERE machine_type_name = $1`, [MACHINE_NAME]);
      const mtCount = await client.query(`SELECT count(*) FROM sds_machine_tool WHERE machine_type = $1`, [MACHINE_NAME]);
      const total = Number(paramCount.rows[0].count) + Number(mapCount.rows[0].count) + Number(mtCount.rows[0].count);
      if (total > 0) {
        console.log(`[revert] refusing — ${MACHINE_NAME} still has ${paramCount.rows[0].count} parameter row(s), ${mapCount.rows[0].count} mapping row(s), ${mtCount.rows[0].count} machine_tool row(s). Remove those first.`);
        return;
      }
      await client.query('BEGIN');
      const del = await client.query(`DELETE FROM sds_machine_type_code WHERE machine_type_code = $1 AND machine_type_name = $2`, [MACHINE_TYPE_CODE, MACHINE_NAME]);
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} registry row`);
      await recordRevert({ file: __filename });
      return;
    }

    const existing = await client.query(`SELECT id, grid_template_id FROM sds_machine_type_code WHERE machine_type_code = $1`, [MACHINE_TYPE_CODE]);
    console.log(`[register] ${MACHINE_NAME} (code ${MACHINE_TYPE_CODE}), grid_template_id=${TURNING_TEMPLATE_ID}${existing.rows[0] ? ' — already exists' : ' — new row'}`);
    if (dryRun) { console.log('[register] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    if (existing.rows[0]) {
      await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1, is_active = true WHERE machine_type_code = $2`, [TURNING_TEMPLATE_ID, MACHINE_TYPE_CODE]);
    } else {
      await client.query(
        `INSERT INTO sds_machine_type_code (machine_type_code, machine_type_name, is_active, grid_template_id)
         VALUES ($1, $2, true, $3)`,
        [MACHINE_TYPE_CODE, MACHINE_NAME, TURNING_TEMPLATE_ID]
      );
    }
    await client.query('COMMIT');
    console.log(`[register] done`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[register] FAILED:', e.message); process.exit(1); });
