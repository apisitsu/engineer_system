'use strict';
/**
 * Realign KS-400B1/B2/B7 (machine_id 7) LOADING CHUTE D formula to the audited
 * value `odAft_max + 0.2` (NO rounding).
 *
 * The 2026-06-10 audit (db_migrations/20260610_fix_ks400b1_search_rules.js + the
 * factory answer-key validator) concluded D must NOT be rounded: removing the ceil
 * took LOADING CHUTE top-2 accuracy 86% → 96% vs lpb.eng_r_pi_tool (618 CNs). The
 * inventory `dim_d` values are precise (e.g. 7.08, 14.62, 22.28) so any upward
 * rounding biases the closest-match at band boundaries.
 *
 * On 2026-06-19 the live value was found to be `ceil(odAft_max + 0.2,1)` — i.e.
 * ceil-to-0.1 (ceilN). The original fix's WHERE only matched the integer-ceil
 * string `ceil(odAft_max + 0.2)`, so it never converted this variant (or it was
 * re-introduced via the admin UI afterwards). ceil-to-0.1 reintroduces the same
 * upward bias the audit removed (smaller magnitude): it flips the LOADING CHUTE
 * pick for ~92 / 7888 eligible CNs (1.2%) vs the no-round formula.
 *
 * Fix: set D = 'odAft_max + 0.2' for any ceil/ceilN variant of the same body.
 * Idempotent. Run: node db_migrations/20260619_fix_ks400b1_loading_chute_d_noround.js
 */

const { engPool } = require('../instance/eng_db');

async function run() {
  const M = 7;
  const TARGET = 'odAft_max + 0.2';
  // Match any ceil(...)/ceilN(...) wrapper around `odAft_max + 0.2` (with or
  // without a precision arg / whitespace) so we don't depend on the exact string.
  const q = await engPool.query(
    `UPDATE tooling_formula
        SET formula_expr = $2
      WHERE machine_id = $1
        AND tooling_name = 'LOADING CHUTE'
        AND output_key = 'D'
        AND regexp_replace(formula_expr, '\\s', '', 'g')
            ~ '^ceil[N]?\\(odAft_max\\+0\\.2(,[0-9]+)?\\)$'`,
    [M, TARGET]);
  const after = await engPool.query(
    `SELECT formula_expr FROM tooling_formula
      WHERE machine_id = $1 AND tooling_name = 'LOADING CHUTE' AND output_key = 'D'`, [M]);
  console.log(`✅ LOADING CHUTE D realigned (${q.rowCount} row): now = ${after.rows.map(r => r.formula_expr).join(' | ')}`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
