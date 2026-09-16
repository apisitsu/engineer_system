'use strict';

/**
 * 20260916_lot_track_saved_shared_with.js
 * ----------------------------------------
 * Lets a saved Lot Status Tracker track be shared with specific other users,
 * so two people can watch and update the SAME list of lots instead of each
 * keeping a private copy that has to be synced by hand (which is how two
 * people ended up with tracks named "PB_Ring_All" / "PB Ring All" that
 * silently overwrote each other's CSV export on Drive — same filename,
 * different lots).
 *
 *   shared_with :: text[]  =  empnos, besides the owner, allowed to view AND
 *                             update this track's name/lots. Deleting stays
 *                             owner-only.
 *
 * `savedStore.js` also adds this column lazily (fail-open) via ensureTable(),
 * so a host that never ran this migration still works.
 *
 *   node api/engineer/mtc/db_migrations/20260916_lot_track_saved_shared_with.js
 *   node api/engineer/mtc/db_migrations/20260916_lot_track_saved_shared_with.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('ALTER TABLE lot_track_saved DROP COLUMN IF EXISTS shared_with');
    console.log('[20260916_lot_track_saved_shared_with] reverted — column dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(
    "ALTER TABLE lot_track_saved ADD COLUMN IF NOT EXISTS shared_with TEXT[] NOT NULL DEFAULT '{}'"
  );

  console.log('[20260916_lot_track_saved_shared_with] applied — shared_with column ready');
  await recordRun({ file: __filename });
}

main()
  .then(() => engPool.end())
  .catch((e) => { console.error(e); return engPool.end().finally(() => process.exit(1)); });
