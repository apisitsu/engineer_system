'use strict';

/**
 * Process Engineer "Record for New Model / Item" form.
 *   node db_migrations/migrate_process_record_form.js [--revert] [--dry-run] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');
const { TABLES, DEFAULT_LAYOUT } = require('../api/engineer/process/record_form/recordFormConstants');

const revert = process.argv.includes('--revert');
const dry = process.argv.includes('--dry-run');
const T = TABLES;

const UP = `
CREATE TABLE IF NOT EXISTS ${T.TEMPLATE} (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  layout      JSONB NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  TEXT,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ${T.RECORD} (
  id               SERIAL PRIMARY KEY,
  template_id      INTEGER REFERENCES ${T.TEMPLATE}(id),
  lot_no           TEXT,
  control_no       TEXT,
  parts_no         TEXT,
  drawing_rev      TEXT,
  header           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'draft',
  record_rev       INTEGER NOT NULL DEFAULT 0,
  established_date DATE NOT NULL DEFAULT CURRENT_DATE,
  revised_date     DATE,
  printed_at       TIMESTAMPTZ,
  created_by       TEXT,
  created_by_name  TEXT,
  updated_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_record_lot ON ${T.RECORD}(lot_no);
CREATE INDEX IF NOT EXISTS idx_pr_record_cn  ON ${T.RECORD}(control_no);
CREATE TABLE IF NOT EXISTS ${T.STEP} (
  id            SERIAL PRIMARY KEY,
  record_id     INTEGER NOT NULL REFERENCES ${T.RECORD}(id) ON DELETE CASCADE,
  step_no       INTEGER NOT NULL,
  process_code  TEXT,
  process_name  TEXT,
  "values"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (record_id, step_no)
);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  if (revert) {
    if (dry) return console.log('[dry-run] would DROP', T.STEP, T.RECORD, T.TEMPLATE);
    await engPool.query(`DROP TABLE IF EXISTS ${T.STEP}, ${T.RECORD}, ${T.TEMPLATE}`);
    await recordRevert({ file: __filename });
    return console.log('reverted');
  }
  if (dry) return console.log(UP);
  await engPool.query(UP);
  await engPool.query(
    `INSERT INTO ${T.TEMPLATE} (name, layout, is_default, created_by)
     VALUES ('Record for New Model / Item', $1, TRUE, 'migration')
     ON CONFLICT (name) DO NOTHING`,
    [JSON.stringify(DEFAULT_LAYOUT)]
  );
  await recordRun({ file: __filename });
  console.log('applied');
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => engPool.end());
