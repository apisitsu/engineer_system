'use strict';

/**
 * Re-seeds the default "Record for New Model / Item" template with the workbook's exact
 * geometry (v1 guessed spans). Only touches the row named below — a template an engineer
 * made or renamed is left alone.   node db_migrations/migrate_process_record_form_v2_original_geometry.js
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun } = require('./lib/migrationLog');
const { TABLES, DEFAULT_LAYOUT } = require('../api/engineer/process/record_form/recordFormConstants');

async function main() {
  if (await guard({ file: __filename, revert: false })) return;
  const r = await engPool.query(
    `UPDATE ${TABLES.TEMPLATE} SET layout = $1, updated_at = NOW() WHERE name = 'Record for New Model / Item'`,
    [JSON.stringify(DEFAULT_LAYOUT)]);
  console.log('updated', r.rowCount);
  await recordRun({ file: __filename });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => engPool.end());
