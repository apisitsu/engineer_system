'use strict';

/**
 * J-WAVE 4879-06 — select the WRIST END ASSY (-99) as one unit, driven by the wrist end body.
 * ------------------------------------------------------------------------------
 * The drawing master (`lpb.eng_tooling`) names the three suffixes of every 4879-06 number:
 *     -01  リストエンド本体   (wrist end body)      -02  カラー (collar)
 *     -99  リストエンド組立図 / WRIST END ASSY  (the assembled pair - one number, one xxxx)
 * and the factory plan uses -99 on 30 of the 35 C/Ns that use the family.
 *
 * WRIST END and WRIST END COLLAR were selected separately, on unrelated dimensions, so the two
 * #1 picks named the same xxxx only 18 times in 32 (and matched the plan on 8). The wrist end
 * body is the part that fits the work's bore (A = ball bore - 0.3, the best-reproduced
 * dimension), so it leads; the collar carries no independent information (replaying the plan,
 * adding the collar dimensions changed nothing).
 *
 * WHAT THIS DOES
 *   1. Adds a shelf row `4879-06-xxxx-99` (tooling 'WRIST END ASSY') for every xxxx that has a
 *      wrist end body on the shelf and a -99 drawing in the master or the plan (36 bases), with
 *      the body's dimensions. A real row in `tooling_jwave`, so Compare-dim and the admin
 *      inventory resolve it like any other tool.
 *   2. Gives it formulas A/C/D (copied from WRIST END) and rules:
 *        A -> dim_a  +-0.5, ranks          (the bore fit - a hard window)
 *        C -> dim_c  rank only
 *        D -> dim_d  rank only
 *      B is dropped: it reproduces the planned base on 51 % within 0.3 mm, against 71-89 % for
 *      A, C and D. Replayed against the plan (35 C/Ns): top-1 15, top-2 24, no match 1 - the old
 *      WRIST END rules gave 13 / 17 / 3. Small sample; it is all the plan holds for the family.
 *   3. Removes the separate WRIST END and WRIST END COLLAR formulas and rules (kept in
 *      backup tables). Their -01 / -02 SHELF rows stay.
 *
 * Idempotent; `--revert` deletes the -99 rows and restores the formulas and rules. Clears
 * `tselect_cn_cache`. Base 0033 has a collar but no body on the shelf, so it cannot be selected.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINE = 'J-WAVE';
const SHELF = 'tooling_jwave';
const ASSY = 'WRIST END ASSY';
const OLD = ['WRIST END', 'WRIST END COLLAR'];
const F_BAK = 'tooling_formula_bak_20260921g';
const R_BAK = 'tooling_search_rule_bak_20260921g';
const base = (d) => (String(d).match(/^4879-06-(\d{4})/) || [])[1];

async function state(c, id) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  return {
    assyShelf: (await q(`SELECT count(*)::int n FROM ${SHELF} WHERE tooling_name=$1`, [ASSY])).n,
    assyFormulas: (await q(`SELECT count(*)::int n FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, ASSY])).n,
    assyRules: (await q(`SELECT count(*)::int n FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, ASSY])).n,
    oldFormulas: (await q(`SELECT count(*)::int n FROM tooling_formula WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD])).n,
    oldRules: (await q(`SELECT count(*)::int n FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD])).n,
  };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const id = (await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`, [MACHINE])).rows[0]?.id;
    if (!id) throw new Error(`${MACHINE} not found`);
    console.log('\n-- before --', JSON.stringify(await state(c, id)));

    // rows to create
    const bodies = (await c.query(
      `SELECT tooling_no, dim_a, dim_b, dim_c, dim_d, dim_e FROM ${SHELF} WHERE tooling_name = 'WRIST END' AND tooling_no LIKE '4879-06-%' ORDER BY tooling_no`)).rows;
    const master = new Set((await maqPool.query(`SELECT tool_dwg_no FROM lpb.eng_tooling WHERE tool_dwg_no LIKE '4879-06-%-99'`)).rows.map(r => base(r.tool_dwg_no)));
    const planned = new Set((await maqPool.query(`SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE '4879-06-%-99'`)).rows.map(r => base(r.tool_dwg_no)));
    const rows = bodies.filter(b => master.has(base(b.tooling_no)) || planned.has(base(b.tooling_no)));
    console.log(`wrist end bodies ${bodies.length} - with a -99 drawing (master or plan) ${rows.length}`);
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await c.query('BEGIN');
    if (revert) {
      await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2`, [id, ASSY]);
      await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, ASSY]);
      await c.query(`DELETE FROM ${SHELF} WHERE tooling_name=$1`, [ASSY]);
      const hasF = (await c.query(`SELECT to_regclass($1) t`, [F_BAK])).rows[0].t;
      if (hasF) {
        await c.query(`INSERT INTO tooling_formula SELECT * FROM ${F_BAK} b WHERE NOT EXISTS (SELECT 1 FROM tooling_formula f WHERE f.id = b.id)`);
        await c.query(`INSERT INTO tooling_search_rule SELECT * FROM ${R_BAK} b WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule r WHERE r.id = b.id)`);
        await c.query(`DROP TABLE ${F_BAK}`); await c.query(`DROP TABLE ${R_BAK}`);
      }
    } else {
      // backups of what is being replaced (first state wins)
      await c.query(`CREATE TABLE IF NOT EXISTS ${F_BAK} AS SELECT * FROM tooling_formula WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD]);
      await c.query(`CREATE TABLE IF NOT EXISTS ${R_BAK} AS SELECT * FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD]);

      const src = (await c.query(`SELECT output_key, formula_expr FROM tooling_formula WHERE machine_id=$1 AND tooling_name='WRIST END'`, [id])).rows;
      const expr = Object.fromEntries(src.map(r => [r.output_key, r.formula_expr]));
      if (!expr.A && !(await c.query(`SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2`, [id, ASSY])).rows.length) throw new Error('WRIST END formulas not found - nothing to copy');

      for (const b of rows) {
        const no = `4879-06-${base(b.tooling_no)}-99`;
        const has = await c.query(`SELECT 1 FROM ${SHELF} WHERE tooling_name=$1 AND tooling_no=$2`, [ASSY, no]);
        if (has.rows.length) continue;
        await c.query(`INSERT INTO ${SHELF} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [ASSY, no, MACHINE, b.dim_a, b.dim_b, b.dim_c, b.dim_d, b.dim_e]);
      }
      for (const k of ['A', 'C', 'D']) {
        if (!expr[k]) continue;
        await c.query(`INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
                       SELECT $1::int, $2::varchar, $3::varchar, $4::text, 0, $5::text
                        WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1::int AND tooling_name=$2::varchar AND output_key=$3::varchar)`,
          [id, ASSY, k, expr[k], 'Copied from WRIST END. The wrist end body fits the work bore and leads; -99 = body + collar assembly (drawing master: WRIST END ASSY).']);
      }
      const rules = [['A', 'dim_a', 0.5, 0.5], ['C', 'dim_c', null, null], ['D', 'dim_d', null, null]];
      for (const [k, col, tp, tm] of rules) {
        await c.query(`INSERT INTO tooling_search_rule (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, is_match_dim)
                       SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, $5::numeric, $6::numeric, 0, $7::varchar, $2::text, true
                        WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1::int AND tooling_name=$2::varchar AND output_key=$3::varchar)`,
          [id, ASSY, k, col, tp, tm, k === 'A' ? 'bore fit (window)' : 'rank']);
      }
      await c.query(`DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD]);
      await c.query(`DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name = ANY($2)`, [id, OLD]);
    }
    await c.query('COMMIT');
    try { await engPool.query('DELETE FROM tselect_cn_cache'); console.log('tselect_cn_cache cleared'); } catch (e) { console.warn('cache not cleared:', e.message); }
    console.log('-- after --', JSON.stringify(await state(c, id)));
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921g_jwave_wrist_end_assy.js --revert');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); await maqPool.end().catch(() => {}); process.exit(1); });
