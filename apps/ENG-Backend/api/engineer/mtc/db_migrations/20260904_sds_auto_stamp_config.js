'use strict';

/**
 * 20260904_sds_auto_stamp_config.js
 * ---------------------------------
 * Auto Stamp — global on/off toggle + per-role "responsible signer".
 *
 * After every SDS coverage build, sheets whose ONLY gap is the signature
 * (pending_reason === 'NO_STAMP', not a limit anomaly) are signed automatically
 * with the person configured per role, tagged `sds_approval.<role>_source = 'auto'`.
 * Engine: services/sdsAutoStamp.js — wired into sdsV2ReportController.kickCoverageBuild.
 *
 * ONE row, id = 1. `enabled` defaults FALSE — nothing happens until an admin sets
 * the three signers and turns the toggle on. The engine also CREATEs this table
 * lazily (fail-open), so a host that never ran this migration still works; the
 * migration just makes the row explicit and records itself in `db_migrations`.
 *
 *   node api/engineer/mtc/db_migrations/20260904_sds_auto_stamp_config.js
 *   node api/engineer/mtc/db_migrations/20260904_sds_auto_stamp_config.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS sds_auto_stamp_config');
    console.log('[20260904_sds_auto_stamp_config] reverted — table dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`
    CREATE TABLE IF NOT EXISTS sds_auto_stamp_config (
      id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      enabled        BOOLEAN NOT NULL DEFAULT false,
      prepared_em_id TEXT, prepared_name TEXT,
      checked_em_id  TEXT, checked_name  TEXT,
      approved_em_id TEXT, approved_name TEXT,
      max_per_run    INT NOT NULL DEFAULT 200,
      updated_by     TEXT,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await engPool.query("INSERT INTO sds_auto_stamp_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING");

  console.log('[20260904_sds_auto_stamp_config] applied — sds_auto_stamp_config ready (enabled = false)');
  await recordRun({ file: __filename });
}

main()
  .then(() => engPool.end())
  .catch((e) => { console.error(e); return engPool.end().finally(() => process.exit(1)); });
