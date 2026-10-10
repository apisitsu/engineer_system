'use strict';

/**
 * Switches `pbring_tooling_image`'s key from an exact `tooling_no` to a
 * DWG-family prefix (`tooling_no`'s first two dash-segments, e.g.
 * "4036-02-0001" -> "4036-02"), by explicit user decision (2026-10-08):
 * one uploaded photo should cover every tooling_no that shares a family,
 * same as the real `sds_tooling_image`'s own evolution — not an exact
 * per-drawing match, which meant a near-identical part needed its own
 * separate upload.
 *
 * A tooling_no with fewer than 2 dash-segments (a plain name, no DWG
 * number) has no meaningful family — its "family" is the name itself,
 * computed by the same `toolingFamily()` helper used at render time
 * (`pbringGridService.js`), so the column still holds one normalized
 * value per row either way.
 *
 * Table is empty of real data at migration time (only throwaway test rows
 * were ever inserted, already cleaned up), so a plain column rename is
 * safe — no backfill/transform needed. Idempotent; `--revert` renames back.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function columnExists(table, column) {
  const { rows } = await engPool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    if (await columnExists('pbring_tooling_image', 'family')) {
      await engPool.query('ALTER TABLE pbring_tooling_image RENAME COLUMN family TO tooling_no');
      console.log('reverted: pbring_tooling_image.family -> tooling_no');
    } else {
      console.log('nothing to revert: pbring_tooling_image.family does not exist');
    }
    await recordRevert({ file: __filename });
    return;
  }

  if (await columnExists('pbring_tooling_image', 'tooling_no')) {
    await engPool.query('ALTER TABLE pbring_tooling_image RENAME COLUMN tooling_no TO family');
    console.log('pbring_tooling_image.tooling_no -> family');
  } else {
    console.log('already renamed: pbring_tooling_image.family exists');
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261014_pbring_tooling_image_family_key.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
