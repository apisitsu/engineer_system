'use strict';
/**
 * KS-B22RD (machine_id 5) LOADER 4559-06 — make dim A an UPPER-BOUND FILTER,
 * not a closest-match ranking dim, so an oversized loader can't win on a rounding
 * tie-break.
 *
 * Symptom (reported via CN 330544 / 3MBWTD14-212-T, OD 22.225, W 14.0):
 *   search returned 4559-06-0088 (dim_a=22.2) ABOVE the factory-correct
 *   4559-06-0013 (dim_a=12). The two loaders are dimensionally identical on the
 *   bore-derived dims (dim_b=22.22, dim_c≈11.6, dim_d=23.8); only dim_a differs.
 *
 * Root cause: the LOADER search rule for output_key A had is_match_dim=false AND
 * tol_plus=tol_minus=NULL — so dim_a was COMPLETELY ignored (no rank weight, no
 * filter). Ranking was then B+C+D only, and 4559-06-0088 edged 4559-06-0013 by a
 * trivial 0.01 mm rounding difference in dim_c (11.61 vs 11.60) despite its
 * dim_a=22.2 being wildly outside the DWG-acceptable pocket-width range.
 *
 * DWG (formula-reference.md, KS-03A/KS-B22RD LOADER 4559-06):
 *   A = W − 1, with 0.6W .. W acceptable. The engine computes A = floor(W−1);
 *   since W = computed_A + 1, the DWG upper bound (A ≤ W) is exactly
 *   computed_A + 1 → a constant tol_plus = 1.0.
 *
 * Fix: rule A → is_match_dim=false (keep it OUT of ranking — the bore dim B is the
 * hard fit and must decide the closest match), tol_plus='1.0' (WHERE dim_a ≤
 * computed_A + 1 = W), tol_minus=NULL (the low side was never the problem; A can
 * range down to 0.6W). This both excludes 4559-06-0088 and lets the bore match
 * pick 4559-06-0013.
 *
 * Validated vs the factory process plan (lpb.eng_r_pi_tool proc 1061, C33 LOADER
 * answer key, 11 CNs): this config is the best of four tried —
 *   ORIGINAL (rank-off, no tol) : top-1 27% / top-2 45% ; CN 330544 → 0088 ✗
 *   A as ranking dim (no tol)   : top-1 18% / top-2 36% ; CN 330544 → 0107 ✗
 *   THIS FIX (A≤W filter)       : top-1 36% / top-2 45% ; CN 330544 → 0013 ✓
 *   A filter + ranking on       : top-1  9% / top-2 36% ; CN 330544 → 0107 ✗
 * (Residual misses are revision-duplicate loaders the factory picks by
 *  availability — dimensionally unresolvable, same class as other tooling families.)
 *
 * Idempotent: updates only while the rule is still in the exact buggy state.
 *
 * Run: node db_migrations/20260630_fix_ksb22rd_loader_dim_a_filter.js
 */
const { engPool } = require('../instance/eng_db');

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE tooling_search_rule
          SET is_match_dim = false, tol_plus = '1.0', tol_minus = NULL
        WHERE machine_id = 5
          AND tooling_name = 'LOADER'
          AND output_key = 'A'
          AND inventory_column = 'dim_a'
          AND is_match_dim = false
          AND tol_plus IS NULL
          AND tol_minus IS NULL
        RETURNING id, tooling_name, output_key, inventory_column, is_match_dim, tol_plus, tol_minus`);
    await client.query('COMMIT');

    if (r.rowCount) {
      console.log('  fixed LOADER rule A → A≤W upper-bound filter (tol_plus=1.0):');
      console.table(r.rows);
    } else {
      console.log('  skip: LOADER rule A not in expected buggy state (already fixed?).');
    }

    if (r.rowCount > 0) {
      console.log('\n' + '='.repeat(72));
      console.log('  ⚠  CACHE: the backend caches search rules in tsv2ConfigCache (60s TTL).');
      console.log('     This goes live automatically within ~60s. For an IMMEDIATE effect,');
      console.log('     save any row in the T-Select admin UI (flushes the cache) or restart');
      console.log('     the backend.');
      console.log('='.repeat(72));
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
