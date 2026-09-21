'use strict';

/**
 * Copy XD-8's `sds_machine_tool` whitelist (the Jig/Fixture T-slot config, F01-F08 on
 * the Turning sheet) onto XD-8T, per the owner's explicit follow-up request — same
 * mechanism as the X-100 -> XC-100 clone (`20260918_clone_x100_turning_config_to_xc100.js`):
 * once XD-8T's whitelist matches XD-8's family-for-family, a CN's real factory plan
 * resolves the SAME fixtures regardless of which of the two machine names is picked,
 * because the whitelist only filters by DWG family — it does not care about the machine
 * name typed into the render request.
 *
 * Scope: `sds_machine_tool` only (15 rows, processes 2021 and 2071). The Cutting-Tool
 * (T01-T03) copy already done in `20260919b_` is untouched by this file.
 *
 * Idempotent: deletes XD-8T's own `sds_machine_tool` rows first, then re-inserts from
 * XD-8's CURRENT rows — a re-run just refreshes XD-8T to match XD-8. `--revert` clears
 * XD-8T's rows (does not touch XD-8).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260919c_copy_xd8_machine_tool_to_xd8t.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260919c_copy_xd8_machine_tool_to_xd8t.js
 *   node api/engineer/mtc/db_migrations/20260919c_copy_xd8_machine_tool_to_xd8t.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const SOURCE = 'XD-8';
const TARGET = 'XD-8T';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      const d = await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
      await client.query('COMMIT');
      console.log(`[revert] removed ${d.rowCount} row(s) from ${TARGET}`);
      await recordRevert({ file: __filename });
      return;
    }

    const src = await client.query(
      `SELECT tool_number, process_code, tool_drawing_no FROM sds_machine_tool WHERE machine_type = $1 ORDER BY process_code, tool_number`,
      [SOURCE]
    );
    console.log(`[copy] ${SOURCE} -> ${TARGET}: ${src.rows.length} row(s)`);
    if (dryRun) {
      src.rows.forEach(r => console.log(`  ${r.tool_number} @${r.process_code} -> ${r.tool_drawing_no}`));
      console.log('[copy] --dry-run — no changes written');
      return;
    }

    await client.query('BEGIN');
    const del = await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
    let inserted = 0;
    if (src.rows.length) {
      const r = await client.query(
        `INSERT INTO sds_machine_tool (machine_type, tool_number, process_code, tool_drawing_no)
         SELECT $1::text, x.tool_number, x.process_code, x.tool_drawing_no
           FROM sds_machine_tool x WHERE x.machine_type = $2`,
        [TARGET, SOURCE]
      );
      inserted = r.rowCount;
    }
    await client.query('COMMIT');
    console.log(`[copy] done — removed ${del.rowCount} old row(s), inserted ${inserted} new row(s)`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[copy] FAILED:', e.message); process.exit(1); });
