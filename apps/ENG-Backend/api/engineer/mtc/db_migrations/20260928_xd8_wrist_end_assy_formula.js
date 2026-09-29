'use strict';

/**
 * XD-8 WRIST END ASSY — give the shelf its dimensions and select by the bore fit.
 * ------------------------------------------------------------------------------
 * WRIST END ASSY (4858-01-XXXX-99) was pinned per C/N from the factory plan only, because its
 * 30 shelf rows carried NO dimensions (dim_a..dim_f all NULL), so there was nothing to search.
 * A C/N the plan never fitted — e.g. 411519 — therefore printed the tool name with no Tool No.
 *
 * The workbook (20201209_TOOLING LIST_XD-8.xlsx, sheet "WRIST END ASSY") does hold both halves:
 *   • a table of every ASSY drawing with its (A)(B)(C)(D)            → loaded into the shelf below
 *   • a calculation row that derives (A)(B)(C)(D) from the part:
 *       (A) = ROUND(OD - 0.3, 1)      (B) = ID - 1.5
 *       (C) = ROUND(TB + 0.5, 1)      (D) = (BW - RW)/2 + 0.2
 *
 * MEASURED against the ASSY the plan actually used (862 pinned C/Ns; candidates = the 29 drawings):
 *   ≤0.5 mm of the drawing's value:  B 92 %   D 42 %   A 31 %   C 2 %
 *   ranking the shelf, top-1 / top-2: B alone 56 % / 92 %      (most-planned-ASSY baseline 21 % / 34 %)
 *                                     A+B+C+D 48 % / 83 %      B+D 56 % / 66 %      B+C 17 % / 38 %
 * Only (B) predicts the drawing — it is the bore fit, the same finding as J-WAVE's ASSY. (A), (C)
 * and (D) are in the workbook but the shop's choice does not follow them, and adding them to the
 * ranking made it WORSE, so they are loaded on the shelf and deliberately NOT turned into rules.
 *
 * WHAT THIS DOES
 *   1. Loads (A)(B)(C)(D) from the workbook into dim_a..dim_d of the 30 shelf rows. The drawing
 *      4858-01-0021-99 is listed twice in the workbook (two pins: B = 3.5 / 5) and is on the shelf
 *      twice; they are matched in order (shelf id ascending <-> workbook row order).
 *   2. Adds formula   B = ballBore - 1.5   (-999 when the part has no bore: BETWEEN sentinel)
 *      and rule       B -> dim_b   +-0.5   (a window: 92 % of the plan lies inside it).
 *
 * The per-C/N pins (tooling_partno_map, 863 rows) are untouched and still win for the C/Ns they
 * name; this only adds a suggestion where there is no pin. It is a suggestion, marked as
 * Tooling Select's on the sheet, not the shop's plan.
 *
 * Idempotent. `--revert` removes the formula and rule and NULLs the four dimensions.
 * Clears tselect_cn_cache.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'XD-8';
const TOOLING = 'WRIST END ASSY';
const SHELF = 'tooling_xd8';

// [drawing, (A), (B), (C), (D)] in workbook order.
const ROWS = [
  ['4858-01-0008-99', 11, 3, 9, 0.3000000000000007],
  ['4858-01-0037-99', 13.5, 3.5, 10.5, 0],
  ['4858-01-0049-99', 13.8, 3.5, 10.74, 5],
  ['4858-01-0021-99', 15, 3.5, 13, 0.5],
  ['4858-01-0021-99', 15, 5, 13, 0.5],
  ['4858-01-0036-99', 16, 5, 13, -1.5000000000000009],
  ['4858-01-0032-99', 16.5, 6.5, 13.5, 1.0999999999999996],
  ['4858-01-0044-99', 16.5, 5, 11.7, 3.1000000000000005],
  ['4858-01-0025-99', 17, 5, 14, -1.5000000000000009],
  ['4858-01-0046-99', 17, 6.5, 14, 7.1],
  ['4858-01-0048-99', 17.3, 4.5, 14.1, 5.500000000000001],
  ['4858-01-0028-99', 20, 8, 16.5, 0.5],
  ['4858-01-0029-99', 22.5, 10, 18, 0.5],
  ['4858-01-0040-99', 22.8, 10, 16.5, 1.4000000000000004],
  ['4858-01-0041-99', 24.4, 8, 16.2, 1.5],
  ['4858-01-0030-99', 24.5, 11, 19, -1],
  ['4858-01-0043-99', 24.8, 8, null, 5.799999999999999],
  ['4858-01-0042-99', 25.2, 22, 20.9, 6.6],
  ['4858-01-0022-99', 19, 6.5, 15, 1.5],
  ['4858-01-0023-99', 27, 10, 21, -0.20000000000000018],
  ['4858-01-0031-99', 27, 11, 21, -0.5],
  ['4858-01-0024-99', 29, 14, 24, 1.6999999999999993],
  ['4858-01-0047-99', 29, 14, 24, 8],
  ['4858-01-0033-99', 30, 13, 22.5, 3.5],
  ['4858-01-0039-99', 30, 14, 21.5, 1.7999999999999998],
  ['4858-01-0034-99', 33, 14.4, 24.8, 3.5],
  ['4858-01-0045-99', 34.7, 17.6, 27.9, 8.5],
  ['4858-01-0035-99', 39, 17.6, 30, 2.5],
  ['4858-01-0038-99', 39.4, 22, 30.6, 1.6000000000000005],
  ['4858-01-0050-99', 19.6, 6.5, 15.1, 1.8999999999999995],
];
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);

async function state(c, id) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  return {
    shelfWithDims: (await q(`SELECT count(*)::int n FROM ${SHELF} WHERE tooling_name=$1 AND dim_b IS NOT NULL`, [TOOLING])).n,
    formulas: (await q(`SELECT count(*)::int n FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING])).n,
    rules: (await q(`SELECT count(*)::int n FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING])).n,
  };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const id = (await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE])).rows[0]?.id;
    if (!id) throw new Error(`${MACHINE} not found`);
    console.log('-- before --', JSON.stringify(await state(c, id)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }
    await c.query('BEGIN');
    if (revert) {
      await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING]);
      await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING]);
      await c.query(`UPDATE ${SHELF} SET dim_a=NULL, dim_b=NULL, dim_c=NULL, dim_d=NULL WHERE tooling_name=$1`, [TOOLING]);
    } else {
      const shelf = (await c.query(`SELECT id, tooling_no FROM ${SHELF} WHERE tooling_name=$1 ORDER BY tooling_no, id`, [TOOLING])).rows;
      const seen = {};
      for (const [dwg, a, b, cc, d] of ROWS) {
        const n = (seen[dwg] = (seen[dwg] || 0) + 1);
        const target = shelf.filter((s) => s.tooling_no === dwg)[n - 1];
        if (!target) { console.warn(`no shelf row #${n} for ${dwg} — skipped`); continue; }
        await c.query(`UPDATE ${SHELF} SET dim_a=$1, dim_b=$2, dim_c=$3, dim_d=$4 WHERE id=$5`, [r3(a), r3(b), r3(cc), r3(d), target.id]);
      }
      await c.query(`INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
                     SELECT $1::int, $2::varchar, 'B', $3::text, 0, $4::text
                      WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1::int AND tooling_name=$2::varchar AND output_key='B')`,
        [id, TOOLING, 'if(ballBore > 0, ballBore - 1.5, -999)',
         'XD-8 WRIST END ASSY sheet, calc row: (B) = ID - 1.5 (the bore fit). Measured on 862 pinned C/Ns: 92 % within 0.5 mm of the planned drawing; alone it ranks top-1 56 % / top-2 92 %. (A)(C)(D) are in the workbook but do not predict the shop choice (31 / 2 / 42 % within 0.5) and made the ranking worse, so they are not rules.']);
      await c.query(`INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, is_match_dim)
                     SELECT $1::int, $2::varchar, 'B', 'dim_b', 0.5, 0.5, 0, 'bore fit (window)', $2::text, true
                      WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1::int AND tooling_name=$2::varchar AND output_key='B')`, [id, TOOLING]);
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); } catch (e) { console.warn('cache not cleared:', e.message); }
    console.log('-- after --', JSON.stringify(await state(c, id)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260928_xd8_wrist_end_assy_formula.js --revert');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

main().then(() => engPool.end()).catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
