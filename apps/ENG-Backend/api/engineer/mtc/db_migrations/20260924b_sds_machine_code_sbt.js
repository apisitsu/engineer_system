'use strict';

/**
 * Register the SBT-xx machine codes of X-100 / XD-8 / J-WAVE / XC-100 in `sds_machine_code`.
 * ------------------------------------------------------------------------------
 * `sds_machine_code` links a floor machine code to its SDS machine type (`machine_type_code`
 * in `sds_machine_type_code`). None of the SBT-xx codes was registered, so SDS could not
 * resolve them. The mapping comes from the shop's `machines` table (code → machine name)
 * and the registry codes:
 *
 *   X-100   857   SBT-08, SBT-09
 *   XD-8    858   SBT-07, SBT-12
 *   J-WAVE  879   SBT-13, SBT-17
 *   XC-100  016   SBT-10, SBT-11, SBT-19, SBT-20
 *
 * FTL-10I (registry 501 is inactive), XD-8T and M08SY/SJ are deliberately NOT included.
 *
 * `machine_code` is UNIQUE, so the insert is idempotent (existing codes are left alone).
 * `--revert` deletes only the rows this file inserted (matched on code AND type code).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const ROWS = [
  ['SBT-08', 'X-100', '857'], ['SBT-09', 'X-100', '857'],
  ['SBT-07', 'XD-8', '858'], ['SBT-12', 'XD-8', '858'],
  ['SBT-13', 'J-WAVE', '879'], ['SBT-17', 'J-WAVE', '879'],
  ['SBT-10', 'XC-100', '016'], ['SBT-11', 'XC-100', '016'],
  ['SBT-19', 'XC-100', '016'], ['SBT-20', 'XC-100', '016'],
];
const CODES = ROWS.map((r) => r[0]);

async function state(c) {
  return (await c.query(
    `SELECT machine_code, machine_name, machine_type_code FROM sds_machine_code
      WHERE machine_code = ANY($1) ORDER BY machine_code`, [CODES])).rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    console.log('-- before --', JSON.stringify(await state(c)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }
    await c.query('BEGIN');
    if (revert) {
      for (const [code, , type] of ROWS) {
        await c.query(`DELETE FROM sds_machine_code WHERE machine_code = $1 AND machine_type_code = $2`, [code, type]);
      }
    } else {
      for (const [code, name, type] of ROWS) {
        await c.query(
          `INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code)
           VALUES ($1, $2, $3) ON CONFLICT (machine_code) DO NOTHING`, [code, name, type]);
      }
    }
    await c.query('COMMIT');
    console.log('-- after --', JSON.stringify(await state(c)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260924b_sds_machine_code_sbt.js --revert');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
