'use strict';

/**
 * Remove the SBT-xx rows from `sds_machine_code` that 20260924d_ made redundant.
 * ------------------------------------------------------------------------------
 * 20260924b_/c_ registered the SBT codes locally so the public SDS link could resolve them.
 * 20260924d_ then seeded the same codes into `rodpc.m_setup_datasheet` with identical
 * machine names, so the override rows say nothing the factory table does not. The override
 * table is meant for exceptions only (see sdsV2AdminController.buildMachineResolver).
 *
 * KEPT: SBT-16. Its `machine_type_code` = 858 is an intentional override (the registry's own
 * code for XD-8T is 041) and exists nowhere else, so removing the row would silently change
 * what the admin grids show for it.
 *
 * The admin grids derive machine_type_code from the name when no override is set, which
 * gives the same codes the removed rows carried (857 / 858 / 879 / 016).
 *
 * `--revert` re-inserts the ten removed rows. Idempotent.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const ROWS = [
  ['SBT-07', 'XD-8', '858'], ['SBT-12', 'XD-8', '858'],
  ['SBT-08', 'X-100', '857'], ['SBT-09', 'X-100', '857'],
  ['SBT-10', 'XC-100', '016'], ['SBT-11', 'XC-100', '016'],
  ['SBT-19', 'XC-100', '016'], ['SBT-20', 'XC-100', '016'],
  ['SBT-13', 'J-WAVE', '879'], ['SBT-17', 'J-WAVE', '879'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const show = async () => (await engPool.query(
    `SELECT machine_code, machine_name, machine_type_code FROM sds_machine_code
      WHERE machine_code LIKE 'SBT-%' ORDER BY machine_code`)).rows.map(r => `${r.machine_code}=${r.machine_name}/${r.machine_type_code}`);
  console.log('-- before --', JSON.stringify(await show()));
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }
  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    for (const [code, name, type] of ROWS) {
      if (revert) {
        await c.query(`INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code)
                       VALUES ($1,$2,$3) ON CONFLICT (machine_code) DO NOTHING`, [code, name, type]);
      } else {
        await c.query(`DELETE FROM sds_machine_code WHERE machine_code=$1 AND machine_name=$2`, [code, name]);
      }
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  console.log('-- after --', JSON.stringify(await show()));
  if (revert) { await recordRevert({ file: __filename }); return; }
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260924e_drop_sds_machine_code_sbt_duplicates.js --revert');
}

main().then(() => engPool.end()).catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
