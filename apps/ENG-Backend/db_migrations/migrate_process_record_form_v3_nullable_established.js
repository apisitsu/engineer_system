'use strict';

/**
 * pr_record.established_date may be NULL. The workbooks being imported hold dates nobody can
 * read (e.g. "20-04-20204"); guessing one would put a false date on a controlled record, so the
 * import stores NULL (and keeps the raw text in header.established_raw). New records still get
 * CURRENT_DATE from the column default.
 *   node db_migrations/migrate_process_record_form_v3_nullable_established.js [--revert] [--dry-run] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');
const { TABLES } = require('../api/engineer/process/record_form/recordFormConstants');

const revert = process.argv.includes('--revert');
const dry = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const sql = revert
    ? [`UPDATE ${TABLES.RECORD} SET established_date = created_at::date WHERE established_date IS NULL`,
       `ALTER TABLE ${TABLES.RECORD} ALTER COLUMN established_date SET NOT NULL`]
    : [`ALTER TABLE ${TABLES.RECORD} ALTER COLUMN established_date DROP NOT NULL`];
  if (dry) return console.log(sql.join(';\n'));
  for (const q of sql) await engPool.query(q);
  if (revert) await recordRevert({ file: __filename }); else await recordRun({ file: __filename });
  console.log(revert ? 'reverted' : 'applied');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => engPool.end());
