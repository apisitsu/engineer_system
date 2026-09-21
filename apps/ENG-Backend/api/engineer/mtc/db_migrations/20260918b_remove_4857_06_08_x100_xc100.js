'use strict';

/**
 * `sds_machine_tool` — drop LOADER JAW (4857-06) and INVERSION JAW (4857-08) from
 * X-100 and XC-100 (both process 2031 and 2071), per the owner's explicit request.
 * ------------------------------------------------------------------------------
 * Worth knowing before touching this again: these two families were removed by hand
 * once already, then RESTORED by `20260827b_x100_restore_loader_inversion_jaw.js`
 * because TEMPLATE_B lists both for X-100 and the factory plan showed real cost —
 * `.claude/rules/tooling-select.md` records **408 C/N** (4857-06) and **400 C/N**
 * (4857-08) at process 2031 losing a planned tool when these are excluded. Removing
 * them again reintroduces that same gap; this migration does not re-litigate the
 * decision, it only carries out this explicit instruction for both machines (XC-100
 * was cloned from X-100's whitelist on 2026-09-18 and inherited both rows).
 *
 * T6/T7 are simply dropped, not renumbered — a shorter tool-number sequence (T1-T5) is
 * normal (see KN-113A/LB15 elsewhere) and matches how `sds_machine_tool` already worked
 * before `20260827b_` added these two back in.
 *
 * Idempotent: deletes by (machine_type, process_code, tool_drawing_no) — a re-run finds
 * nothing left to remove. `--revert` re-inserts the exact rows captured before deletion
 * (including tool_number), so a revert restores T6/T7 exactly as they were.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260918b_remove_4857_06_08_x100_xc100.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260918b_remove_4857_06_08_x100_xc100.js
 *   node api/engineer/mtc/db_migrations/20260918b_remove_4857_06_08_x100_xc100.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const MACHINES = ['X-100', 'XC-100'];
const FAMILIES = ['4857-06', '4857-08'];
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      // Re-insert the rows this migration's own run log has no memory of, so revert
      // reconstructs them from the KNOWN prior shape (T6=4857-06, T7=4857-08, both
      // process codes, both machines) rather than from a snapshot table.
      await client.query('BEGIN');
      let inserted = 0;
      for (const machine of MACHINES) {
        for (const pc of ['2031', '2071']) {
          for (const [toolNumber, dwg] of [['T6', '4857-06'], ['T7', '4857-08']]) {
            const r = await client.query(
              `INSERT INTO sds_machine_tool (machine_type, tool_number, process_code, tool_drawing_no)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
              [machine, toolNumber, pc, dwg]
            );
            inserted += r.rowCount;
          }
        }
      }
      await client.query('COMMIT');
      console.log(`[revert] re-inserted ${inserted} row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    const check = await client.query(
      `SELECT machine_type, tool_number, process_code, tool_drawing_no FROM sds_machine_tool
        WHERE machine_type = ANY($1) AND tool_drawing_no = ANY($2)
        ORDER BY machine_type, process_code, tool_number`,
      [MACHINES, FAMILIES]
    );
    console.log(`[remove] ${check.rows.length} row(s) to delete:`);
    check.rows.forEach(r => console.log(`  ${r.machine_type} @${r.process_code} ${r.tool_number} -> ${r.tool_drawing_no}`));
    if (!check.rows.length) { await recordRun({ file: __filename }); return; }
    if (dryRun) { console.log('[remove] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM sds_machine_tool WHERE machine_type = ANY($1) AND tool_drawing_no = ANY($2)`,
      [MACHINES, FAMILIES]
    );
    await client.query('COMMIT');
    console.log(`[remove] deleted ${del.rowCount} row(s)`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[remove] FAILED:', e.message); process.exit(1); });
