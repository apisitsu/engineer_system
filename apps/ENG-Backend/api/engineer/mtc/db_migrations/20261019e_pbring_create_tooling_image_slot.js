'use strict';

/**
 * Create `pbring_tooling_image_slot` — lets an admin tag an uploaded tooling
 * photo with one or more exact (machine_type_name, process_code, tool_number)
 * slots, instead of relying only on DWG-family string matching to find it at
 * render time.
 *
 * User decision (2026-10-19), after a whole session of "ทำไมรูปไม่แสดง" bugs
 * that all came from the same root cause: `pbring_tooling_image` is keyed by
 * (machine_type_name, family, tool_name), and at render time
 * `buildStandardGridForMachine`/`buildTurningGridForMachine` have to GUESS
 * which uploaded image matches a given T-slot by comparing DWG-family
 * strings — needing a growing pile of fallbacks (broader-family, first-word,
 * cross-machine Centerless-group search) because family strings drift
 * between the Tooling List, the SDS import, and revision suffixes. Tagging a
 * photo with the exact slot it belongs to removes the guesswork for that
 * slot entirely.
 *
 * Deliberately a separate join table rather than adding process_code/
 * tool_number columns straight onto `pbring_tooling_image`: one photo still
 * needs to cover MANY (process_code, tool_number) pairs across a machine's
 * history (e.g. HIGRIND1D's G371-02/PUSHER photo is T2 in both process 1011
 * and 1012 — confirmed live via the Machine Tool Whitelist coverage report
 * built earlier this session), so the relationship is one-image-to-many-slots,
 * not one-to-one. A single slot can only point at one image
 * (UNIQUE (machine_type_name, process_code, tool_number)) — two different
 * photos tagged for the same slot would be ambiguous at render time, so the
 * service layer must replace, not add, when re-tagging a slot.
 *
 * Purely additive: render time tries this exact-slot lookup FIRST, and only
 * falls back to the existing family-matching chain when no row here matches
 * — so every image uploaded before this migration keeps rendering exactly as
 * it did, untagged, until someone tags it.
 *
 * `--revert` drops the table (CASCADE from pbring_tooling_image is on the FK,
 * not here, so dropping this table never touches pbring_tooling_image rows).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(`DROP TABLE IF EXISTS pbring_tooling_image_slot`);
    console.log('reverted: dropped pbring_tooling_image_slot');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`
    CREATE TABLE IF NOT EXISTS pbring_tooling_image_slot (
      id                 SERIAL PRIMARY KEY,
      image_id           INTEGER NOT NULL REFERENCES pbring_tooling_image(id) ON DELETE CASCADE,
      machine_type_name  VARCHAR(64) NOT NULL,
      process_code       VARCHAR(32) NOT NULL,
      tool_number        VARCHAR(16) NOT NULL,
      created_by         VARCHAR(50),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (machine_type_name, process_code, tool_number)
    )
  `);
  await engPool.query(`CREATE INDEX IF NOT EXISTS pbring_tooling_image_slot_image_id_idx ON pbring_tooling_image_slot (image_id)`);
  console.log('created: pbring_tooling_image_slot');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261019e_pbring_create_tooling_image_slot.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
