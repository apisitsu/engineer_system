'use strict';

/**
 * Register SBT-16 (XD-8T) in `sds_machine_code`.
 * ------------------------------------------------------------------------------
 * Follow-up to 20260924b_. `rodpc.m_machine` names SBT-16 "XD-8T". The public SDS PDF link
 * resolves a machine code through `sds_machine_code.machine_name` (then rodpc.m_setup_datasheet,
 * which has no SBT rows), so this row is what makes SBT-16 resolvable there.
 *
 * `machine_type_code` is 858 (XD-8's code) by request, although the registry's own code for
 * XD-8T is 041 — this override is what the admin grids show for SBT-16. The public PDF link
 * ignores this column and resolves by `machine_name` (XD-8T).
 *
 * M08SY / M08SJ codes (SBT-14, 15, 18) are intentionally NOT registered — disabled.
 *
 * Idempotent (`machine_code` is UNIQUE); `--revert` deletes only this row.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const CODE = 'SBT-16', NAME = 'XD-8T', TYPE = '858';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const show = async () => (await engPool.query(
    `SELECT machine_code, machine_name, machine_type_code FROM sds_machine_code WHERE machine_code = $1`, [CODE])).rows;
  console.log('-- before --', JSON.stringify(await show()));
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }
  if (revert) {
    await engPool.query(`DELETE FROM sds_machine_code WHERE machine_code = $1 AND machine_type_code = $2`, [CODE, TYPE]);
  } else {
    await engPool.query(
      `INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code)
       VALUES ($1, $2, $3) ON CONFLICT (machine_code) DO NOTHING`, [CODE, NAME, TYPE]);
  }
  console.log('-- after --', JSON.stringify(await show()));
  if (revert) { await recordRevert({ file: __filename }); return; }
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260924c_sds_machine_code_sbt16_xd8t.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
