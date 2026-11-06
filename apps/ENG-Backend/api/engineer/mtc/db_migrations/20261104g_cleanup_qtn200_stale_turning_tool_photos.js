'use strict';

/**
 * Deletes QTN200's leftover `Tool_Photo_Key_4/5/7/8` (and `Turning_Layout_Photo_Key`
 * if present) `sds_parameter` rows — admin uploads made through the "Turning Tool
 * Images" tab while QTN200 was still on the OLDER "Turning" template (id=8, 8-slot
 * 2-column layout). `20261104e_move_lb12_qtn200_to_turning_general.js` moved it onto
 * "Turning_General" (id=10, 12-slot 3-column layout, different slot numbering
 * entirely) but these params survived, because the mechanism that reads them
 * (`Tool_Photo_Key_N` -> `turning_tool_image_N` in sdsV2HeadlessController.js) is NOT
 * gated by machine or template at all — it fires for any machine carrying the param,
 * placing the photo at the id=8 layout's own hardcoded coordinates (e.g.
 * `turning_tool_image_5` = T17:W24).
 *
 * Reported live: QTN200's T05 cutting condition (real SANDVIK insert data, entered
 * after the Turning_General move) rendered with an unrelated tool photo floating in
 * the gap between the T05 and T09 blocks — the stale Tool_Photo_Key_5 row firing at
 * its old coordinates, which happen to land there on the new layout. It was mistaken
 * for the block-divider border bug (already fixed separately) because both produced
 * stray marks in the same visual area.
 *
 * Turning_General has no equivalent per-slot photo mechanism — its only configured
 * image is the one T01 fixture slot (`turning_general_fixture_image_T01`), wired
 * through the ordinary whitelist-driven `valueMap.tooling` path, not this one. There
 * is nothing to migrate these rows TO; they are simply retired.
 *
 * Idempotent: deletes by exact param_key, re-running when none remain is a no-op.
 * `--revert` cannot restore them (not backed up — they were pointers into
 * `sds_v2_tooling_image`, not the images themselves, and the images stay in that
 * table regardless); if QTN200 ever moves back to the "Turning" template, the
 * photos would need re-uploading through that tab.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104g_cleanup_qtn200_stale_turning_tool_photos.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261104g_cleanup_qtn200_stale_turning_tool_photos.js
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun } = require('../../../../db_migrations/lib/migrationLog');

const MACHINE = 'QTN200';
const PARAM_KEYS = [
  'Tool_Photo_Key_1', 'Tool_Photo_Key_2', 'Tool_Photo_Key_3', 'Tool_Photo_Key_4',
  'Tool_Photo_Key_5', 'Tool_Photo_Key_6', 'Tool_Photo_Key_7', 'Tool_Photo_Key_8',
  'Turning_Layout_Photo_Key',
];
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert: false })) return;

  const client = await engPool.connect();
  try {
    const existing = await client.query(
      `SELECT param_key, param_value FROM sds_parameter WHERE machine_type_name = $1 AND param_key = ANY($2)`,
      [MACHINE, PARAM_KEYS]
    );
    console.log(`[cleanup] ${existing.rows.length} stale row(s) found for ${MACHINE}:`);
    existing.rows.forEach((r) => console.log(`  ${r.param_key} = ${r.param_value}`));

    if (dryRun) { console.log('[cleanup] --dry-run — no changes written'); return; }
    if (!existing.rows.length) { console.log('[cleanup] nothing to do'); await recordRun({ file: __filename }); return; }

    const del = await client.query(
      `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND param_key = ANY($2)`,
      [MACHINE, PARAM_KEYS]
    );
    console.log(`[cleanup] removed ${del.rowCount} row(s)`);
    await recordRun({ file: __filename });
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[cleanup] FAILED:', e.message); process.exit(1); });
