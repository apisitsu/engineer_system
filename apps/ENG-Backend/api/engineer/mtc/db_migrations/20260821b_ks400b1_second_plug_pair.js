'use strict';

/**
 * KS-400B1 — the second plug pair, 4664-21 / 4664-22.
 * ------------------------------------------------------------------------------
 * TEMPLATE_B's BALL(1), BALL(2), BALL(3) and S_ROLLER_ASSY sheets each list PLUG(A)
 * and PLUG(B) TWICE, under two drawing families: 4664-06 / 4664-07 (in the system
 * already) and 4664-21 / 4664-22 (absent entirely). All eight rows are WHITE —
 * selected, not "check only".
 *
 * WHY THIS WAS PREVIOUSLY WRITTEN OFF, AND WHY THAT WAS WRONG
 *
 * `.claude/rules/tooling-select.md` files 4664-21/-22 under "documented but cannot
 * be selected", on the grounds that `プラグA_B（榊原）/球研機KS400_プラグA_B.xls` is an
 * empty workbook. The workbook is indeed empty — but it is also not where TEMPLATE_B
 * points. LINK LIST rows 79–80 send 4664-21 and 4664-22 to the SAME file as the five
 * working families: `20171025_TOOLING LIST_KS400B(SPHERICAL GRIND).xlsx`.
 *
 * More decisively, the rule does not have to be derived at all. The factory plan
 * records what was actually fitted, per C/N, and here it is unambiguous:
 *
 *     4664-21   566 C/Ns   80 drawings   ← every one of the 566 plans exactly ONE
 *     4664-22   565 C/Ns   82 drawings      drawing. Zero ambiguous C/Ns.
 *
 * (`4664-06` for comparison: 620 C/Ns. The second pair is used nearly as often.)
 *
 * THE TWO PAIRS ARE COMPLEMENTARY, NOT ALTERNATIVES — this is what makes the change
 * safe. Of the C/Ns planning either pair at process 1041:
 *
 *     both pairs      566
 *     4664-06 only     54
 *     4664-21 only      0
 *
 * Nothing plans the second pair without the first, so the system has never returned
 * a WRONG plug — it has returned an INCOMPLETE set, missing two items on 566 C/Ns.
 * Adding them can therefore only add; it cannot invalidate an existing answer.
 * `_applyLookupOnlyToolings` enforces that independently: it never displaces a
 * formula-driven result and only runs for machines that passed eligibility.
 *
 * WHY SEPARATE TOOLING NAMES
 *
 * `PLUG(A)` already means 4664-06. Loading 4664-21 under the same name would merge
 * the two shelves, and PLUG(A)'s existing search rules — which carry
 * `inventory_tooling_filter = 'PLUG(A)'` — would then rank across both families and
 * return the wrong one. The names here are `PLUG(A) 4664-21` / `PLUG(B) 4664-22`,
 * following the `LOADER (4559-06 REF)` precedent.
 *
 * WHY THE SHELF IS BUILT FROM THE PLAN
 *
 * `_applyLookupOnlyToolings` looks the pinned drawing up in the machine's inventory
 * table and skips it when absent, so a map row without a shelf row produces nothing.
 * The dimensions are unknown (the workbook is empty) and are left NULL — a
 * lookup-only tooling has no formula and no search rule, so nothing reads them.
 * The rows are dimensionless ON PURPOSE: if a dimension ever turns up, it belongs in
 * a real seed migration with a formula, not filled in by guesswork here.
 *
 * NOT DONE HERE, deliberately: STOCKER CHUTE on KS-400B6. The plan puts 4664-34 on
 * process 1161 (23 C/Ns) as well as 1041, and TEMPLATE_B lists it under KS-400B6 —
 * but KS-400B1's formula, which reproduces the 1041 plan at 95 % top-2 (173 C/Ns),
 * scores only 17 % on the 1161 side. Copying it across would hand 19 of 23 parts the
 * wrong chute. That side needs its own rule.
 *
 * Idempotent: shelf rows for these two names are deleted and reloaded, and
 * `seedCnMapFromPlan` reseeds its own cn-keyed rows. `--revert` removes both.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'KS-400B1';
const INVENTORY = 'tooling_ks400b';
const SOURCE =
  'TEMPLATE_B BALL(1)(2)(3)+S_ROLLER_ASSY proc 1041 (white) · shelf and per-C/N ' +
  'selection from lpb.eng_r_pi_tool · 20260821b_';

const PAIRS = [
  { tooling: 'PLUG(A) 4664-21', family: '4664-21' },
  { tooling: 'PLUG(B) 4664-22', family: '4664-22' },
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

/** Distinct drawings the plan names for a family — this IS the shelf. */
async function planDrawings(family) {
  const { rows } = await maqPool.query(
    `SELECT DISTINCT trim(tool_dwg_no) AS dwg
       FROM lpb.eng_r_pi_tool
      WHERE tool_dwg_no LIKE $1
      ORDER BY 1`, [`${family}%`]
  );
  return rows.map(r => r.dwg).filter(Boolean);
}

async function loadShelf(tooling, family) {
  const drawings = await planDrawings(family);
  if (!drawings.length) throw new Error(`plan names no drawings for ${family}`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [tooling]);

    const COLS = 2;
    const values = drawings.flatMap(d => [tooling, d]);
    const ph = drawings.map((_, ri) =>
      `($${ri * COLS + 1}, $${ri * COLS + 2})`).join(',');
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
    for (const { tooling } of PAIRS) {
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

  for (const { tooling, family } of PAIRS) {
    console.log(`\n── ${tooling}  (${family}) ──`);

    if (dryRun) {
      const drawings = await planDrawings(family);
      console.log(`  plan names ${drawings.length} drawings — would load as the shelf`);
      console.log(`  e.g. ${drawings.slice(0, 5).join(' ')}`);
      continue;
    }

    const shelf = await loadShelf(tooling, family);
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

  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821b_ks400b1_second_plug_pair.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
