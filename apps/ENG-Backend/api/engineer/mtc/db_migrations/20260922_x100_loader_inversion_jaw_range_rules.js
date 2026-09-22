'use strict';

/**
 * X-100 LOADER JAW (4857-06) and INVERSION JAW (4857-08) — add size-range formulas.
 * ------------------------------------------------------------------------------
 * Both toolings were pin-only (no tooling_formula / tooling_search_rule at all) - every
 * result came from `tooling_partno_map`, keyed per C/N. That is ~100% accurate for a C/N
 * the factory has already run, but returns nothing for one that has not been planned yet
 * (`_applyPartnoOverrides` only overwrites a formula-driven match; `_applyLookupOnlyToolings`
 * then adds an empty placeholder). This does not touch the pin path - `_applyPartnoOverrides`
 * always wins over a formula match when a pin exists, so every already-planned C/N is
 * unaffected. It only changes what a NEW, unpinned C/N sees: a size-based guess instead of
 * an empty result (or a dimensional-twin guess from the similar-part fallback).
 *
 * -- THE TWO FAMILIES KEY ON DIFFERENT DIMENSIONS, MEASURED AGAINST THE PLAN --
 * LOADER JAW clamps the part from outside -> OD. INVERSION JAW flips the part -> it holds by
 * the bore, so its ranges (given as "OD" but tested against every spec dimension) matched ID
 * almost exactly and OD not at all:
 *
 *     4857-08-0002 given range 8-16   -> planned C/Ns' ID:  p5 9.53 .. p95 15.88 (n=198)
 *     4857-08-0012 given range 16-23  -> ID: p5 9.53 .. p95 19.05 (n=16)
 *     4857-08-0015 given range 4-8    -> ID: p5 4.83 .. p95 7.94  (n=247)
 *     4857-08-0016 marked "Ø3"        -> ID: min 3.00, p95 6.35  (n=5)
 *
 * `-0016`'s "3" is not a typo'd range: the drawing's own MARKING block (the text stamped on
 * the physical jaw) reads "4857-08-0016" / "Ø3" - a single nominal size, the same way
 * -0015's marking reads "4857-08-0015(A)" / "Ø4~Ø8" for its stated range. So -0016 is given
 * a floor of 3 (its own marked size) and a ceiling of 4 (-0015's own marked floor) rather
 * than an open floor down to 0 - confirmed against the drawings, not inferred.
 *
 * Scored as a plain range-containment rule (nearest range wins on overlap) against the WHOLE
 * plan, not just the rows above:
 *
 *     INVERSION JAW (by ID):  449 / 500 planned C/Ns (90%)
 *     LOADER JAW    (by OD):  324 / 520 planned C/Ns (62%) - see 20260921/22 analysis for the
 *                             two OD bands where 0003 genuinely overlaps 0009 and 0004 in the
 *                             factory data; this is the plan's own ambiguity, not a rule error.
 *
 * -- SHAPE (matches the range pattern XD-8 LOADER JAW already uses) --
 *     A -> dim_a, tol_plus=0   (col <= computed)   = range floor
 *     B -> dim_b, tol_minus=0  (col >= computed)   = range ceiling
 *   Combined: dim_a <= target <= dim_b. LOADER JAW target = OD; INVERSION JAW target = ID.
 *
 * -- SCOPE --
 *   Only the shelf rows given a range are touched: 3 of 3 LOADER JAW rows (the whole shelf),
 *   4 of 16 INVERSION JAW rows. The other 12 INVERSION JAW drawings are minor plan variants
 *   (n=1-5 each) with no given range - left as pin-only, unset dim_a/dim_b (both NULL today),
 *   so they are simply never reached by the formula and stay reachable only via their pin.
 *
 * Idempotent (checks current values/rows before writing); `--revert` restores dim_a/dim_b to
 * NULL on exactly the 7 rows touched and removes the formulas/rules. Clears tselect_cn_cache.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'X-100';
const SHELF = 'tooling_x100';

const RANGES = {
  'LOADER JAW': {
    ctx: 'OD',
    rows: [['4857-06-0009', 8, 20], ['4857-06-0003', 12, 30], ['4857-06-0004', 30, 45]],
  },
  'INVERSION JAW': {
    ctx: 'ID',
    rows: [['4857-08-0016', 3, 4], ['4857-08-0015', 4, 8], ['4857-08-0002', 8, 16], ['4857-08-0012', 16, 23]],
  },
};

async function state(c, id) {
  const out = {};
  for (const tooling of Object.keys(RANGES)) {
    const shelf = (await c.query(`SELECT tooling_no, dim_a, dim_b FROM ${SHELF} WHERE tooling_name=$1 ORDER BY tooling_no`, [tooling])).rows;
    const f = (await c.query(`SELECT count(*)::int n FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, tooling])).rows[0].n;
    const r = (await c.query(`SELECT count(*)::int n FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, tooling])).rows[0].n;
    out[tooling] = { shelf, formulas: f, rules: r };
  }
  return out;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const id = (await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE])).rows[0]?.id;
    if (!id) throw new Error(`${MACHINE} not found`);
    console.log('\n-- before --', JSON.stringify(await state(c, id), null, 1));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await c.query('BEGIN');
    for (const [tooling, cfg] of Object.entries(RANGES)) {
      for (const [dwg, lo, hi] of cfg.rows) {
        if (revert) {
          await c.query(`UPDATE ${SHELF} SET dim_a=NULL, dim_b=NULL WHERE tooling_name=$1 AND tooling_no=$2`, [tooling, dwg]);
        } else {
          await c.query(`UPDATE ${SHELF} SET dim_a=$3, dim_b=$4 WHERE tooling_name=$1 AND tooling_no=$2`, [tooling, dwg, lo, hi]);
        }
      }
      if (revert) {
        await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, tooling]);
        await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, tooling]);
        continue;
      }
      for (const [key, expr] of [['A', cfg.ctx], ['B', cfg.ctx]]) {
        await c.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           SELECT $1, $2::varchar, $3::varchar, $4::text, 0, $5::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2::varchar AND output_key=$3::varchar)`,
          [id, tooling, key, expr, `Range ${key === 'A' ? 'floor' : 'ceiling'} for pin-fallback selection, given by the floor and measured against the plan (see migration header).`]);
      }
      const ruleDefs = [
        ['A', 'dim_a', 0, null, 'range floor'],
        ['B', 'dim_b', null, 0, 'range ceiling'],
      ];
      for (const [key, col, tp, tm, label] of ruleDefs) {
        await c.query(
          `INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, is_match_dim)
           SELECT $1, $2::varchar, $3::varchar, $4::varchar, $5::numeric, $6::numeric, 0, $7::varchar, $2::text, true
            WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2::varchar AND output_key=$3::varchar)`,
          [id, tooling, key, col, tp, tm, label]);
      }
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); } catch (e) { console.warn('cache not cleared:', e.message); }
    console.log('-- after --', JSON.stringify(await state(c, id), null, 1));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260922_x100_loader_inversion_jaw_range_rules.js --revert');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
