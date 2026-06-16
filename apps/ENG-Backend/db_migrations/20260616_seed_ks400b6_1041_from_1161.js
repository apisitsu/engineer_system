'use strict';
/**
 * Mirror KS-400B6's SDS Machine Tool Config from process 1161 → 1041.
 *
 * Why: KS-400B6 (machine_type_code 931, standalone — machine_group NULL) physically
 * runs SPHERICAL GRIND (process_code 1041) for ball parts (confirmed from
 * lpb.pc_production, e.g. CN 390881 ran on floor machine SPG-13 → KS-400B6). But
 * sds_machine_tool only had a tool list for KS-400B6 under process 1161, so the SDS
 * PDF machine picker (openPdfModal — keyed on sds_machine_tool.process_code) never
 * offered KS-400B6 for the 1041 process row, even though Machine History (sourced
 * from production records) showed it. Per engineer: KS-400B6 process 1041 uses the
 * SAME tool list as 1161.
 *
 * Scope: ONLY sds_machine_tool. The Excel Parameter / Grinding Wheel config
 * (sds_parameter) is keyed by machine_type_name (process-independent), so it already
 * applies to 1041 — nothing to copy there.
 *
 * Idempotent: deletes any existing (KS-400B6, 1041) rows, then re-copies from
 * (KS-400B6, 1161). Safe to re-run.
 *
 * Run: node db_migrations/20260616_seed_ks400b6_1041_from_1161.js
 */
const { engPool } = require('../instance/eng_db');

const MACHINE = 'KS-400B6';
const SRC_PROCESS = '1161';
const DST_PROCESS = '1041';

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows: src } = await client.query(
      `SELECT COUNT(*)::int AS count FROM sds_machine_tool
       WHERE machine_type = $1 AND process_code = $2`,
      [MACHINE, SRC_PROCESS]
    );
    if (src[0].count === 0) {
      throw new Error(`No source rows: ${MACHINE} has no sds_machine_tool for process ${SRC_PROCESS}`);
    }

    const del = await client.query(
      `DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = $2`,
      [MACHINE, DST_PROCESS]
    );
    if (del.rowCount) console.log(`Cleared ${del.rowCount} existing (${MACHINE}, ${DST_PROCESS}) rows.`);

    const ins = await client.query(
      `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
       SELECT tool_number, $1, machine_type, tool_drawing_no, machine_type_id
       FROM sds_machine_tool
       WHERE machine_type = $2 AND process_code = $3
       ORDER BY id`,
      [DST_PROCESS, MACHINE, SRC_PROCESS]
    );

    await client.query('COMMIT');
    console.log(`SEEDED ${ins.rowCount} sds_machine_tool rows for (${MACHINE}, ${DST_PROCESS}) copied from process ${SRC_PROCESS}.`);
    console.log('Note: flush the SDS cache (or wait for TTL) so the picker reflects the new combo.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
