'use strict';

/**
 * KS-B80 — QUILL 4021-03 and QUILL BOLT 4021-04.
 * ------------------------------------------------------------------------------
 * WHY THIS WAS MISSING, AND WHY THE REASON WAS A MISCOUNT
 *
 * `.claude/rules/tooling-select.md`'s grey-fill table records:
 *
 *     4021-03 QUILL, 4021-04 QUILL BOLT   white 0   grey 10   "never selected —
 *                                                              absent is correct"
 *     4021-05 WHEEL                       white 7   grey  3   "selected — real gap"
 *
 * Recounted from TEMPLATE_B.xlsx on 2026-08-21: **all three are white 7 / grey 3**,
 * identical, across every block; 6 / 2 in the current (bottom) block — white on
 * BALL(2)(3)(4)(5)(6) and BALL(内径にTFE), grey on RACE2 and SLEEVE IDG.
 *
 * The WHEEL figure was right and the QUILL figure was not, so WHEEL was implemented
 * (20260814g_) and the other two were closed as correctly absent. Same evidence,
 * opposite conclusions, from one bad count.
 *
 * THE FACTORY PLAN SAYS THE PRIORITY WAS INVERTED
 *
 *     4021-01 JAW          306 C/Ns   (in the system)
 *     4021-02 BACK PLATE   306 C/Ns   (in the system)
 *     4021-03 QUILL        229 C/Ns   ← absent
 *     4021-04 QUILL BOLT   201 C/Ns   ← absent
 *     4021-05 WHEEL         12 C/Ns   (in the system)
 *
 * QUILL is planned on 74 % of the C/Ns that carry a JAW. WHEEL — the one that got
 * built — is planned on 12, because a grinding wheel is a consumable and rarely
 * appears in a process plan at all.
 *
 * WHY A MAP AND NOT A FORMULA
 *
 * `砥石&クイル/QUILL&BOLT LIST20151009.xlsx` (the file the index workbook's row 122
 * names) shows the selection is a CHAIN, and not one that starts at the workpiece:
 *
 *     workpiece → WHEEL (ID × width) → QUILL BOLT (its key column is literally the
 *     wheel size: ID6,W15 · ID8,W20 · ID10,W25 · ID12,W10 …) → QUILL (via the sheet's
 *     適用クイルボルト column, which lists the bolts each quill accepts)
 *
 * `searchInventory` selects from the part spec only; there is no mechanism for
 * "choose B from what A matched" (the sole precedent, SUPPORT BLOCK ↔ LOADING CHUTE
 * suffix linking, is hardcoded in searchService). And the chain cannot be walked from
 * the plan either, since the plan records a WHEEL for only 12 C/Ns.
 *
 * So the plan is used directly, as the selection it already is. It is nearly free of
 * ambiguity: 228 of 229 QUILL C/Ns plan exactly one drawing, and 201 of 201 for the
 * bolt. The one ambiguous C/N is skipped rather than guessed.
 *
 * THE SHELF COMES FROM THE WORKBOOK, NOT THE PLAN
 *
 * Unlike 20260821b_ (where the drawing list existed only in the plan), here the
 * authoritative list is in the workbook: QUILL ITEM 0001–0014, QUILL BOLT 0001–0018.
 * They are hardcoded below so the migration does not depend on `G:` being mounted —
 * that drive is a per-session Google Drive mount and is not present for a service
 * account (→ .claude/rules/backend-gotchas.md).
 *
 * Keeping the workbook's list rather than the plan's also lets `seedCnMapFromPlan`'s
 * whitelist do its job: the plan uses 11 of the 14 quills and 11 of the 18 bolts, so
 * a future plan row naming something off-list is reported instead of silently mapped.
 *
 * `dim_*` are left NULL. The QUILL sheet does carry dimensions (bolt-seat dia, outer
 * dia, thread, L), but a lookup-only tooling has no formula and no search rule, so
 * nothing reads them — and half-parsing "φ6.000(+0.008/0)" into a numeric column is
 * how wrong data gets in. If the chain ever becomes computable, they belong in a
 * proper seed migration with formulas.
 *
 * Idempotent; `--revert` removes both the shelf rows and the map rows.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'KS-B80';
const INVENTORY = 'tooling_ksb80';
const SOURCE =
  'TEMPLATE_B BALL(2)(3)(4)(5)(6)+BALL(内径にTFE) proc 1061 (white) · shelf from ' +
  'QUILL&BOLT LIST20151009.xlsx · per-C/N selection from lpb.eng_r_pi_tool · 20260821c_';

const seq = (n) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(4, '0'));

const FAMILIES = [
  // QUILL FOT KS-B80 sheet, ITEM 0001–0014
  { tooling: 'QUILL', family: '4021-03', items: seq(14) },
  // QUILL BOLT sheet, ITEM 0001–0018
  { tooling: 'QUILL BOLT', family: '4021-04', items: seq(18) },
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function loadShelf(tooling, family, items) {
  const drawings = items.map(i => `${family}-${i}`);
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [tooling]);

    const values = drawings.flatMap(d => [tooling, d]);
    const ph = drawings.map((_, ri) => `($${ri * 2 + 1}, $${ri * 2 + 2})`).join(',');
    const ins = await client.query(
      `INSERT INTO ${INVENTORY} (tooling_name, tooling_no) VALUES ${ph}`, values);

    await client.query('COMMIT');
    return { removed: del.rowCount, inserted: ins.rowCount };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  if (revert) {
    for (const { tooling } of FAMILIES) {
      const m = await engPool.query(
        `DELETE FROM tooling_partno_map
          WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
        [MACHINE, tooling]);
      const s = await engPool.query(
        `DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [tooling]);
      console.log(`reverted ${tooling}: ${s.rowCount} shelf rows, ${m.rowCount} map rows removed`);
    }
    return;
  }

  await ensureCnMapSchema(engPool);

  for (const { tooling, family, items } of FAMILIES) {
    console.log(`\n── ${tooling}  (${family}) ──`);

    if (dryRun) {
      console.log(`  shelf would be ${items.length} drawings: ${family}-${items[0]} … ${family}-${items[items.length - 1]}`);
      continue;
    }

    const shelf = await loadShelf(tooling, family, items);
    console.log(`  shelf: removed ${shelf.removed}, loaded ${shelf.inserted} drawings`);

    const stats = await seedCnMapFromPlan({
      engPool, maqPool,
      machine: MACHINE, tooling, inventory: INVENTORY, family, source: SOURCE,
    });
    console.log(`  map:   removed ${stats.removed}, inserted ${stats.inserted}` +
                ` · specced ${stats.specced}/${stats.mapped}` +
                ` · off-shelf ${stats.offShelf} · ambiguous ${stats.ambiguous.length}`);
    if (stats.ambiguous.length) {
      console.log(`  ambiguous C/Ns (skipped, not guessed): ${stats.ambiguous.join(' ')}`);
    }
  }

  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821c_ksb80_quill_and_bolt.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
