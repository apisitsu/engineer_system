'use strict';

/**
 * `sds_machine_tool` — drop TSG-300ZNC @1021 slot T3 (`4866-10`).
 * ------------------------------------------------------------------------------
 * The TSG-300ZNC face-grind SDS (process 1021) is to show **two** fixture slots:
 *   T1  4866-14  CHUTE COVER
 *   T2  4556-01  CARRIER
 * It currently carries a third, T3 `4866-10`, which renders on every sheet — with a
 * Tool No for the ~724 C/N that plan it, and as a name-only row ("BLOCK", a
 * `pickFamilyName` mispick — the plan calls this family BASE PLATE / PLATE, never
 * BLOCK) for the rest.
 *
 * System owner's call (2026-08-28): the sheet shows two slots. `4866-10` is not an
 * SDS T-slot for this machine/process.
 *
 * KNOWN COST, accepted: a whitelist FILTERS the part's plan, so once T3 is gone the
 * `4866-10` BASE PLATE / PLATE tool is dropped from the SDS sheet of the **724 C/N
 * (649 with a C3x control_no)** that plan it at 1021 — it will not appear at another
 * slot, it is filtered out. That is the intended result of "show only two".
 * T1/T2 stay contiguous, so no renumber is needed.
 *
 * `4866-10` @1021 stays untouched on any OTHER machine_type, and TSG-300ZNC's other
 * processes are not touched.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260828c_tsg300znc_1021_drop_4866_10.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260828c_tsg300znc_1021_drop_4866_10.js
 *   node api/engineer/mtc/db_migrations/20260828c_tsg300znc_1021_drop_4866_10.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const BACKUP = 'sds_machine_tool_backup_20260828c';
const M = 'TSG-300ZNC';
const P = '1021';
const DWG = '4866-10';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const { rows } = await client.query(`SELECT to_regclass($1) AS t`, [BACKUP]);
      if (!rows[0].t) { console.log(`[revert] no ${BACKUP} — nothing to restore`); await recordRevert({ file: __filename }); return; }
      await client.query('BEGIN');
      // re-insert the backed-up row(s) if absent
      await client.query(
        `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
         SELECT b.tool_number, b.process_code, b.machine_type, b.tool_drawing_no, b.machine_type_id
           FROM ${BACKUP} b
          WHERE NOT EXISTS (
            SELECT 1 FROM ${TABLE} t
             WHERE t.machine_type = b.machine_type AND t.process_code = b.process_code
               AND t.tool_drawing_no = b.tool_drawing_no)`);
      await client.query(`DROP TABLE ${BACKUP}`);
      await client.query('COMMIT');
      console.log('[revert] T3 restored from backup; backup dropped');
      await recordRevert({ file: __filename });
      return;
    }

    const { rows: cur } = await client.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLE}
        WHERE machine_type = $1 AND process_code = $2 ORDER BY tool_number`, [M, P]);
    console.log(`[drop] ${M} @${P} now: ` + (cur.map(r => `${r.tool_number}:${r.tool_drawing_no}`).join('  ') || '(none)'));

    const target = cur.filter(r => r.tool_drawing_no === DWG);
    if (!target.length) { console.log(`[drop] no ${DWG} row — nothing to do`); await recordRun({ file: __filename }); return; }
    console.log(`[drop] will remove: ${target.map(r => `${r.tool_number}:${r.tool_drawing_no}`).join('  ')}`);
    if (dryRun) { console.log('[drop] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS ${BACKUP}`);
    await client.query(
      `CREATE TABLE ${BACKUP} AS SELECT *, now() AS _backed_up_at FROM ${TABLE}
        WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`, [M, P, DWG]);
    const { rowCount } = await client.query(
      `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
      [M, P, DWG]);

    const { rows: after } = await client.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLE}
        WHERE machine_type = $1 AND process_code = $2 ORDER BY tool_number`, [M, P]);
    const nums = after.map(r => parseInt(r.tool_number.replace(/\D/g, ''), 10)).sort((a, b) => a - b);
    const gap = nums.length && nums[nums.length - 1] !== nums.length;
    if (gap) { await client.query('ROLLBACK'); throw new Error(`delete left a tool_number gap (${nums.join(',')}) — rolled back; renumber first`); }
    await client.query('COMMIT');
    console.log(`[drop] ${rowCount} row deleted · backup → ${BACKUP}`);
    console.log(`[drop] ${M} @${P} now: ` + after.map(r => `${r.tool_number}:${r.tool_drawing_no}`).join('  '));
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[drop] FAILED:', e.message); process.exit(1); });
