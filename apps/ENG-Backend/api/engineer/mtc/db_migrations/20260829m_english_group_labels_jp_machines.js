'use strict';

/**
 * Give the three Japanese-named registry machines an English display name — via
 * `machine_group`, the sanctioned mechanism, NOT by renaming `machine_type_name`.
 * ============================================================================
 * `.claude/rules/sds-pipeline.md`: "machine_group already handles the group label display
 * … The machine_group field is the right mechanism — use it." The SDS admin UI and
 * SdsV2Page both render `machine_group || machine_type_name`, and T-Select's
 * `resolveMachine` maps the group label back to the representative, so the raw-string
 * join keys (`sds_machine_type_code.machine_type_name`, `sds_machine_tool.machine_type`,
 * `tooling_machine.machine_name`, `tooling_partno_map.machine_name`) are untouched.
 *
 *   code 901  測定用治具全般  → group "Measuring Jig (general)"
 *   code 606  TP-SW-03他     → group "TP-SW-03 series"
 *   code 800  その他          → group "Other (misc)"
 *
 * Safety checks done before writing this (2026-08-29):
 *   • 0 rows in sds_approval for any of the three → no sds_board_card_link to re-key
 *     (cf. 20260804_rekey_sds_board_card_link_to_group.js — not needed here).
 *   • Each becomes a single-member group; SdsV2Page shows a 1-member group AS the group
 *     label (resolveMachineDisplay), groupMembers resolves it 1:1, and searchService
 *     returns `machine_group` as the T-Select display name with resolveMachine mapping
 *     it back.
 *   • templateBConformance keys on machine_type_name / machine_type_code, not
 *     machine_group → KPI unaffected.
 *
 * Also updates `tooling_machine.machine_group` to the same label so the T-Select side
 * groups/déisplays consistently (that column is nullable and only 2 machines use it today:
 * KS-400B1, TSG-300W).
 *
 * Idempotent (WHERE current value is NULL or the target). `--revert` sets them back to NULL.
 *
 *   node api/engineer/mtc/db_migrations/20260829m_english_group_labels_jp_machines.js [--dry-run|--revert]
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// [machine_type_code, machine_type_name (join key, unchanged), english group label]
const MAP = [
  ['901', '測定用治具全般', 'Measuring Jig (general)'],
  ['606', 'TP-SW-03他', 'TP-SW-03 series'],
  ['800', 'その他', 'Other (misc)'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const [code, name, grp] of MAP) {
      const to = revert ? null : grp;
      const guardVals = revert ? [grp] : [null, grp];
      const inList = guardVals.map((_, i) => `$${i + 3}`).join(', ');
      const r1 = await client.query(
        `UPDATE sds_machine_type_code SET machine_group = $2
          WHERE machine_type_code = $1 AND (machine_group IS NULL OR machine_group IN (${inList}))`,
        [code, to, ...guardVals]);
      const r2 = await client.query(
        `UPDATE tooling_machine SET machine_group = $2
          WHERE machine_name = $1 AND (machine_group IS NULL OR machine_group IN (${inList}))`,
        [name, to, ...guardVals]);
      console.log(`[grp] ${code}/${name} → ${revert ? 'NULL' : `"${grp}"`}  (registry ${r1.rowCount}, tooling_machine ${r2.rowCount})`);
    }
    if (dryRun) { console.log('[grp] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[grp] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[grp] FAILED:', e.message); process.exit(1); });
