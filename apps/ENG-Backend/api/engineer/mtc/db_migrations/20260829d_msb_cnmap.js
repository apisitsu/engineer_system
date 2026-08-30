'use strict';

/**
 * MSB surface grinders (GS-64PFII / PSG-64 / MSG-410) — cn-map the 4547-01 fixtures.
 * ============================================================================
 * eval 2026-08-28: all three machines 43 % top-2 (WORK FIXED BASE / COLLET /
 * COLLET ARBOR / COLLAR), `none = 0`. Root cause (2026-08-29): the shelf
 * `tooling_psg64` holds ~5–6 rows per role (drawings 0017/0024/0029/0030/0036/0039)
 * and the only rule is `A = ID` closest-match — but the factory plan for process
 * 1101 is dominated by the `4547-01-0031-xx` jig-assembly set (117+ C/N) which is
 * in NEITHER `tooling_psg64` NOR `lpb.eng_tooling_size`. Its calc block is on the
 * Okamoto PSG-64 workbook (`研磨_平研_4547-XX_岡本PSG-64`, G: only, not vendored),
 * so no formula can be written and no dimensions inferred.
 *
 * What CAN be done without the workbook: the plan (`lpb.eng_r_pi_tool`) records, C/N
 * by C/N, which drawing the shop actually fitted. For the drawings the shelf DOES
 * stock, `seedCnMapFromPlan` pins that fitment — the same treatment as FTL PUSHER
 * OP1 / XD-8 STOPPER. Nothing is invented: a plan row naming an off-shelf drawing
 * (the 0031 set) is reported and left unmapped, not guessed.
 *
 * Dry-run pins per role (specced C/N in parens): WORK FIXED BASE 22 (17) ·
 * COLLET 25 (19) · COLLET ARBOR 25 (19) · COLLAR 25 (20) · ASSY 4 (4). Applied to
 * all three machine names (process 1101 is 1:1 with the trio; the plan does not
 * distinguish them). 0 ambiguous.
 *
 * The 0031 jig set stays a documented gap — see
 * `api/engineer/mtc/doc/tooling_select_audit_findings.md` "รอบที่เจ็ด".
 *
 * Idempotent (seedCnMapFromPlan deletes + reseeds each (machine, tooling) cn-key
 * block). `--revert` deletes every cn-keyed 4547-01 row it added.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829d_msb_cnmap.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829d_msb_cnmap.js
 *   node api/engineer/mtc/db_migrations/20260829d_msb_cnmap.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const MACHINES = ['GS-64PFII', 'PSG-64', 'MSG-410'];
const TOOLINGS = ['WORK FIXED BASE', 'COLLET', 'COLLET ARBOR', 'COLLAR', 'ASSY'];
const FAMILY = '4547-01';
const SOURCE = 'plan (MSB 4547-01, round-7 2026-08-29)';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  try {
    if (revert) {
      const { rowCount } = await engPool.query(
        `DELETE FROM tooling_partno_map
          WHERE machine_name = ANY($1) AND tooling_name = ANY($2)
            AND cn IS NOT NULL AND tool_dwg_no LIKE '4547-01-%'`,
        [MACHINES, TOOLINGS]);
      console.log(`[msb] revert: deleted ${rowCount} cn-keyed rows`);
      await recordRevert({ file: __filename });
      return;
    }

    await ensureCnMapSchema(engPool);
    let total = 0;
    for (const machine of MACHINES) {
      for (const tooling of TOOLINGS) {
        let s;
        try {
          s = await seedCnMapFromPlan({
            engPool, maqPool, machine, tooling, inventory: 'tooling_psg64',
            family: FAMILY, source: SOURCE, dryRun,
          });
        } catch (e) {
          console.log(`[msb] ${machine} / ${tooling}: skip (${e.message})`);
          continue;
        }
        console.log(`[msb] ${machine} / ${tooling.padEnd(16)} mapped=${s.mapped} inserted=${s.inserted || 0} removed=${s.removed || 0} ambiguous=${s.ambiguous.length}`);
        total += s.inserted || 0;
      }
    }
    console.log(`[msb] ${dryRun ? 'DRY — ' : ''}total inserted ${total}`);
    if (!dryRun) await recordRun({ file: __filename });
  } finally {
    await engPool.end();
    await maqPool.end();
  }
}

main().catch((e) => { console.error('[msb] FAILED:', e.message); process.exit(1); });
