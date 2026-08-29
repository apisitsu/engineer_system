'use strict';

/**
 * Anglicize the Japanese text that shows in the Tooling Select UI — DISPLAY LABELS ONLY.
 * =====================================================================================
 * Two columns, both pure display strings that no join, formula, or lookup keys on:
 *   • tooling_machine.label            → shown as a <Tag> beside the machine name
 *                                        (searchService.js:1210 → ToolingSelectV2Page:392)
 *   • tooling_search_rule.label        → column-header hint on the result table
 *
 * What this migration DELIBERATELY DOES NOT TOUCH — the Japanese join keys:
 *   • tooling_machine.machine_name  = '測定用治具全般' / 'その他' / 'TP-SW-03他'
 *   • sds_machine_type_code.machine_type_name  (22 Japanese entries)
 *   • sds_machine_tool.machine_type
 * These are the factory registry's own spelling and are matched as raw strings in the
 * SDS PDF join, the Part-No fixture map, and inventory resolution (CLAUDE.md "Machine
 * Names"). Renaming TSG-300W/TSG-300ZNC to a shared label once destroyed 1,299
 * sds_parameter rows and needed a full revert (.claude/rules/sds-pipeline.md). The
 * documented display mechanism for an English alias on those rows is
 * sds_machine_type_code.machine_group — an owner call, not done here.
 *
 * Idempotent: every UPDATE is `WHERE <col> = <old literal>`, so a second run is a no-op
 * and `--revert` swaps old⇄new. `guard` never blocks --revert / --dry-run.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829j_anglicize_display_labels.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829j_anglicize_display_labels.js
 *   node api/engineer/mtc/db_migrations/20260829j_anglicize_display_labels.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// tooling_machine.label  — [machine_name, jp, en]
const MACHINE_LABELS = [
  ['THREAD ROLL',   'THREAD ROLL (転造 · process 1841)',                     'THREAD ROLL (thread rolling · process 1841)'],
  ['TP-SW-03他',    'TP-SW-03他 (ゆるめ RELEASE · process 2411)',            'TP-SW-03 series (RELEASE · process 2411)'],
  ['FTL-10(I)',     'FTL-10(I) (組切削 COLLET CHUCK · process 2071/2031)',    'FTL-10(I) (assembly cutting · COLLET CHUCK · process 2071/2031)'],
  ['J-WAVE',        'J-WAVE (高松 組切削 · process 2071/2031)',              'J-WAVE (Takamatsu assembly cutting · process 2071/2031)'],
  ['測定用治具全般', '測定用治具全般 (検査 · 9901 series)',                     'Measuring jigs — general (inspection · 9901 series)'],
  ['TM330',         'TM330 (BBS KINMEI 巾切削)',                             'TM330 (BBS KINMEI · width cutting)'],
  ['1MP-H',         '1MP-H (HYDRA GRIP 巾仕上)',                             '1MP-H (HYDRA GRIP · width finishing)'],
  ['その他',        'その他 (4800 BONDING / 接着)',                          'Other — misc bucket (4800 BONDING / adhesive)'],
];

// tooling_search_rule.label — [machine_id, tooling_name, jp, en]
const RULE_LABELS = [
  [72, 'SET STICK',   '巾(大) — stick max width',                                                    'width (max) — stick max width'],
  [72, 'SET STICK',   '巾(小) — stick min width',                                                    'width (min) — stick min width'],
  [74, 'PUSHER OP2',  'Pusher mouth (とば口径 + 1.5)',                                                'Pusher mouth (bore mouth dia + 1.5)'],
  [76, 'COLLET OP1',  "Collet bore — the sheet's own 許容値: work OD nominal to MAX + 0.15",          "Collet bore — the sheet's own tolerance: work OD nominal to MAX + 0.15"],
  [82, '4691-02',     'STOPPER 外径 nearest',                                                        'STOPPER OD (outer dia) nearest'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    let n = 0;

    for (const [name, jp, en] of MACHINE_LABELS) {
      const from = revert ? en : jp;
      const to = revert ? jp : en;
      const r = await client.query(
        `UPDATE tooling_machine SET label = $1 WHERE machine_name = $2 AND label = $3`,
        [to, name, from]);
      n += r.rowCount;
      console.log(`[lbl] tooling_machine ${name}: ${r.rowCount ? `→ ${to}` : '(no match — skip)'}`);
    }

    for (const [mid, tool, jp, en] of RULE_LABELS) {
      const from = revert ? en : jp;
      const to = revert ? jp : en;
      const r = await client.query(
        `UPDATE tooling_search_rule SET label = $1 WHERE machine_id = $2 AND tooling_name = $3 AND label = $4`,
        [to, mid, tool, from]);
      n += r.rowCount;
      console.log(`[lbl] tooling_search_rule ${mid}/${tool}: ${r.rowCount ? `→ ${to}` : '(no match — skip)'}`);
    }

    console.log(`[lbl] ${n} row(s) ${revert ? 'reverted' : 'updated'}`);
    if (dryRun) { console.log('[lbl] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[lbl] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[lbl] FAILED:', e.message); process.exit(1); });
