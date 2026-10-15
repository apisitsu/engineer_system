'use strict';

/**
 * Correct the floor code for KS-B80PB (user decision, 2026-10-15): the existing
 * `sds_machine_code` override points KS-B80PB at machine_code `IDG-16`, but the user
 * checked the floor directly and confirmed KS-B80PB is `IDG-15`, not IDG-16.
 *
 * `rodpc.m_machine` (the factory equipment master) disagrees in the SAME direction as
 * the wrong override — it lists IDG-15 → model 'KS-R80D' and IDG-16 → model 'KS-B80'.
 * Two independent PB Ring sources (`pbring_machine_type.source_sheet_name` =
 * 'IDG_15ksb80', and `pbring_tooling.mc_no` = 'IDG-15' for every KSB80 row, both written
 * at the original prototype import) already had it right. `rodpc.m_machine`'s own
 * `m_update` is recent (2025-08 / 2026-04), so this may be the factory's own master
 * trailing a floor change rather than this app's record being stale — not touched here
 * either way, since it is the factory asset master, not something this app owns.
 *
 * Scope, by explicit user instruction: fix ONLY the floor-code column on the existing
 * override row. `KS-B80PB` has no entry in `sds_machine_type_code` at all (confirmed
 * live — only plain `KS-B80`, code 021, exists) — the user deliberately kept KS-B80PB
 * a distinct name because its template differs substantially from KS-B80's, but asked
 * explicitly to fix just the floor code today, not to stand up a full KS-B80PB catalog
 * entry (own grid template / parameter config / tool whitelist) in this pass. So after
 * this migration IDG-15 correctly LOOKS UP machine_name 'KS-B80PB', but that name still
 * resolves to nothing in sds_machine_type_code until a proper catalog entry is created
 * as separate, later work.
 *
 * Idempotent; `--revert` restores machine_code to IDG-16.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const OLD_CODE = 'IDG-16';
const NEW_CODE = 'IDG-15';
const MACHINE_NAME = 'KS-B80PB';
const REMARK = "Floor-confirmed 2026-10-15: KS-B80PB is IDG-15, not IDG-16 (rodpc.m_machine disagrees; PB Ring's own import data, pbring_tooling.mc_no and pbring_machine_type.source_sheet_name, already had it as IDG-15).";

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `UPDATE sds_machine_code SET machine_code = $1, updated_at = NOW()
        WHERE machine_code = $2 AND machine_name = $3`,
      [OLD_CODE, NEW_CODE, MACHINE_NAME]
    );
    console.log(`reverted: ${rowCount} row(s) set back to ${OLD_CODE}`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rowCount } = await engPool.query(
    `UPDATE sds_machine_code SET machine_code = $1, remark = $2, updated_at = NOW()
      WHERE machine_code = $3 AND machine_name = $4`,
    [NEW_CODE, REMARK, OLD_CODE, MACHINE_NAME]
  );
  if (rowCount) {
    console.log(`fixed: sds_machine_code ${MACHINE_NAME} ${OLD_CODE} -> ${NEW_CODE}`);
  } else {
    const { rows: already } = await engPool.query(
      `SELECT machine_code FROM sds_machine_code WHERE machine_name = $1`, [MACHINE_NAME]
    );
    console.log(`no row updated (0 rows matched ${OLD_CODE}/${MACHINE_NAME}) — current state: ${JSON.stringify(already)}`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015d_fix_ksb80pb_floor_code.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
