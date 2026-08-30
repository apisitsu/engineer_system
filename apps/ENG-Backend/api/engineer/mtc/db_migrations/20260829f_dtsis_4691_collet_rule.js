'use strict';

/**
 * DTS-IS (4691 SUPER SPHERE FINISH) — turn the plan cn-map into a real rule for COLLET.
 * ============================================================================
 * `20260829e_` onboarded DTS-IS as cn-map-only (workbook was G:-only). The workbook
 * `20210210_TOOLING LIST_SUPER SPHERE FINISH.xlsx` is now vendored
 * (`doc/tooling_calc_blocks/4691/`) and its `COLEET_組合せ検索` sheet carries an
 * explicit, contiguous OD-range table for COLLET `4691-19`:
 *
 *     DWG No. | OD MIN | OD MAX | W | COLLET BODY 4691-18- | STOPPER 4691-02-
 *     7101      12.70    12.96   15   8100                   0001
 *     …         …        …       …    …                      …
 *     7518      37.83    38.38   28.6 8500                   0018
 *
 * 67 bands, OD 12.70–38.38, no gaps (verified). This is the `+0` containment
 * pattern (KS-B80 WHEEL): `dim_a (OD MIN) <= OD` AND `dim_b (OD MAX) >= OD`.
 *
 * This migration:
 *   1. Loads the FULL 67-row `4691-19` shelf from the sheet (the plan has used only
 *      21) into `tooling_dtsis`: dim_a=OD MIN, dim_b=OD MAX, dim_c=W. Workbook rows
 *      are marked `plan_derived = false`.
 *   2. Loads `STOPPER 4691-02` (0001–0018, 0020, 0021 — 0019 is 使用禁止) with
 *      dim_a=外径(ワーク側), dim_b=巾, dim_c=内径.
 *   3. Adds `tooling_formula` + `tooling_search_rule`:
 *        4691-19  A    = OD  →  dim_a  tol_plus 0   (band min ≤ OD)
 *        4691-19  Amax = OD  →  dim_b  tol_minus 0  (band max ≥ OD)
 *        4691-02  A    = OD  →  dim_a  nearest (shortlist, no hard filter)
 *
 * The `20260829e_` cn-map stays: for a C/N the shop has planned, `_applyPartnoOverrides`
 * still wins; the rule only serves the unmapped / ambiguous C/Ns. Other 4691
 * sub-families (01/03/04/08/18/20) keep cn-map only — the sheet gives no rule for them.
 *
 * Idempotent. `--revert` drops the formula/rule rows, deletes the `plan_derived=false`
 * shelf rows, and NULLs the dims on the `plan_derived=true` rows.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829f_dtsis_4691_collet_rule.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829f_dtsis_4691_collet_rule.js
 *   node api/engineer/mtc/db_migrations/20260829f_dtsis_4691_collet_rule.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// Parsed from `doc/tooling_calc_blocks/4691/` (COLEET_組合せ検索 + STOPPER sheets) and
// vendored as JSON so this migration is self-contained — the TSVs/PDFs under
// tooling_calc_blocks/ can be gitignored. Re-derive with scripts/dump_tooling_calc_blocks.ps1.
const DATA = require('./data/dtsis_4691.json');
const parseCollet = () => DATA.collet_19;
const parseStopper = () => DATA.stopper_02;

const FORMULAS = [
  ['4691-19', 'A', 'OD', 0, 'COLLET band — workpiece OD (COLEET_組合せ検索 sheet)'],
  ['4691-19', 'Amax', 'OD', 1, 'COLLET band ceiling key (paired with A for +0 containment)'],
  ['4691-02', 'A', 'OD', 0, 'STOPPER — nearest by 外径(ワーク側)'],
];
// [tooling, output_key, column, tol_plus, tol_minus, is_match_dim, label]
const RULES = [
  ['4691-19', 'A', 'dim_a', '0', null, true, 'band OD MIN ≤ OD'],
  ['4691-19', 'Amax', 'dim_b', null, '0', true, 'band OD MAX ≥ OD'],
  ['4691-02', 'A', 'dim_a', null, null, true, 'STOPPER 外径 nearest'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = 'DTS-IS'`)).rows[0].id;

    if (revert) {
      const f = await client.query(
        `DELETE FROM tooling_formula WHERE machine_id = $1 AND tooling_name IN ('4691-19','4691-02')`, [mid]);
      const r = await client.query(
        `DELETE FROM tooling_search_rule WHERE machine_id = $1 AND tooling_name IN ('4691-19','4691-02')`, [mid]);
      // restore the plan-derived shelf for 4691-19 (this migration replaced it wholesale)
      await client.query(`DELETE FROM tooling_dtsis WHERE tooling_name = '4691-19'`);
      const { rows: pd } = await maqPool.query(
        `SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE '4691-19-%'`);
      for (const p of pd) {
        await client.query(
          `INSERT INTO tooling_dtsis (tooling_name, tooling_no, machine, plan_derived)
           VALUES ('4691-19', $1::text, 'DTS-IS', true)`, [p.tool_dwg_no.trim()]);
      }
      // 4691-02: drop workbook rows, NULL dims on the plan rows
      const d = await client.query(
        `DELETE FROM tooling_dtsis WHERE tooling_name = '4691-02' AND plan_derived = false`);
      const n = await client.query(
        `UPDATE tooling_dtsis SET dim_a=NULL,dim_b=NULL,dim_c=NULL WHERE tooling_name = '4691-02'`);
      console.log(`[dtsis] revert: -${f.rowCount} formulas, -${r.rowCount} rules; 4691-19 shelf restored to ${pd.length} plan rows; 4691-02 -${d.rowCount} rows, ${n.rowCount} dims nulled`);
      if (dryRun) { await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      return;
    }

    // 1 + 2. shelf load — idempotent
    await client.query(
      `DELETE FROM tooling_formula WHERE machine_id = $1 AND tooling_name IN ('4691-19','4691-02')`, [mid]);

    const collet = parseCollet();
    const stopper = parseStopper();
    console.log(`[dtsis] parsed ${collet.length} COLLET bands, ${stopper.length} STOPPER rows`);

    // 4691-19: every plan drawing is in the workbook's 67 → replace wholesale.
    await client.query(`DELETE FROM tooling_dtsis WHERE tooling_name = '4691-19'`);
    for (const r of collet) {
      await client.query(
        `INSERT INTO tooling_dtsis (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, plan_derived)
         VALUES ('4691-19', $1::text, 'DTS-IS', $2::numeric, $3::numeric, $4::numeric, false)`,
        [r.no, r.a, r.b, r.w]);
    }

    // 4691-02: plan has 5 drawings (0022-0026) NOT in the workbook — keep those, upsert the rest.
    await client.query(
      `DELETE FROM tooling_dtsis WHERE tooling_name = '4691-02' AND plan_derived = false`);
    for (const r of stopper) {
      const upd = await client.query(
        `UPDATE tooling_dtsis SET dim_a=$2::numeric, dim_b=$3::numeric, dim_c=$4::numeric
          WHERE tooling_name='4691-02' AND tooling_no=$1::text`, [r.no, r.a, r.b, r.c]);
      if (!upd.rowCount) {
        await client.query(
          `INSERT INTO tooling_dtsis (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, plan_derived)
           VALUES ('4691-02', $1::text, 'DTS-IS', $2::numeric, $3::numeric, $4::numeric, false)`,
          [r.no, r.a, r.b, r.c]);
      }
    }
    const cnt = await client.query(
      `SELECT tooling_name, count(*)::int n, count(dim_a)::int dims FROM tooling_dtsis
        WHERE tooling_name IN ('4691-19','4691-02') GROUP BY 1`);
    console.table(cnt.rows);

    // 3. formulas (cleared above) + rules
    for (const [t, k, expr, so, desc] of FORMULAS) {
      await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         VALUES ($1::int, $2::text, $3::text, $4::text, $5::int, $6::text)`,
        [mid, t, k, expr, so, desc]);
    }
    await client.query(
      `DELETE FROM tooling_search_rule WHERE machine_id = $1 AND tooling_name IN ('4691-19','4691-02')`, [mid]);
    for (const [t, k, col, tp, tm, md, label] of RULES) {
      await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, is_match_dim, inventory_tooling_filter, label)
         VALUES ($1::int, $2::text, $3::text, $4::text, $5::numeric, $6::numeric, $7::bool, $2::text, $8::text)`,
        [mid, t, k, col, tp, tm, md, label]);
    }
    console.log('[dtsis] formulas + rules written for 4691-19, 4691-02');

    if (dryRun) { console.log('[dtsis] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log('[dtsis] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
    await maqPool.end();
  }
}

main().catch((e) => { console.error('[dtsis] FAILED:', e.message); process.exit(1); });
