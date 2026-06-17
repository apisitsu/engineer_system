'use strict';
/**
 * Fix KS-400B1/B2/B7 (machine_id 7) search-rule bugs found auditing CN311008
 * against the factory process plan (lpb.eng_r_pi_tool).
 *
 * Symptom: PLUG(A)/PLUG(B)/WORK DRIVER returned (NONE) and LOADING CHUTE picked
 * the wrong suffix (0023 instead of the factory-correct 0141 → which also dragged
 * SUPPORT BLOCK to 0023 via the suffix link).
 *
 * Root causes & fixes:
 *  1. LOADING CHUTE dim_a ("Height", ~190) was a ranking dim. Its large magnitude
 *     + an imperfect height formula dominated the closest-match distance, so a chute
 *     whose height happened to equal the computed value beat the one that actually
 *     matched on bore(C)+OD(D). → is_match_dim = false (rank by C/D only).
 *  2. WORK DRIVER dim_b ("Bore B") had a hard tolerance window that excluded the
 *     correct driver (formula over-estimates the bore). → tolerance NULL (rank-only).
 *  3. PLUG(A)/PLUG(B) dim_c ("Length") had a hard tolerance window that excluded the
 *     correct plug (length formula over-estimates). → tolerance NULL (rank-only).
 *  4. LOADING CHUTE D formula was `ceil(odAft_max + 0.2)` — rounding the OD-bore to an
 *     integer, while inventory dim_d is precise (15.5, 16.3 …). At band boundaries the
 *     integer D ranked the wrong chute. → drop the ceil: `odAft_max + 0.2`.
 *     (Validated against the factory process plan over 618 CNs: LOADING CHUTE top-2
 *     accuracy 79% → 86% after #1, → 96% after #4.)
 *
 * Idempotent. Run: node db_migrations/20260610_fix_ks400b1_search_rules.js
 */

const { engPool } = require('../instance/eng_db');

async function run() {
  const M = 7;
  const q1 = await engPool.query(
    `UPDATE tooling_search_rule SET is_match_dim = false
       WHERE machine_id = $1 AND tooling_name = 'LOADING CHUTE' AND output_key = 'A'`, [M]);
  const q2 = await engPool.query(
    `UPDATE tooling_search_rule SET tol_plus = NULL, tol_minus = NULL
       WHERE machine_id = $1 AND tooling_name = 'WORK DRIVER' AND output_key = 'B'`, [M]);
  const q3 = await engPool.query(
    `UPDATE tooling_search_rule SET tol_plus = NULL, tol_minus = NULL
       WHERE machine_id = $1 AND tooling_name IN ('PLUG(A)','PLUG(B)') AND output_key = 'C'`, [M]);
  const q4 = await engPool.query(
    `UPDATE tooling_formula SET formula_expr = 'odAft_max + 0.2'
       WHERE machine_id = $1 AND tooling_name = 'LOADING CHUTE' AND output_key = 'D'
         AND formula_expr = 'ceil(odAft_max + 0.2)'`, [M]);
  console.log(`✅ KS-400B1 fixes: LOADING CHUTE Height→rank-off (${q1.rowCount}), `
    + `WORK DRIVER Bore→rank-only (${q2.rowCount}), PLUG(A/B) Length→rank-only (${q3.rowCount}), `
    + `LOADING CHUTE D ceil→precise (${q4.rowCount})`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
