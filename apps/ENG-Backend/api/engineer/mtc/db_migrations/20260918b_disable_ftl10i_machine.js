'use strict';

/**
 * Disable FTL-10(I) — confirmed by the floor as no longer in use.
 * ------------------------------------------------------------------------------
 * Two independent switches, both flipped:
 *   - `tooling_machine.enabled = false`      — stops FTL-10(I) being offered as a
 *     candidate machine on any FUTURE Tooling Select search.
 *   - `sds_machine_type_code.is_active = false` — hides it from the SDS machine
 *     picker/admin lists.
 *
 * `is_active` also gates the grid-template lookup in `sdsV2HeadlessController.js`
 * (`WHERE machine_type_name = $1 AND is_active`), so this means an SDS PDF can no
 * longer be (re)printed for any C/N that historically ran on FTL-10(I) — accepted
 * knowingly, confirmed with the user before running.
 *
 * Nothing else is touched: `tooling_formula`, `tooling_ftl10` inventory,
 * `tooling_partno_map` (810 rows), and `sds_machine_tool` config all stay intact —
 * this is a soft disable (stop offering it going forward), not a deletion of the
 * machine's history.
 *
 * Idempotent; `--revert` restores both flags to true.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'FTL-10(I)';

async function show(label) {
  const [tm, smt] = await Promise.all([
    engPool.query(`SELECT id, machine_name, enabled FROM tooling_machine WHERE machine_name = $1`, [MACHINE]),
    engPool.query(`SELECT id, machine_type_name, is_active FROM sds_machine_type_code WHERE machine_type_name = $1`, [MACHINE]),
  ]);
  console.log(`\n${label}`);
  console.log('   tooling_machine.enabled        =', tm.rows[0]?.enabled);
  console.log('   sds_machine_type_code.is_active =', smt.rows[0]?.is_active);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  await show(revert ? '-- before revert --' : '-- before --');
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

  const target = revert; // revert -> true (re-enable), normal run -> false (disable)

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const r1 = await client.query(
      `UPDATE tooling_machine SET enabled = $1, updated_at = now() WHERE machine_name = $2`,
      [target, MACHINE]);
    const r2 = await client.query(
      `UPDATE sds_machine_type_code SET is_active = $1 WHERE machine_type_name = $2`,
      [target, MACHINE]);
    await client.query('COMMIT');
    console.log(`\nupdated tooling_machine rows: ${r1.rowCount}, sds_machine_type_code rows: ${r2.rowCount}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await show(revert ? '-- after revert --' : '-- after --');
  if (revert) { await recordRevert({ file: __filename }); return; }
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260918b_disable_ftl10i_machine.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
