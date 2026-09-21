'use strict';

/**
 * Copy XD-8's Cutting-Tool details for T06/T07/T08 onto XD-8T, so XD-8T carries the same
 * six configured cutting tools XD-8 does (T01-T03 were copied by `20260919b_`; XD-8 has no
 * data at T04/T05, so those stay empty on both). Owner's request: "use 6 Cutting Tools
 * like XD-8". The Jig/Fixture section (F01-F08) is untouched.
 *
 * As with `20260919b_`, the photo key is copied AS-IS (still `TURN:XD-8:N`), so XD-8T shows
 * XD-8's uploaded photos and follows them if they are replaced later.
 *
 * Idempotent: deletes XD-8T's own rows for these exact param_keys, then re-inserts from
 * XD-8's CURRENT values. `--revert` removes them from XD-8T only.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260921_copy_xd8_t06_t08_to_xd8t.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260921_copy_xd8_t06_t08_to_xd8t.js
 *   node api/engineer/mtc/db_migrations/20260921_copy_xd8_t06_t08_to_xd8t.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const SOURCE = 'XD-8';
const TARGET = 'XD-8T';
const SLOTS = [6, 7, 8];
const FIELD_PREFIXES = [
  'Tool_Name', 'VC', 'F', 'AP', 'Nose_R', 'Insert_Info', 'Insert_Maker',
  'Holder_Info', 'Holder_Maker', 'Rotation', 'Hand', 'Tool_Photo_Key',
];
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const keys = SLOTS.flatMap((slot) => FIELD_PREFIXES.map((p) => `${p}_${slot}`));

async function main() {
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      const d = await client.query(
        `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
        [TARGET, keys]
      );
      await client.query('COMMIT');
      console.log(`[revert] ${TARGET}: removed ${d.rowCount} row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    const src = await client.query(
      `SELECT param_key, param_value FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2) ORDER BY param_key`,
      [SOURCE, keys]
    );
    console.log(`[copy] ${SOURCE} -> ${TARGET}: ${src.rows.length} of ${keys.length} expected key(s) found on source`);
    if (dryRun) {
      src.rows.forEach((r) => console.log(`  ${r.param_key} = ${r.param_value}`));
      console.log('[copy] --dry-run — no changes written');
      return;
    }

    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND param_key = ANY($2)`,
      [TARGET, keys]
    );
    await client.query(
      `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
       SELECT NULL, $1::text, s.param_key, s.param_value, NULL, 'copy-from-xd8-t06-08'
         FROM sds_parameter s WHERE s.machine_type_name = $2 AND s.cn IS NULL AND s.param_key = ANY($3)`,
      [TARGET, SOURCE, keys]
    );
    await client.query('COMMIT');
    console.log(`[copy] done — ${TARGET}: replaced ${del.rowCount} old row(s) with ${src.rows.length} new row(s)`);
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
