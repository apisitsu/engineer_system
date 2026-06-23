'use strict';
/**
 * KS-400B1/B2/B7 (machine_id 7) LOADING CHUTE D — use TURNING (before-grind) OD,
 * with a NULL-safe fallback to after-grind OD.
 *
 *   D = if(odBf > 0, odBf_max, odAft_max) + 0.2
 *
 * WHY: the DWG defines D's basis as "OD = Turning OD (MAX)" — the chute bore must
 * clear the part at its turned (pre-grind) size. The 2026-06-10 audit switched D to
 * `odAft_max + 0.2` purely to dodge od_bf being NULL/0 on ~62% of specs, but that
 * loses the turning-OD basis for the parts that DO have od_bf. The correct pattern
 * (tooling-select.md rule #3) is the before-grind value with an after-grind fallback.
 *
 * VALIDATED vs the factory process plan (lpb.eng_r_pi_tool, process_code 1041,
 * 618 CNs) on 2026-06-19:
 *   odAft_max + 0.2 (old):  top-1 88.0%  top-2 96.4%
 *   turning + 0.2   (new):  top-1 91.4%  top-2 97.4%   (net +21 CN: +23 fixed, −2 broke)
 * Parts with od_bf NULL fall back to odAft_max → identical to the old behaviour for them.
 *
 * NOTE: this does NOT fix every miss. ~8.6% of CNs (e.g. C31-00814 → factory 4664-02-0020)
 * are factory family-standardizations where a snugger valid chute exists in inventory; no
 * per-CN closest-match formula reproduces those. Tracked as a known limitation.
 *
 * Idempotent (sets the exact target string regardless of prior value).
 * Run: node db_migrations/20260619_fix_ks400b1_loading_chute_d_turning_od.js
 */

const { engPool } = require('../instance/eng_db');

const TARGET = 'if(odBf > 0, odBf_max, odAft_max) + 0.2';

async function run() {
  const M = 7;
  const q = await engPool.query(
    `UPDATE tooling_formula
        SET formula_expr = $2
      WHERE machine_id = $1
        AND tooling_name = 'LOADING CHUTE'
        AND output_key = 'D'
        AND formula_expr <> $2`,
    [M, TARGET]);
  const after = await engPool.query(
    `SELECT formula_expr FROM tooling_formula
      WHERE machine_id = $1 AND tooling_name = 'LOADING CHUTE' AND output_key = 'D'`, [M]);
  console.log(`✅ LOADING CHUTE D set to turning-OD basis (${q.rowCount} row): now = ${after.rows.map(r => r.formula_expr).join(' | ')}`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
