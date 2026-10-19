'use strict';

/**
 * Delete a stale duplicate set of pbring_sds_condition rows for
 * KSR80D/294065/1161, per live bug reported 2026-10-19: the PDF showed every
 * real tool in TWO consecutive T0N slots (T01=T02=GUIDE LOWER RIGHT, T03=T04=
 * UPPER GUIDE & STOP, …), shifting everything after it.
 *
 * Root cause (confirmed live, isolated to exactly this one CN/process combo
 * — a scoped scan found no other KSR80D combo affected): two overlapping
 * sets of rows exist for the same 14 tool slots —
 *   - OLD: ids 201-214, tool_number 'T1'..'T14' (T1-T9 NOT zero-padded)
 *   - NEW: ids 11332-11345, tool_number 'T01'..'T14' (T1-T9 zero-padded,
 *     matching the convention used everywhere else in this table)
 * Both sets carry identical tooling_no/maker data for every matching pair —
 * confirmed row by row before writing this, so deleting one side loses
 * nothing. `orderToolNumbers()` in pbringGridService.js matches ANY
 * `T\d+` string as a numbered slot, so 'T1' and 'T01' both qualify and sort
 * adjacent (same parseInt value) — each real tool ends up placed into TWO
 * sequential physical T0N boxes instead of one.
 *
 * Keeps the NEW (zero-padded, higher-id) set; deletes the OLD set. Revert
 * cannot resurrect the exact deleted rows generically (no snapshot table for
 * this one), so it is intentionally NOT implemented — rerun from a DB backup
 * if ever needed. Idempotent forward: a second run finds 0 rows and no-ops.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const OLD_IDS = [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214];

async function main() {
  if (revert) {
    console.log('no revert for this migration — restore pbring_sds_condition ids 201-214 from a DB backup if ever needed');
    return;
  }
  if (await guard({ file: __filename, revert })) return;

  const { rows: toDelete } = await engPool.query(
    `SELECT id, tool_number, tooling_no FROM pbring_sds_condition
      WHERE id = ANY($1) AND mc_key = 'KSR80D' AND cn = '294065' AND process_code = '1161'`,
    [OLD_IDS]
  );
  console.log(`matched ${toDelete.length} stale row(s) to delete:`, JSON.stringify(toDelete));

  const { rowCount } = await engPool.query(
    `DELETE FROM pbring_sds_condition
      WHERE id = ANY($1) AND mc_key = 'KSR80D' AND cn = '294065' AND process_code = '1161'`,
    [OLD_IDS]
  );
  console.log(`deleted: ${rowCount} row(s)`);

  await recordRun({ file: __filename });
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
