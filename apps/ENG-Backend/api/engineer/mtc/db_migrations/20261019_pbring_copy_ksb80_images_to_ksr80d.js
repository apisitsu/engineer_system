'use strict';

/**
 * Copy all 14 pbring_tooling_image rows from KSB80 to KSR80D, per user
 * request 2026-10-19. Confirmed live before writing this: KSR80D had zero
 * images of its own, and its own pbring_sds_condition rows for CN 294065 use
 * the identical tool_code_base family numbers KSB80 uses for the same CN
 * (T1=772.5.000-157, T2=772.5.001-157, … same pattern through T9) — the two
 * machines are IDG-15/IDG-16, the same physical fixtures per the floor-code
 * work earlier this session, so the same photos apply to both.
 *
 * Plain copy, not a move: KSB80's own rows are untouched. Idempotent via
 * ON CONFLICT on (machine_type_name, family, tool_name) — re-running updates
 * the copy in place if KSB80's source image ever changes, never duplicates.
 *
 * `--revert` deletes every KSR80D row whose (family, tool_name) matches one
 * of the 14 source rows — scoped, not a blanket wipe of KSR80D's own images
 * (there were none at the time this was written, but a later admin upload
 * for a family outside this list must survive a revert).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const SOURCE = 'KSB80';
const TARGET = 'KSR80D';

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `DELETE FROM pbring_tooling_image t
        WHERE t.machine_type_name = $1
          AND EXISTS (
            SELECT 1 FROM pbring_tooling_image s
             WHERE s.machine_type_name = $2 AND s.family = t.family AND s.tool_name = t.tool_name
          )`,
      [TARGET, SOURCE]
    );
    console.log(`reverted: ${rowCount} row(s) deleted from ${TARGET}`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rows: source } = await engPool.query(
    `SELECT family, tool_name, image_data, mime_type, file_name, description, created_by
       FROM pbring_tooling_image WHERE machine_type_name = $1`,
    [SOURCE]
  );
  console.log(`source rows (${SOURCE}): ${source.length}`);

  let copied = 0;
  for (const r of source) {
    await engPool.query(
      `INSERT INTO pbring_tooling_image
         (machine_type_name, family, tool_name, image_data, mime_type, file_name, description, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, NOW(), NOW())
       ON CONFLICT (machine_type_name, family, tool_name) DO UPDATE SET
         image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type, file_name = EXCLUDED.file_name,
         description = EXCLUDED.description, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [TARGET, r.family, r.tool_name, r.image_data, r.mime_type, r.file_name, r.description, r.created_by || 'copy:KSB80-to-KSR80D-20261019']
    );
    copied++;
  }
  console.log(`copied: ${copied} row(s) -> ${TARGET}`);

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261019_pbring_copy_ksb80_images_to_ksr80d.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
