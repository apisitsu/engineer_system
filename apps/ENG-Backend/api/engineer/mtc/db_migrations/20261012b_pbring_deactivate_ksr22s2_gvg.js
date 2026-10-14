'use strict';

/**
 * Deactivates the `KSR22S2_GVG` row in `pbring_machine_type` — user request
 * (2026-10-12): take it out of the Grinding Condition Config machine list.
 *
 * Confirmed live before writing this: `KSR22S2_GVG` (id 11, imported from
 * the xlsx tab `GVG_ksr22s2` with its own grid template id 11) has ZERO
 * combos anywhere in `pbring_sds_param`/`pbring_sds_condition` — every real
 * row for this machine family uses `KSR22S2` (source sheet `IDG_ksr22s2`,
 * 44 combos) instead. So GVG is dead import-time config, never actually
 * used by any real PB Ring part; it was the only inactive→active mismatch
 * among all 18 imported machines (the other 17 are all genuinely in use).
 *
 * `is_active = false` rather than a delete, matching the column's existing
 * purpose and every other `is_active` toggle in this codebase (reversible,
 * keeps the grid_template_id/history). `listMachineTypes()` in
 * pbringGridService.js is updated in the same commit to filter on it, so
 * flipping the flag actually hides the row from the admin list.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `UPDATE pbring_machine_type SET is_active = true, updated_at = now() WHERE machine_type_name = 'KSR22S2_GVG'`
    );
    console.log(`reverted: KSR22S2_GVG is_active = true (${rowCount} row)`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rowCount } = await engPool.query(
    `UPDATE pbring_machine_type SET is_active = false, updated_at = now() WHERE machine_type_name = 'KSR22S2_GVG'`
  );
  console.log(`KSR22S2_GVG is_active = false (${rowCount} row)`);

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261012b_pbring_deactivate_ksr22s2_gvg.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
