'use strict';

/**
 * English display name for EVERY remaining Japanese-named `sds_machine_type_code` row —
 * via `machine_group` (the sanctioned display mechanism), NOT by renaming the join key.
 * ============================================================================
 * Extends 20260829m_ (which covered the 3 Tooling-Select machines 606/800/901) to the
 * other 19 Japanese-named registry rows. These show in the SDS admin "Machine Types" /
 * "Configure Settings" lists, which render `machine_group || machine_type_name`.
 *
 * Why not rename `machine_type_name`: it is a raw-string join key in the SDS PDF join,
 * `sds_machine_tool.machine_type`, `sds_excel_mapping`, `sds_parameter`, and the
 * Tooling-Select side. Renaming the registry once destroyed 1,299 `sds_parameter` rows
 * (.claude/rules/sds-pipeline.md). Every row below was checked 2026-08-29:
 * **0 sds_approval, 0 sds_parameter rows**; only 606/800/901/843 carry any
 * sds_machine_tool rows and those are handled by 20260829m_ / left as-is.
 *
 * Idempotent (`WHERE machine_group IS NULL`). `--revert` sets them back to NULL.
 *
 *   node api/engineer/mtc/db_migrations/20260829o_english_group_all_jp_registry.js [--dry-run|--revert]
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// [machine_type_code, machine_type_name (join key, unchanged), english machine_group]
const MAP = [
  ['510', 'バグマスター', 'Bug Master (deburring)'],
  ['517', '(BRIDGEPORT改)KS-80H', 'KS-80H (Bridgeport mod.)'],
  ['683', 'OSS-E4-800改', 'OSS-E4-800 (mod.)'],
  ['729', '1号機', 'Unit 1'],
  ['753', 'ボール入りロッドエンド用', 'For ball-type rod end'],
  ['756', '2号機', 'Unit 2'],
  ['767', 'NHBB試験機用治具全般', 'NHBB test-rig jigs (general)'],
  ['768', 'NMB_UK試験機用治具全般', 'NMB UK test-rig jigs (general)'],
  ['818', '超仕上げ機', 'Superfinishing machine'],
  ['822', 'フラクチャー組立機', 'Fracture-split assembly machine'],
  ['823', '油穴加工機', 'Oil-hole machining machine'],
  ['824', '球面超仕上げ機', 'Spherical superfinishing machine'],
  ['825', '切り粉除去装置', 'Chip-removal unit'],
  ['827', '塗布機', 'Coating machine'],
  ['833', 'トルク選別機', 'Torque-sorting machine'],
  ['841', '自動アーバー挿入機', 'Auto arbor-insertion machine'],
  ['843', 'US-70・150', 'US-70 / US-150'],
  ['855', 'CPRS-2(改造機）', 'CPRS-2 (modified)'],
  ['999', '試作用ダミー番号', 'Prototype dummy number'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    let n = 0;
    for (const [code, name, grp] of MAP) {
      const to = revert ? null : grp;
      const r = await client.query(
        `UPDATE sds_machine_type_code SET machine_group = $2
          WHERE machine_type_code = $1 AND machine_type_name = $3
            AND (machine_group IS NULL OR machine_group = $4)`,
        [code, to, name, revert ? grp : grp]);
      n += r.rowCount;
      console.log(`[grpall] ${code} ${name} → ${revert ? 'NULL' : `"${grp}"`}  (${r.rowCount})`);
    }
    console.log(`[grpall] ${n} row(s) ${revert ? 'reverted' : 'aliased'}`);
    if (dryRun) { console.log('[grpall] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[grpall] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[grpall] FAILED:', e.message); process.exit(1); });
