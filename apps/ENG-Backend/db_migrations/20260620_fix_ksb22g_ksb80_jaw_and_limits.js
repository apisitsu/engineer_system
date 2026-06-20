'use strict';
/**
 * Fix KS-B22G (machine_id=2) and KS-B80 (machine_id=3) JAW formula + KS-B22G machine
 * limits so search matches the authoritative TOOLING LIST workbooks and the factory
 * process plan (lpb.eng_r_pi_tool proc 1061 = ID->OD).
 *
 * Sources (templates/Select_tool_backup/):
 *   - 20150609_TOOLING LIST_KS-B22G.xlsx
 *   - 20241223_TOOLING LIST_KS-B80.xlsx
 *
 * AUDIT 2026-06-20 (vs factory; tools JAW 4027-01/4021-01, BACK PLATE 4027-02/4021-02):
 *
 * 1) JAW gripping OD is PROCESS-DEPENDENT (xlsx JAW sheet: machining OD = VLOOKUP on
 *    PROCESS). The JAW clamps the workpiece OD:
 *      - OD->ID  → OD already ground when gripped → after-grind OD
 *      - ID->OD / default → turning (before-grind) OD (these are ID-grinding jigs)
 *    Live formula used bare `odBf_max`, which buildSpecContext zeroes when od_bf is NULL
 *    → JAW.A≈0 → search returned the SMALLEST jaw (4027-01-0079) for ~half the CNs.
 *    Fixed: `if(isODtoID, odAft_max, if(odBf>0, odBf_max, odAft_max))` (NULL-safe).
 *    KS-B22G JAW factory top-1 18.5%→57.5% (top-2 87.4%); KS-B80 JAW 52.8%→73.1% (83.8%).
 *
 * 2) KS-B22G machine limits were too strict vs the factory range (and the xlsx itself
 *    assigns jaws to these parts): W>=10 excluded 70 CNs (W 7-9.5), ID<=16 excluded 19
 *    (ID up to 19.62). Widened to the factory-evidenced range: W>=5, ID 4..20 (OD<=38
 *    unchanged — max factory OD 34.9). JAW none 89→10, BACK PLATE none 88→11.
 *
 * BACK PLATE formulas already match the xlsx (A = idAft_max + 0.3; search dim_a >= A picks
 * the smallest plate >= req, same as the xlsx MIN(>=) rule) — left unchanged.
 *
 * Search-vs-req closeness (top-1): JAW dim_a/dim_b 100% within ±1.0; BACK PLATE 97-99%
 * (B22G) / 81-85% (B80). Residual factory non-exact = adjacent-jaw-size discretion.
 *
 * Idempotent. Run: node db_migrations/20260620_fix_ksb22g_ksb80_jaw_and_limits.js
 */
const { engPool } = require('../instance/eng_db');

const JAW_A = 'if(isODtoID, odAft_max, if(odBf > 0, odBf_max, odAft_max))';

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const mid of [2, 3]) {
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr=$1
          WHERE machine_id=$2 AND tooling_name='JAW' AND output_key='A'`, [JAW_A, mid]);
      if (r.rowCount === 0) throw new Error(`JAW.A not found for machine ${mid}`);
      console.log(`✓ [${mid}] JAW.A → process-aware NULL-safe`);
    }
    // KS-B22G limits → factory range
    const lim = [['W', '5', null], ['ID', '4', '20']];
    for (const [v, mn, mx] of lim) {
      const r = await client.query(
        `UPDATE tooling_machine_limit SET min_value=$1, max_value=$2
          WHERE machine_id=2 AND input_var=$3`, [mn, mx, v]);
      if (r.rowCount === 0) throw new Error(`limit ${v} not found`);
      console.log(`✓ [2] limit ${v} → [${mn}, ${mx}]`);
    }
    await client.query('COMMIT');
    console.log('✅ done. Flush caches: DELETE /api/tooling-select/monitor/cache?prefix=sds: + tselect persisted.');
  } catch (e) {
    await client.query('ROLLBACK'); console.error('❌ failed:', e.message); throw e;
  } finally { client.release(); }
}
if (require.main === module) run().then(() => process.exit(0)).catch(() => process.exit(1));
module.exports = { run };
