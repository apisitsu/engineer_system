'use strict';

/**
 * `sds_print_log` — record the FLOOR CODE the caller asked for.
 * ------------------------------------------------------------------------------
 * The log stores `machine_type_name` — the model, `KS-450C` — because that is what the
 * renderer needs. The caller asked for something more specific: `machine=CGM-10`, the code
 * painted on one particular machine on the floor. That value is resolved and thrown away.
 *
 *     machine_code  VARCHAR(32)   the floor code as sent, e.g. 'CGM-10'
 *
 * IT CANNOT BE DERIVED BACK, WHICH IS THE WHOLE REASON FOR THE COLUMN
 *
 * The mapping is one model to MANY machines, and the fan-out is wide:
 *
 *     KS-400B1      9   SPG-01 … SPG-10
 *     KN-113A       8   IGM-01…04, OGM-01…05
 *     OC-18BR-150   7   CGM-01, CGM-03, CGM-05, CGM-06, CGM-07, CGM03B, CGM05B
 *     KS-03A        5   IDG-03 … IDG-07
 *     PAX2          4   STN-01 … STN-04
 *
 * So a row saying `KS-400B1` cannot be narrowed to a machine afterwards, and showing all
 * nine would be worse than showing none. Only the request knew, and only at the moment it
 * arrived.
 *
 * NULL IS THE HONEST VALUE FOR THE IN-APP PATH. `/pdf-chrome/grid` is driven by the SDS
 * page's picker, which selects a machine TYPE — there is no floor code to record, and
 * inventing one from the type would be the same wrong guess this column exists to avoid.
 *
 * Existing rows keep NULL: the codes they were called with were never stored.
 *
 * Idempotent; `--revert` drops the column.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_print_log';
const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS machine_code`);
    console.log('reverted: machine_code dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS machine_code VARCHAR(32)`);
  await engPool.query(
    `COMMENT ON COLUMN ${TABLE}.machine_code IS $c$Factory floor code as the caller sent it (e.g. CGM-10). Cannot be derived from machine_type_name — one model maps to up to 9 machines. NULL for the in-app path, whose picker selects a model, not a machine.$c$`);
  await engPool.query(
    `CREATE INDEX IF NOT EXISTS ${TABLE}_machine_code_idx ON ${TABLE} (machine_code) WHERE machine_code IS NOT NULL`);

  const { rows } = await engPool.query(
    `SELECT count(*)::int AS total,
            count(machine_code)::int AS with_code
       FROM ${TABLE}`);
  console.log(`machine_code added · ${rows[0].with_code} of ${rows[0].total} rows carry one (existing rows keep NULL)`);

  await recordRun({ file: __filename });
  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260826c_sds_print_log_machine_code.js --revert`);
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
