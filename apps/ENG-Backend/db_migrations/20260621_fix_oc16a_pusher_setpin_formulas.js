'use strict';
/**
 * Fix OC-16A (machine_id=31) RACE PUSHER + SET PIN req formulas so they match the
 * authoritative workbook and the factory process plan.
 *
 * Source: templates/Select_tool_backup/20200212_TOOLING LIST_CENTERLESS-GRINDING-JIG.xlsx
 * Factory answer key: lpb.eng_r_pi_tool process_code 1011 (4560-18 pusher, 4560-21 set pin).
 *
 * Audited 2026-06-21 (top-1 nearest vs factory, single-tool CNs):
 *
 *   RACE PUSHER (A = pusher OD)
 *     - xlsx RACE PUSHER sheet cell I12: "A = OD − 0.5" (and I13/I14: pusher OD must be < work OD).
 *     - DB had `floor05(OD − 1)` → computed ~0.5–1.0 BELOW the factory pusher (systematic undershoot).
 *     - FIX: A = OD − 0.5.  top-1 22.0% → 69.6%.  (Residual = design-revision / operator /
 *       bar-stock variance and multi-feature parts in the answer key — formula now matches the xlsx.)
 *
 *   SET PIN (A = setting-gauge pin dia)
 *     - xlsx SET PIN sheet C22: "A は小数点第三位を四捨五入" (round A to 3rd decimal). The pin is the
 *       centerless SETTING GAUGE → its dia = the work OD the wheel gap is set to = finished OD + grind stock.
 *     - Empirically pin − od_aft is tightly centered on +0.1 (p10 .097 / median .100 / p90 .105;
 *       97.3% within ±0.15). DB had `if(odBf>0,odBf,OD)` = od_aft (od_bf only 4% populated) → 0.1 LOW,
 *       so the closest-match ranking picked the neighbouring pin.
 *     - FIX: A = roundN(OD + 0.1, 3).  top-1 17.3% → 93.2%.
 *
 * Tolerances/selection unchanged (RACE PUSHER ±1.0 nearest; SET PIN ±0.15 nearest) — both verified optimal.
 *
 * Idempotent. Run: node db_migrations/20260621_fix_oc16a_pusher_setpin_formulas.js
 */
const { engPool } = require('../instance/eng_db');

const FIXES = [
  ['RACE PUSHER', 'A', 'OD - 0.5'],
  ['SET PIN',     'A', 'roundN(OD + 0.1, 3)'],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const m = await client.query(`SELECT id FROM tooling_machine WHERE machine_name='OC-16A'`);
    if (!m.rows.length) throw new Error('OC-16A machine not found');
    const machineId = m.rows[0].id;
    for (const [tooling, key, expr] of FIXES) {
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr=$1
          WHERE machine_id=$2 AND tooling_name=$3 AND output_key=$4`,
        [expr, machineId, tooling, key]);
      if (r.rowCount === 0) throw new Error(`${tooling}.${key} not found for machine ${machineId}`);
      console.log(`✓ [${machineId}] ${tooling}.${key} = ${expr}`);
    }
    await client.query('COMMIT');
    console.log('✅ OC-16A formulas fixed. Flush caches: DELETE /api/tooling-select/monitor/cache (+ tselect/sds persisted).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) run().then(() => process.exit(0)).catch(() => process.exit(1));
module.exports = { run };
