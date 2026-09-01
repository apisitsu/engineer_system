'use strict';

/**
 * Tooling Select accuracy — two measured fixes (2026-08-31).
 * ============================================================================
 * Both found with `scripts/_measure_family.js` (per-family measurement vs
 * `lpb.eng_r_pi_tool`, exact tool_dwg_no scoring) — the full eval harness hangs
 * on this box so measurement was done one family at a time.
 *
 * 1. X-100 ARBOR (machine_id 56, family 4857-01) — 62% top-2, 23% "none".
 *    C (`floorN(OD-0.2,1)`, ±0.5) and D (`ceilN((ballWidth-sphWidth)/2+0.5,1)`,
 *    ±0.3) are approximate secondaries carried as hard BETWEEN filters, so they
 *    exclude the correct A-match on ~1 CN in 4. Make both rank-only (tolerances
 *    NULL, is_match_dim unchanged — they still rank, they no longer filter).
 *    Measured with the override: top-2 62% -> 84%, none 23% -> 0.3%.
 *
 * 2. KS-400B1 WORK DRIVER (machine_id 7, family 4664-01) — 69% top-2.
 *    `A = ceil05(SD - 0.5)` sits exactly +0.5 above every planned driver
 *    (median planned-computed = -0.500, n=387). `floor05` centres it.
 *    Measured with the override: top-1 41% -> 68%, top-2 69% -> 79%,
 *    A median offset -0.5 -> 0.0.
 *
 * Idempotent (checks current value, skips if already applied). `--revert`
 * restores the exact prior values recorded below. `--dry-run` rolls back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831_tselect_x100arbor_ks400b1wd_accuracy.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831_tselect_x100arbor_ks400b1wd_accuracy.js
 *   node api/engineer/mtc/db_migrations/20260831_tselect_x100arbor_ks400b1wd_accuracy.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// X-100 ARBOR search-rule tolerances — [rule_id, output_key, oldPlus, oldMinus]
const ARBOR_RULES = [
  [561, 'C', '0.5', '0.5'],
  [646, 'D', '0.3', '0.3'],
];
// KS-400B1 WORK DRIVER A formula — [formula_id, oldExpr, newExpr]
const WD_A = [434, 'ceil05(SD - 0.5)', 'floor05(SD - 0.5)'];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. X-100 ARBOR: C, D → rank-only ───────────────────────────────────
    for (const [id, key, oldP, oldM] of ARBOR_RULES) {
      if (revert) {
        const r = await client.query(
          `UPDATE tooling_search_rule SET tol_plus = $2, tol_minus = $3
           WHERE id = $1 AND tol_plus IS NULL AND tol_minus IS NULL`, [id, oldP, oldM]);
        console.log(`[acc] X-100 ARBOR ${key} ${r.rowCount ? `restored ±${oldP}` : 'already had tolerances — skip'}`);
      } else {
        const r = await client.query(
          `UPDATE tooling_search_rule SET tol_plus = NULL, tol_minus = NULL
           WHERE id = $1 AND (tol_plus IS NOT NULL OR tol_minus IS NOT NULL)`, [id]);
        console.log(`[acc] X-100 ARBOR ${key} ${r.rowCount ? '-> rank-only' : 'already rank-only — skip'}`);
      }
    }

    // ── 2. KS-400B1 WORK DRIVER: A = floor05(SD - 0.5) ─────────────────────
    {
      const [id, oldExpr, newExpr] = WD_A;
      const from = revert ? newExpr : oldExpr;
      const to = revert ? oldExpr : newExpr;
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr = $2 WHERE id = $1 AND formula_expr = $3`,
        [id, to, from]);
      console.log(`[acc] KS-400B1 WORK DRIVER A ${r.rowCount ? `-> ${to}` : `not at "${from}" — skip`}`);
    }

    if (dryRun) { console.log('[acc] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[acc] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[acc] FAILED:', e.message); process.exit(1); });
