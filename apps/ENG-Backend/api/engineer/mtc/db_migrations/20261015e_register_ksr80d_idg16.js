'use strict';

/**
 * Register the other half of the IDG-15/IDG-16 swap (user decision, 2026-10-15):
 * 20261015d_ moved KS-B80PB from IDG-16 to IDG-15 (floor-confirmed). That left IDG-16
 * with no `sds_machine_code` override at all, falling back to `rodpc.m_machine`'s
 * 'KS-B80' — wrong, by the same floor confirmation. The user asked to register
 * IDG-16 = KS-R80D, matching PB Ring's own import data (`pbring_tooling.mc_no` =
 * 'IDG-16' for every KSR80D row, `pbring_machine_type.source_sheet_name` =
 * 'GVG_ksr80d') and completing the swap cleanly.
 *
 * Same scope limit as 20261015d_: this is ONLY the floor-code override (so every
 * resolver that already prefers sds_machine_code over rodpc.m_machine — see that
 * migration's header for the full list — picks up the right name immediately).
 * `KS-R80D` has no entry in `sds_machine_type_code` either (confirmed live, same gap
 * as KS-B80PB) — machine_type_code stays NULL here on purpose; the Machine History
 * badge for IDG-16 will show the correct NAME but stay unresolved (white, no
 * type_code) until a full catalog entry is created as separate, later work.
 *
 * Idempotent; `--revert` deletes the inserted row.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const CODE = 'IDG-16';
const MACHINE_NAME = 'KS-R80D';
const REMARK = "Floor-confirmed 2026-10-15: IDG-16 is KS-R80D (PB Ring's own import data, pbring_tooling.mc_no and pbring_machine_type.source_sheet_name, already had it this way). Completes the IDG-15/IDG-16 swap started by 20261015d_fix_ksb80pb_floor_code.js.";

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `DELETE FROM sds_machine_code WHERE machine_code = $1 AND machine_name = $2`,
      [CODE, MACHINE_NAME]
    );
    console.log(`reverted: ${rowCount} row(s) deleted`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rows: existing } = await engPool.query(
    `SELECT id, machine_name FROM sds_machine_code WHERE machine_code = $1`, [CODE]
  );
  if (existing.length) {
    console.log(`skipped: sds_machine_code already has ${CODE} -> ${existing[0].machine_name}`);
  } else {
    await engPool.query(
      `INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code, remark, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, NOW(), NOW())`,
      [CODE, MACHINE_NAME, REMARK]
    );
    console.log(`registered: sds_machine_code ${CODE} -> ${MACHINE_NAME}`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015e_register_ksr80d_idg16.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
