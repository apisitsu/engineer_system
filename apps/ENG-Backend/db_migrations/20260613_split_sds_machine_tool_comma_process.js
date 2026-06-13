'use strict';
/**
 * Split comma-joined process_code rows in sds_machine_tool into one row per code.
 *
 * Rows like (machine_type='KS-H70', process_code='1241,1242,1081,1082') are DEAD
 * config: every consumer matches process_code exactly —
 *   - sdsV2PdfController tool whitelist:  WHERE process_code = $2
 *   - sdsV2ReportController checkToolingMatch: keyed `${machine_type}||${process_code}`
 * so a coverage/PDF lookup for '1241' never sees them. Affected as of 2026-06-13:
 * KS-H70 ('1241,1242,1081,1082' ×10), OC-16A ('1011,1012' ×4), GS-64PF ('1101, 1102' ×1).
 *
 * Idempotent: re-running finds no comma rows and exits. The original rows are
 * printed as JSON before deletion — keep that output if a manual rollback
 * (re-join) is ever needed. machine_type_id is restored by the BEFORE INSERT
 * trigger sds_set_machine_type_id, so it is not copied explicitly.
 *
 * Run: node db_migrations/20260613_split_sds_machine_tool_comma_process.js
 */
const { engPool } = require('../instance/eng_db');

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, tool_number, process_code, machine_type, tool_drawing_no
       FROM sds_machine_tool WHERE process_code LIKE '%,%' ORDER BY machine_type, tool_number`
    );
    if (rows.length === 0) {
      console.log('No comma-joined process_code rows — nothing to do.');
      await client.query('ROLLBACK');
      return;
    }
    console.log(`Found ${rows.length} comma-joined rows. Snapshot (for manual rollback):`);
    console.log(JSON.stringify(rows));

    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const codes = r.process_code.split(',').map(s => s.trim()).filter(Boolean);
      for (const code of codes) {
        const ins = await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
          [r.tool_number, code, r.machine_type, r.tool_drawing_no]
        );
        ins.rowCount === 1 ? inserted++ : skipped++;
      }
      await client.query(`DELETE FROM sds_machine_tool WHERE id = $1`, [r.id]);
    }

    await client.query('COMMIT');
    console.log(`Done: ${rows.length} comma rows split → ${inserted} rows inserted, ${skipped} already existed, ${rows.length} comma rows deleted.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED (rolled back):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end().catch(() => {});
  }
})();
