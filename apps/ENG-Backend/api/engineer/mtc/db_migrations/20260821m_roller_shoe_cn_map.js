'use strict';

/**
 * BRYANT (KS-03A / KS-B22RD) — pin ROLLER SHOE 4559-05 per C/N from the plan.
 * ------------------------------------------------------------------------------
 * ROLLER SHOE scores **top-2 = 47 %** against the factory plan while the other nine
 * families on this machine reach 69–94 % (SETTING GAUGE 94, FRONT PLATE 92). Its
 * shelf is almost complete — 2 missing drawings out of 419 specced C/Ns — so the
 * gap is in the *selection*, not in the stock.
 *
 * THE DESIGN RULE WAS MEASURED AND REJECTED, in three separate ways
 *
 * The rule itself is transcribed correctly. `20220901_TOOLING LIST_BRYANT_B(ID
 * GRIND).xlsx` sheet `ROLLER SHOE` computes each shoe's 推奨値 by inverting exactly
 * the formulas this system stores — `OD = (A − 15.88)/0.1`, `W = C − 0.2`, and the
 * same `IF(OD<13, 68.26−0.5*OD+0.1, …)` ladder for B. Nothing is mistranscribed.
 *
 *   1. **OD and W do not determine the shoe.** Grouping the planned C/Ns by identical
 *      `od_aft_max` AND `w_aft_max`: 77 groups hold more than one C/N, and **54 of
 *      them are planned different shoes**. No function of (OD, W) can be right.
 *
 *   2. **TYPE does not rescue it.** The sheet carries a TYPE column (1 / 2 / 3 /
 *      SPECIAL, 43 of 170 rows SPECIAL) and the stored formulas already derive a type
 *      from width. Adding it as an exact filter moves top-2 from 45 % to **47 %**, and
 *      allowing SPECIAL through *lowers* it to 41 %.
 *
 *   3. **The tolerance is not the constraint.** `dim_a` spans only 16.51–19.37 — 2.86 mm
 *      across 86 distinct values — while the search rule allows ±1.0, i.e. ±10 mm of
 *      workpiece OD. Tightening it does nothing: rank-1 stays at ~124 from ±1.0 all the
 *      way down to ±0.02, and top-2 only falls (45 → 33 %) as candidates vanish.
 *
 * So this is the FTL PUSHER OP1 / XD-8 STOPPER shape: the sheet designs a *new* shoe,
 * and the shop's choice among the ones already on the shelf lives in the plan.
 *
 * WHAT THE MAP GIVES
 *
 *     C/Ns planned at 1061/1062     453
 *     ambiguous (two shoes)          64  ← skipped, never guessed
 *     mappable                      389
 *     of those, specced             369
 *     off-shelf                       2
 *
 * 369 C/Ns become exact; the ~50 that stay unmapped keep the formula, which
 * `_applyPartnoOverrides` leaves untouched. Nothing is removed.
 *
 * BOTH MACHINES ARE SEEDED. `KS-03A` and `KS-B22RD` share `tooling_ks03a` and split
 * the population by ID (KS-03A takes ID < 12, KS-B22RD ID ≥ 12), so a part reaches
 * exactly one of them. The override only fires for a machine that passed eligibility,
 * so seeding both is correct and cannot cross-contaminate.
 *
 * THE FORMULAS AND SEARCH RULES ARE LEFT ALONE — they are the design rule, they are
 * transcribed faithfully, and they still serve every part the plan has not named.
 *
 * Idempotent per (machine, tooling); `--revert` removes the cn-keyed rows only.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TOOLING = 'ROLLER SHOE';
const FAMILY = '4559-05';
const INVENTORY = 'tooling_ks03a';
const MACHINES = ['KS-03A', 'KS-B22RD'];
const SOURCE =
  'TEMPLATE_B BALL(1)(3)(5)+INNER in BALL proc 1061 · design rule measured and ' +
  'rejected (OD/W insufficient 54/77, TYPE +2pt, tolerance no effect) · ' +
  'per-C/N selection from lpb.eng_r_pi_tool · 20260821m_';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {

  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;
  if (revert) {
    for (const machine of MACHINES) {
      const r = await engPool.query(
        `DELETE FROM tooling_partno_map
          WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
        [machine, TOOLING]);
      console.log(`reverted ${machine}: ${r.rowCount} cn-keyed rows removed`);
    }
    await recordRevert({ file: __filename });
    return;
  }

  await ensureCnMapSchema(engPool);

  for (const machine of MACHINES) {
    console.log(`\n── ${machine} · ${TOOLING} (${FAMILY}) ──`);
    const stats = await seedCnMapFromPlan({
      engPool, maqPool,
      machine, tooling: TOOLING, inventory: INVENTORY, family: FAMILY,
      source: SOURCE, dryRun,
    });
    console.log(`  shelf ${stats.shelf} · mapped ${stats.mapped} · specced ${stats.specced}` +
                ` · off-shelf ${stats.offShelf} · ambiguous ${stats.ambiguous.length}` +
                (dryRun ? '  (dry run)' : ` · removed ${stats.removed}, inserted ${stats.inserted}`));
  }

  if (!dryRun) {
    await recordRun({ file: __filename });
    console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821m_roller_shoe_cn_map.js --revert`);
  }
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
