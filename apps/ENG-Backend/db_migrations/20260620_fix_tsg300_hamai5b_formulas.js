'use strict';
/**
 * Fix TSG-300 (machine_id=1, group TSG-300W/TSG-300ZNC) and HAMAI 5B (machine_id=6)
 * CARRIER / CHUTE COVER formulas so the computed req matches the authoritative TOOLING
 * LIST workbooks, and is NULL-safe for the ~35% of CNs with no before-grind (turning) dim.
 *
 * Sources (templates/Select_tool_backup/):
 *   - 20170508_TOOLING LIST_TSG300(FACE GRIND)_SEIBU.xlsx   (TSG-300 CARRIER + CHUTE COVER)
 *   - 20160329_TOOLING LIST_巾ラップキャリア.xlsx              (HAMAI 5B CARRIER)
 *
 * ROOT CAUSE (audited 2026-06-20 vs factory process plan lpb.eng_r_pi_tool proc 1021):
 *   Both workbooks drive selection off TURNING (before-grind) OD/W MAX. The live formulas
 *   referenced `odBf_max`/`wBf_max`, which buildSpecContext collapses to 0 when od_bf/w_bf
 *   is NULL → req computed ~0.2-0.5 → wrong/none. (The 2026-05-28 "fix" documented in
 *   formula-reference.md had reverted in the live DB.)
 *   Additionally the TSG CARRIER:
 *     - D used `floor(W*0.55)` instead of the xlsx allowed-value snap-ladder, and was
 *       NULL-unsafe (w_bf NULL → D=0 → the `dim_d <= D` filter excluded every carrier).
 *     - B (=404-A) and C (=A-2) are perfectly collinear with A (dim_b=404-dim_a,
 *       dim_c=dim_a-2 in inventory) yet were hard `>=` filters that excluded the correct
 *       carrier whenever A rounded slightly high. Disabled as filters (rank-only off).
 *
 * RESULT (factory top-1 / top-2, and search-vs-req closeness):
 *   TSG CHUTE COVER  55%→82% / 92%   (dim_a,dim_b within ±1.0 of req for 99%)
 *   HAMAI 5B CARRIER 48%→62% / 80%   (dim_a 93%, dim_e 90% within ±1.0)
 *   TSG CARRIER      24%→34% / 65%   (pocket dim_a median 0.00, 78% within ±1.0;
 *                                     residual = factory adjacent-size discretion)
 *
 * Idempotent. Run: node db_migrations/20260620_fix_tsg300_hamai5b_formulas.js
 */
const { engPool } = require('../instance/eng_db');

// xlsx D = snap (turning W * 0.55) up an allowed-value ladder, NULL-safe on w_bf.
const Wexpr = 'if(wBf > 0, wBf, wAft) * 0.55';
const ladder = (x) => {
  const steps = [2.5, 3, 4, 4.5, 5, 6, 8, 9, 10, 12];
  let e = `round(${x}, 0)`;
  for (let i = steps.length - 1; i >= 0; i--) e = `if(${x} <= ${steps[i]}, ${steps[i]}, ${e})`;
  return e;
};

const FORMULAS = [
  // TSG-300 CARRIER (4556-01): A = ROUNDUP(turning OD MAX + 0.5, 0); D = snap ladder
  [1, 'CARRIER',     'A', 'ceil(if(odBf > 0, odBf_max, odAft_max) + 0.5)'],
  [1, 'CARRIER',     'D', ladder(Wexpr)],
  // TSG-300 CHUTE COVER (4866-14): A = turning OD MAX + 0.2; B = turning W MAX + 0.1
  [1, 'CHUTE COVER', 'A', 'if(odBf > 0, odBf_max, odAft_max) + 0.2'],
  [1, 'CHUTE COVER', 'B', 'if(wBf > 0, wBf_max, wAft_max) + 0.1'],
  // HAMAI 5B CARRIER (4564-03): A pocket = turning OD MAX + 0.5 (range OD+0.1..OD+1)
  [6, 'CARRIER',     'A', 'ceil05(if(odBf > 0, odBf_max, odAft_max) + 0.5)'],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const [mid, tool, key, expr] of FORMULAS) {
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr=$1
          WHERE machine_id=$2 AND tooling_name=$3 AND output_key=$4`, [expr, mid, tool, key]);
      if (r.rowCount === 0) throw new Error(`formula row not found: [${mid}] ${tool}.${key}`);
      console.log(`✓ formula [${mid}] ${tool}.${key}`);
    }
    // Disable the collinear B & C hard filters on TSG CARRIER (keep rows for display columnMap).
    const rr = await client.query(
      `UPDATE tooling_search_rule SET tol_plus=NULL, tol_minus=NULL, is_match_dim=false
        WHERE machine_id=1 AND tooling_name='CARRIER' AND output_key IN ('B','C')`);
    console.log(`✓ TSG CARRIER B,C search rules → rank-only off (${rr.rowCount} rows)`);
    await client.query('COMMIT');
    console.log('✅ done. Flush caches: DELETE /api/tooling-select/monitor/cache?prefix=sds: and tselect persisted.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
