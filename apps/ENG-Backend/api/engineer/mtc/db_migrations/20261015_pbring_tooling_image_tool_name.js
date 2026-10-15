'use strict';

/**
 * Adds `tool_name` to `pbring_tooling_image` and widens its unique key from
 * `(machine_type_name, family)` to `(machine_type_name, family, tool_name)`.
 *
 * Reported live (2026-10-14): HIGRIND1D's DWG family "G371-02" covers THREE
 * distinct physical tools — PUSHER (G371-02-0002), COLLAR (FRONT)
 * (G371-02-0005), COLLAR (BACK) (G371-02-0006) — not revisions of one part.
 * Uploading a photo for any one of them silently overwrote the same
 * (machine_type_name, family) row the other two also matched at render
 * time. Checked live before writing this migration: it is not an isolated
 * case — KSB22's family "37281-05" alone covers four distinct items
 * (IN-CHUTE BASE, ROLLER UNIT ASSY, SPINDLE HOLDER, UPPER ROLLER CASE).
 *
 * `tool_name` is `NOT NULL DEFAULT ''` rather than nullable — a nullable
 * column in a UNIQUE constraint makes ON CONFLICT never fire for two NULLs
 * (NULL <> NULL), so a second upload with no tool_name would silently
 * INSERT a duplicate row instead of replacing the first. Empty string
 * means "the whole family, no specific tool" and is backward compatible by
 * construction: the 33 images already on file at migration time keep that
 * value, so they keep rendering exactly as before (the render-time lookup,
 * see buildStandardGridForMachine, matches the tool's own resolved name
 * first and falls back to the empty-string/family-wide entry when no
 * specific match exists) — nothing is guessed or reassigned for existing
 * uploads, since the data is too inconsistent to backfill safely (some
 * families resolve to one tooling_item, some to several, some to none).
 *
 * Idempotent; `--revert` drops the column and restores the original
 * (machine_type_name, family) constraint — safe only if no two rows then
 * share a family, which `--revert` checks and refuses rather than silently
 * dropping data.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const OLD_CONSTRAINT = 'pbring_tooling_image_machine_type_name_tooling_no_key';
const NEW_CONSTRAINT = 'pbring_tooling_image_machine_family_tool_key';

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
    const { rows: dupes } = await engPool.query(
      `SELECT machine_type_name, family, count(*) FROM pbring_tooling_image
        GROUP BY machine_type_name, family HAVING count(*) > 1`
    );
    if (dupes.length) {
      console.log(`Refusing to revert: ${dupes.length} (machine_type_name, family) pair(s) now have more than one row`);
      console.log(JSON.stringify(dupes, null, 2));
      throw new Error('revert would violate the old (machine_type_name, family) unique constraint — resolve the duplicates first');
    }
    await engPool.query(`ALTER TABLE pbring_tooling_image DROP CONSTRAINT IF EXISTS ${NEW_CONSTRAINT}`);
    if (await columnExists('pbring_tooling_image', 'tool_name')) {
      await engPool.query('ALTER TABLE pbring_tooling_image DROP COLUMN tool_name');
    }
    await engPool.query(
      `ALTER TABLE pbring_tooling_image ADD CONSTRAINT ${OLD_CONSTRAINT} UNIQUE (machine_type_name, family)`
    );
    console.log('reverted: pbring_tooling_image.tool_name dropped, (machine_type_name, family) constraint restored');
    await recordRevert({ file: __filename });
    return;
  }

  if (!(await columnExists('pbring_tooling_image', 'tool_name'))) {
    await engPool.query(`ALTER TABLE pbring_tooling_image ADD COLUMN tool_name TEXT NOT NULL DEFAULT ''`);
  }
  await engPool.query(`ALTER TABLE pbring_tooling_image DROP CONSTRAINT IF EXISTS ${OLD_CONSTRAINT}`);
  await engPool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${NEW_CONSTRAINT}') THEN
        ALTER TABLE pbring_tooling_image ADD CONSTRAINT ${NEW_CONSTRAINT} UNIQUE (machine_type_name, family, tool_name);
      END IF;
    END $$;
  `);

  const { rows } = await engPool.query(`SELECT count(*)::int AS n FROM pbring_tooling_image`);
  console.log(`pbring_tooling_image.tool_name added (NOT NULL DEFAULT ''); ${rows[0].n} existing row(s) kept as family-wide ('')`);

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015_pbring_tooling_image_tool_name.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
