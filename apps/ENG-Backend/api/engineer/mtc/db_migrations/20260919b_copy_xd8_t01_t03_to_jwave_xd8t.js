'use strict';

/**
 * Copy XD-8's Cutting-Tool details for T01/T02/T03 only (Tool Name, VC, F, AP, Nose R,
 * Insert, Maker (Insert), Holder, Maker (Holder), Rotation, Hand, and the internal
 * photo-key that links to XD-8's uploaded photos) onto J-WAVE and XD-8T — per the
 * owner's explicit request. T04-T08 and the F01-F08 fixture section are untouched on
 * both targets.
 *
 * The photo key is copied AS-IS (still pointing at `TURN:XD-8:N`), the same aliasing
 * choice made for the X-100 -> XC-100 clone (`20260918_`): J-WAVE/XD-8T show XD-8's
 * actual uploaded photos rather than duplicated binaries, and will follow if XD-8's
 * photos are replaced later through the Turning Tool Details admin tab.
 *
 * Idempotent: deletes the target's own rows for these exact param_keys first, then
 * re-inserts from XD-8's CURRENT values — re-running just refreshes both targets to
 * match XD-8. `--revert` removes the copied rows from both targets (does not touch XD-8).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260919b_copy_xd8_t01_t03_to_jwave_xd8t.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260919b_copy_xd8_t01_t03_to_jwave_xd8t.js
 *   node api/engineer/mtc/db_migrations/20260919b_copy_xd8_t01_t03_to_jwave_xd8t.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const SOURCE = 'XD-8';
const TARGETS = ['J-WAVE', 'XD-8T'];
const SLOTS = [1, 2, 3];
const FIELD_PREFIXES = [
  'Tool_Name', 'VC', 'F', 'AP', 'Nose_R', 'Insert_Info', 'Insert_Maker',
  'Holder_Info', 'Holder_Maker', 'Rotation', 'Hand', 'Tool_Photo_Key',
];
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function ownedKeys() {
  const keys = [];
  for (const slot of SLOTS) for (const p of FIELD_PREFIXES) keys.push(`${p}_${slot}`);
  return keys;
}

async function main() {
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;
  const keys = ownedKeys();
  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      let total = 0;
      for (const target of TARGETS) {
        const d = await client.query(
          `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
          [target, keys]
        );
        total += d.rowCount;
        console.log(`[revert] ${target}: removed ${d.rowCount} row(s)`);
      }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      console.log(`[revert] done — ${total} row(s) removed total`);
      return;
    }

    const src = await client.query(
      `SELECT param_key, param_value FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
      [SOURCE, keys]
    );
    console.log(`[copy] ${SOURCE} -> [${TARGETS.join(', ')}]: ${src.rows.length} of ${keys.length} expected key(s) found on source`);
    if (dryRun) {
      src.rows.forEach(r => console.log(`  ${r.param_key} = ${r.param_value}`));
      console.log('[copy] --dry-run — no changes written');
      return;
    }

    await client.query('BEGIN');
    for (const target of TARGETS) {
      const del = await client.query(
        `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
        [target, keys]
      );
      await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
         SELECT NULL, $1::text, s.param_key, s.param_value, NULL, 'copy-from-xd8-t01-03'
           FROM sds_parameter s WHERE s.machine_type_name = $2 AND s.cn IS NULL AND s.param_key = ANY($3)`,
        [target, SOURCE, keys]
      );
      console.log(`  ${target}: replaced ${del.rowCount} old row(s) with ${src.rows.length} new row(s)`);
    }
    await client.query('COMMIT');
    console.log('[copy] done');
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[copy] FAILED:', e.message); process.exit(1); });
