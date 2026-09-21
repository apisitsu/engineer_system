'use strict';

/**
 * TP-SW-03 SET STICK 4606-08 — select per the drawing's design standard.
 * ------------------------------------------------------------------------------
 * The drawings (4606-08-0001, -0015) carry the design standard
 *   「設計標準  A : ワーク巾 + 0.5  (1本で2型式用)」
 * i.e. one stick serves TWO part types: its two cross-section sides A and B are each
 * `work width + 0.5` for a different part (0001: 10.0 / 11.6 for widths 9.52 / 11.1;
 * 0015: 24.5 / 27.5 for widths 24 / 27).
 *
 * The shipped rule read the two sides as a RANGE - `dim_a <= W+0.5` AND `dim_b >= W+0.5`,
 * with W the assembled SPH width. Measured against the factory plan (1,370 C/Ns that plan a
 * 4606-08 at 2411/2412, all SPH), that shape matches the planned stick on 17 % and the
 * variable W on 6 % of them. Two things were wrong:
 *
 *   - the work width is the BALL width (`ballWidth`), not the assembled width:
 *       min(|dim_a - t|, |dim_b - t|) with t = ballWidth + 0.5 has median error 0.02 mm,
 *       89 % within 0.1 and 98 % within 0.3 (n = 1,210 with a ball width); with W it is
 *       6 % within 0.1;
 *   - the stick matches on EITHER side, not between the two.
 *
 * Replayed offline against the plan, one row per side, +-0.3 tolerance, closest first:
 *   top-1 91 %   top-2 98 %   no match 1 %.
 *
 * MECHANISM - no engine change. Search rules are per-column, so "either side" is expressed by
 * pointing the rule at a VIEW that lists each stick twice (once with each side as `dim_a`) via
 * the existing `inventory_table_override`. The view is read-only; `tooling_tpsw03` is untouched
 * and the Compare-dim lookup still resolves a stick by `tooling_no` on the real table.
 *
 *   formula  A = if(ballWidth > 0, ballWidth + 0.5, -999)    (BETWEEN rule -> -999 sentinel)
 *   rule     A -> dim_a, +-0.3, filter 'SET STICK', table = tooling_tpsw03_set_stick_side
 *
 * A part with no ball width (160 of the 1,370) gets no match rather than a wrong one - the old
 * rule was wrong on 83 % of parts anyway. In the view's result row `dim_a` is the side that
 * matched and `dim_b` the other side.
 *
 * Also clears `tselect_cn_cache`. Idempotent; `--revert` restores the previous rules exactly.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const MACHINE = 'TP-SW-03他';
const TOOLING = 'SET STICK';
const VIEW = 'tooling_tpsw03_set_stick_side';
const NEW_EXPR = 'if(ballWidth > 0, ballWidth + 0.5, -999)';

async function state(c, id) {
  const f = await c.query(`SELECT output_key, formula_expr FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 ORDER BY output_key`, [id, TOOLING]);
  const r = await c.query(`SELECT output_key, inventory_column, tol_plus, tol_minus, inventory_table_override FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 ORDER BY output_key`, [id, TOOLING]);
  const v = await c.query(`SELECT to_regclass($1) AS v`, [VIEW]);
  return { formulas: f.rows, rules: r.rows, view: v.rows[0].v };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const m = await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE]);
    if (!m.rows.length) throw new Error(`${MACHINE} not found`);
    const id = m.rows[0].id;
    console.log('\n-- before --', JSON.stringify(await state(c, id)));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await c.query('BEGIN');
    await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING]);
    await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, TOOLING]);

    if (revert) {
      for (const k of ['A', 'B']) {
        await c.query(`INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order) VALUES ($1,$2::varchar,$3,'W + 0.5',0)`, [id, TOOLING, k]);
      }
      await c.query(`INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, inventory_tooling_filter, is_match_dim)
                     VALUES ($1,$2::varchar,'A','dim_a',0,NULL,0,$2::text,true)`, [id, TOOLING]);
      await c.query(`INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, inventory_tooling_filter, is_match_dim)
                     VALUES ($1,$2::varchar,'B','dim_b',NULL,0,0,$2::text,true)`, [id, TOOLING]);
      await c.query(`DROP VIEW IF EXISTS ${VIEW}`);
    } else {
      await c.query(`CREATE OR REPLACE VIEW ${VIEW} AS
        SELECT id, tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e
          FROM tooling_tpsw03 WHERE tooling_name = 'SET STICK'
        UNION ALL
        SELECT id, tooling_name, tooling_no, machine, dim_b, dim_a, dim_c, dim_d, dim_e
          FROM tooling_tpsw03 WHERE tooling_name = 'SET STICK'`);
      await c.query(`INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
                     VALUES ($1,$2::varchar,'A',$3,0,$4)`,
        [id, TOOLING, NEW_EXPR,
         'Drawing design standard 4606-08: A = work width + 0.5, one stick for two part types (either side). Work width = ball width; measured on 1,210 planned SPH C/Ns.']);
      await c.query(`INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim)
                     VALUES ($1,$2::varchar,'A','dim_a',0.3,0.3,0,'either side = ball width + 0.5',$2::text,$3,true)`, [id, TOOLING, VIEW]);
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); }
    catch (e) { console.warn('tselect_cn_cache not cleared:', e.message); }

    console.log('-- after --', JSON.stringify(await state(c, id)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921d_tpsw03_set_stick_per_drawing.js --revert');
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
