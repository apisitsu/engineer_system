'use strict';

/**
 * QTN200 (`sds_machine_type_code` id=7, process 0082 "Turning (5)") — CN314110 needs
 * a Setup Data Sheet here. QTN200 had `grid_template_id = NULL` (no sheet could
 * render) and no `sds_machine_tool` whitelist row at process 0082 (only 0011/0091,
 * both T1 -> family 4007-01). The factory process plan for CN314110 @0082 lists tool
 * 4007-01-0047 "CHUCK JAW" — same family QTN200 already whitelists elsewhere, so T1
 * extends to 0082 rather than inventing a new slot.
 *
 * "Turning (5)" = `sds_grid_template` id=8, name "Turning" — already live on 5
 * machines (XC-100, X-100, XD-8, J-WAVE, XD-8T) — confirmed with the requester.
 *
 * This migration only sets `grid_template_id` and the `sds_machine_tool` row.
 * `sds_excel_mapping` (cell wiring) and the shared-mapping suppression are handled
 * by the existing parametrized seeds for this template — run after this:
 *   node api/engineer/mtc/db_migrations/20260916_seed_turning_excel_mapping_v2.js --machine="QTN200"
 *   node api/engineer/mtc/db_migrations/20260916b_suppress_shared_mapping_for_turning.js --machine="QTN200"
 *
 * Idempotent: grid_template_id set is a plain UPDATE; the machine_tool row is
 * deleted (by machine_type + process_code + tool_number) then re-inserted.
 * `--revert` clears grid_template_id back to NULL and removes the row.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104_qtn200_turning_0082_setup.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261104_qtn200_turning_0082_setup.js
 *   node api/engineer/mtc/db_migrations/20261104_qtn200_turning_0082_setup.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const MACHINE = 'QTN200';
const GRID_TEMPLATE_ID = 8; // "Turning"
const PROCESS_CODE = '0082';
const TOOL_NUMBER = 'T1';
const TOOL_DRAWING_NO = '4007-01';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    if (dryRun) {
      console.log(`[dry-run] would set sds_machine_type_code.grid_template_id=${GRID_TEMPLATE_ID} for ${MACHINE}`);
      console.log(`[dry-run] would upsert sds_machine_tool: ${MACHINE} @${PROCESS_CODE} ${TOOL_NUMBER} -> ${TOOL_DRAWING_NO}`);
      return;
    }

    await client.query('BEGIN');

    if (revert) {
      await client.query(`UPDATE sds_machine_type_code SET grid_template_id = NULL WHERE machine_type_name = $1`, [MACHINE]);
      const del = await client.query(
        `DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2 AND tool_number = $3`,
        [MACHINE, PROCESS_CODE, TOOL_NUMBER]
      );
      await client.query('COMMIT');
      console.log(`[revert] cleared grid_template_id for ${MACHINE}, removed ${del.rowCount} machine_tool row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    await client.query(`UPDATE sds_machine_type_code SET grid_template_id = $1 WHERE machine_type_name = $2`, [GRID_TEMPLATE_ID, MACHINE]);

    await client.query(
      `DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2 AND tool_number = $3`,
      [MACHINE, PROCESS_CODE, TOOL_NUMBER]
    );
    await client.query(
      `INSERT INTO sds_machine_tool (machine_type, tool_number, process_code, tool_drawing_no)
       VALUES ($1, $2, $3, $4)`,
      [MACHINE, TOOL_NUMBER, PROCESS_CODE, TOOL_DRAWING_NO]
    );

    await client.query('COMMIT');
    console.log(`[done] ${MACHINE}: grid_template_id=${GRID_TEMPLATE_ID}, sds_machine_tool ${TOOL_NUMBER}@${PROCESS_CODE}->${TOOL_DRAWING_NO}`);
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
