'use strict';

/**
 * Tooling Select accuracy — KS-400B1 PLUG(A) / PLUG(B) (2026-08-31).
 * ============================================================================
 * Measured with `scripts/_measure_family.js` vs `lpb.eng_r_pi_tool`
 * (exact tool_dwg_no scoring, n≈380 planned CNs per family).
 *
 * Root cause: only dim_a fed the closest-match ranking, but the PLUG shelves hold
 * many drawings with near-identical A (≈5 rows at A≈3.2, ≈6 at A≈4.3), so the
 * ranking could not tell them apart. The formulas themselves are faithful to the
 * 4664 workbook (verified against source.xlsx: A = IF(D17<20, D17*0.7, D17-4)
 * for (A); D17-0.7 / D17-1.0 for (B)).
 *
 * PLUG(A) 4664-06 — search-rule only, no formula change:
 *   • B (dim_b, SD-0.5): is_match_dim false -> true  (rank on it, still no filter)
 *   • + rank-only rules C -> dim_c, D -> dim_d
 *   Measured: top-2 41.5% -> 70.8%
 *
 * PLUG(B) 4664-07:
 *   • B (dim_b): is_match_dim false -> true
 *   • + rank-only rules D -> dim_d, E -> dim_e
 *   • formula A: idAft_min-0.7 / -1.0  ->  idAft_min-0.95 / -1.25
 *     The workbook's -0.7 sits exactly +0.25 above every planned plug
 *     (median planned-computed = -0.250, n=379, |Δ|≤0.5 of that = 91%). The
 *     shift is measured from the plan, applied to both TYPE branches, and is the
 *     same "plan beats the drawing constant" call as KS-B22G W≥14 -> W≥5
 *     (20260815o_). The drawing structure is kept.
 *   Measured: top-2 49.6% -> 75.2%
 *
 * Idempotent (checks current state, skips what is already applied). `--revert`
 * removes the added rules and restores B / formula A to the values below.
 * `--dry-run` rolls back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831b_tselect_ks400b1_plug_ranking.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831b_tselect_ks400b1_plug_ranking.js
 *   node api/engineer/mtc/db_migrations/20260831b_tselect_ks400b1_plug_ranking.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const MID = 7; // KS-400B1

// search rules to turn into ranking dims (id, tooling, key)
const B_TO_RANK = [
  [83, 'PLUG(A)', 'B'],
  [85, 'PLUG(B)', 'B'],
];
// rank-only rules to add (tooling, key, column) — tol NULL, is_match_dim true
const ADD_RULES = [
  ['PLUG(A)', 'C', 'dim_c', 'Length'],
  ['PLUG(A)', 'D', 'dim_d', 'Chamfer D'],
  ['PLUG(B)', 'D', 'dim_d', 'Chamfer D'],
  ['PLUG(B)', 'E', 'dim_e', 'Fit E'],
];
// formula A for PLUG(B) — [id, oldExpr, newExpr]
const PLUGB_A = [
  423,
  'if(idAft_min < 20, idAft_min - 0.7, idAft_min - 1.0)',
  'if(idAft_min < 20, idAft_min - 0.95, idAft_min - 1.25)',
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // ── B rules: is_match_dim false <-> true ──────────────────────────────
    for (const [id, tooling, key] of B_TO_RANK) {
      const want = revert ? false : true;
      const r = await client.query(
        `UPDATE tooling_search_rule SET is_match_dim = $2
         WHERE id = $1 AND is_match_dim = $3`, [id, want, !want]);
      console.log(`[plug] ${tooling} ${key} is_match_dim -> ${want}${r.rowCount ? '' : ' (already, skip)'}`);
    }

    // ── rank-only rules: add on apply, remove on revert ───────────────────
    for (const [tooling, key, col, label] of ADD_RULES) {
      if (revert) {
        const r = await client.query(
          `DELETE FROM tooling_search_rule
           WHERE machine_id = $1 AND tooling_name = $2 AND output_key = $3
             AND inventory_column = $4 AND tol_plus IS NULL AND tol_minus IS NULL`,
          [MID, tooling, key, col]);
        console.log(`[plug] ${tooling} ${key} rule ${r.rowCount ? 'removed' : 'absent, skip'}`);
      } else {
        const r = await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column,
              tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, is_match_dim)
           SELECT $1::int, $2::varchar, $3::varchar, $4::varchar, NULL, NULL, 2, $5::varchar, $6::text, true
           WHERE NOT EXISTS (
             SELECT 1 FROM tooling_search_rule
             WHERE machine_id = $1 AND tooling_name = $2 AND output_key = $3)`,
          [MID, tooling, key, col, label, tooling]);
        console.log(`[plug] ${tooling} ${key} -> ${col} rank-only ${r.rowCount ? 'added' : '(exists, skip)'}`);
      }
    }

    // ── PLUG(B) formula A ────────────────────────────────────────────────
    {
      const [id, oldExpr, newExpr] = PLUGB_A;
      const from = revert ? newExpr : oldExpr;
      const to = revert ? oldExpr : newExpr;
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr = $2 WHERE id = $1 AND formula_expr = $3`,
        [id, to, from]);
      console.log(`[plug] PLUG(B) formula A ${r.rowCount ? `-> ${to}` : `not at expected value, skip`}`);
    }

    if (dryRun) { console.log('[plug] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[plug] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[plug] FAILED:', e.message); process.exit(1); });
