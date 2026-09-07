'use strict';

/**
 * 20260907_lot_track_saved.js
 * ---------------------------
 * Saved / starred Lot Status Tracker views, per user.
 *
 * One row = one named track: a list of lots to watch side by side. A "single"
 * bookmark is just a list of length 1; a "group" is length > 1 — the UI does not
 * store the distinction, it reads it from `jsonb_array_length(lots)`.
 *
 *   lots :: jsonb  =  [{ "lotNo": "C19081", "controlNo": "330553" | null }, ...]
 *
 * `savedStore.js` also CREATEs this table lazily (fail-open), so a host that never
 * ran this migration still works; the migration just records itself in
 * `db_migrations` and gives a clean --revert.
 *
 *   node api/engineer/mtc/db_migrations/20260907_lot_track_saved.js
 *   node api/engineer/mtc/db_migrations/20260907_lot_track_saved.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS lot_track_saved');
    console.log('[20260907_lot_track_saved] reverted — table dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`
    CREATE TABLE IF NOT EXISTS lot_track_saved (
      id         SERIAL PRIMARY KEY,
      empno      TEXT        NOT NULL,
      name       TEXT        NOT NULL,
      lots       JSONB       NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await engPool.query(
    'CREATE INDEX IF NOT EXISTS lot_track_saved_empno_idx ON lot_track_saved (empno)'
  );

  console.log('[20260907_lot_track_saved] applied — lot_track_saved ready');
  await recordRun({ file: __filename });
}

main()
  .then(() => engPool.end())
  .catch((e) => { console.error(e); return engPool.end().finally(() => process.exit(1)); });
