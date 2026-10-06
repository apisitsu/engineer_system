'use strict';

/**
 * Follow-up to `20261006c_pbring_revert_batch_approval.js`: that migration
 * couldn't recover the pre-approval `status` for the 41 reverted rows (no
 * audit trail in `pbring_tooling`), so it left status at whatever approval
 * had force-set it to ('Received' for 40 of the 41) rather than guess.
 *
 * Turns out it wasn't actually unrecoverable — all 41 rows came from the
 * original one-time import (`created_by = 'import:pbring-prototype'`,
 * confirmed live) and have never been edited since except by the approve/
 * revert cycle this follows. The import's own source file,
 * `C:\User DATA\PB_Ring_SDS_Project\db\tooling.csv` (outside this repo),
 * still has their true original status.
 *
 * The CSV has no column that maps directly to `pbring_tooling.id` — its own
 * `tooling_id` column is the prototype's internal id, unrelated. But the
 * import (`20261003c_pbring_import_from_prototype.js`) was a single ordered
 * bulk INSERT into an empty table, so **CSV row N (1-indexed, after the
 * header) is pbring_tooling id N** — verified live for all 41 ids here by
 * cross-checking part_no/tool_code at that row against the current DB row,
 * exact match on every one.
 *
 * Values are hardcoded (not read from the CSV at migration-run time) for the
 * same portability reason as the other same-day pbring migrations: the
 * source file lives outside this repo and isn't guaranteed to exist on every
 * host this might run on.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

// [tooling_id, original_status] — read from tooling.csv row `tooling_id`
// (1-indexed, matching `20261006c`'s batch). Current status (set by
// 20261006c) is 'Received' for all 41; only the 19 whose original status
// differs actually change anything here.
const ORIGINAL_STATUS = [
  [85, 'Received'], [86, 'Received'], [93, 'Received'], [97, 'Received'],
  [98, 'Received'], [100, 'Received'], [101, 'Received'], [114, 'Received'],
  [326, 'Received'], [327, 'Received'], [328, 'Received'], [331, 'Received'],
  [342, 'Received'], [343, 'Received'], [344, 'Received'], [347, 'Received'],
  [366, 'Received'], [412, 'Received'], [840, 'Received'], [876, 'Received'],
  [929, 'Received'], [1019, 'Received'], [1122, 'Received'],
  [1214, 'Wait Request Quotation'], [1215, 'Wait Request Quotation'],
  [1216, 'Wait Request Quotation'], [1217, 'Wait Request Quotation'],
  [1218, 'Wait Request Quotation'], [1219, 'Wait Request Quotation'],
  [1220, 'Wait Request Quotation'], [1221, 'Wait Request Quotation'],
  [1222, 'Wait Request Quotation'], [1224, 'Wait Request Quotation'],
  [1225, 'Wait Request Quotation'], [1226, 'Wait Request Quotation'],
  [1228, 'Wait Request Quotation'], [1230, 'Wait Request Quotation'],
  [1231, 'Wait Request Quotation'], [973, 'Received'], [1055, 'Received'],
  [1272, 'Wait Request Quotation'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const ids = ORIGINAL_STATUS.map((p) => p[0]);

  if (revert) {
    // Back to what 20261006c left them at.
    await engPool.query(`UPDATE pbring_tooling SET status = 'Received' WHERE id = ANY($1)`, [ids]);
    console.log(`Reverted: ${ids.length} row(s) set back to status='Received'.`);
    await recordRevert({ file: __filename });
    return;
  }

  let changed = 0;
  for (const [id, status] of ORIGINAL_STATUS) {
    const { rowCount } = await engPool.query(
      `UPDATE pbring_tooling SET status = $1, updated_at = now() WHERE id = $2 AND status <> $1`,
      [status, id]
    );
    changed += rowCount;
  }
  console.log(`Restored original status on ${ids.length} row(s); ${changed} actually changed (the rest were already correct).`);

  await recordRun({ file: __filename });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
