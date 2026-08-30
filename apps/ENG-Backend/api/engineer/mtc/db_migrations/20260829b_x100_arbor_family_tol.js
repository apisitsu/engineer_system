'use strict';

/**
 * X-100 (SPH 組切削) — CENTER / WRIST END search-rule tolerance fixes.
 * ============================================================================
 * eval 2026-08-28: CENTER 46 % / 68.8 %, WRIST END 39.7 % / 65.4 %.
 * Offsets measured against the factory plan 2026-08-29
 * (measure_offsets.js, n≈960–1535):
 *
 *   ARBOR PIN A  `floorN(idAft_min-0.01,2)`   |Δ|≤0.2 = 99 %   — formula is EXACT.
 *   CENTER    A  same                          |Δ|≤0.2 = 99 %   — EXACT.
 *   CENTER    C  `floorN(OD-0.4,1)` → dim_c    med 0.1, ≤0.2 75 %, ≤0.5 82 %
 *   WRIST END C  `floorN(OD-0.2,1)` → dim_b    med 0.1, ≤0.5 77 %, ≤1.0 85 %,
 *                                              p10 −1.5  (one-sided low tail)
 *
 * So the A dimension already nails the fit; the misses are the SECONDARY rule
 * either excluding a good primary match (CENTER C, hard ±0.5) or clipping the
 * low tail (WRIST END C, ±0.5 vs a −1.5 p10).
 *
 *   • CENTER C  → rank-only: tol_plus / tol_minus NULL, is_match_dim kept TRUE.
 *     A stays the sole hard filter (it is exact); C still breaks A-ties in the
 *     ranking (dim_a repeats 3–4× on this 132-row shelf) without discarding a
 *     row that fits on A.
 *   • WRIST END C → tol widened to +0.6 / −1.6 to bracket the measured spread.
 *     It is the only rule for this tooling, so the ranking still centres on the
 *     computed value; this just stops the ±0.5 window dropping ~15 % of real
 *     matches.
 *
 * ARBOR PIN is deliberately NOT touched: A is 99 % exact and its shelf has no
 * second part-derivable dimension (dim_b ≈ pin length ~25±3, no context var
 * predicts it above 43 %). Like PUSHER OP1, the shelf out-resolves the part data.
 *
 * Idempotent; `--revert` restores ±0.5 / ±0.5.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829b_x100_arbor_family_tol.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829b_x100_arbor_family_tol.js
 *   node api/engineer/mtc/db_migrations/20260829b_x100_arbor_family_tol.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// [tooling, output_key, fwd_plus, fwd_minus, back_plus, back_minus]
const RULES = [
  ['CENTER', 'C', null, null, '0.5', '0.5'],
  ['WRIST END', 'C', '0.6', '1.6', '0.5', '0.5'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = 'X-100'`)).rows[0].id;

    for (const [tooling, key, fp, fm, bp, bm] of RULES) {
      const [tp, tmn] = revert ? [bp, bm] : [fp, fm];
      const { rows: cur } = await client.query(
        `SELECT id, tol_plus, tol_minus FROM tooling_search_rule
          WHERE machine_id = $1 AND tooling_name = $2 AND output_key = $3`, [mid, tooling, key]);
      if (!cur.length) { console.log(`[x100] rule ${tooling}.${key} missing — skip`); continue; }
      await client.query(
        `UPDATE tooling_search_rule SET tol_plus = $1, tol_minus = $2 WHERE id = $3`,
        [tp, tmn, cur[0].id]);
      console.log(`[x100] rule ${tooling}.${key}: (${cur[0].tol_plus}/${cur[0].tol_minus}) -> (${tp}/${tmn})`);
    }

    if (dryRun) { console.log('[x100] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[x100] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[x100] FAILED:', e.message); process.exit(1); });
