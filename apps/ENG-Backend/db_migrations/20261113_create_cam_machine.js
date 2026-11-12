'use strict';
/**
 * The shop's CNC machines for the CAD/CAM module (2026-11-13).
 *
 * The client ships a built-in list (`cam/engine/cam/machines.js`). This table
 * holds what the shop changes on top of it, one row per machine:
 *
 *   - a row whose id is a built-in machine's id **overrides** that machine
 *     (its real stroke, its G28 home, a slower rapid…); deleting the row puts
 *     the built-in figures back;
 *   - a row with any other id is a machine the shop **added**.
 *
 * `data` is the whole machine as the client reads it (validated by
 * `camMachineService.clean`), so a new field on the client needs no migration.
 *
 * Additive only — it touches no existing table. The client treats a missing
 * table as "no changes" and uses the built-in list.
 *
 * Idempotent: CREATE ... IF NOT EXISTS, no seed.
 *
 * MIND WHOSE DATABASE THIS IS. apps/ENG-Backend/.env points PG_NEW_HOST at
 * plbmp130, so running this from the dev box creates the table in PRODUCTION.
 *
 * Run: node db_migrations/20261113_create_cam_machine.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const DDL = `
CREATE TABLE IF NOT EXISTS cam_machine (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    console.log('Revert: dropping cam_machine (every machine added or changed since is lost).');
    if (!dryRun) {
      await engPool.query('DROP TABLE IF EXISTS cam_machine;');
      await recordRevert({ file: __filename });
    }
    return;
  }

  console.log('Create cam_machine.');
  if (dryRun) { console.log('(dry run — nothing written)'); return; }
  await engPool.query(DDL);
  await recordRun({ file: __filename });
  console.log('Done.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exitCode = 1; })
  .finally(() => engPool.end());
