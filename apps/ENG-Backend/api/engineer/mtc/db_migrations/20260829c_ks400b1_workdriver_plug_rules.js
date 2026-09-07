'use strict';

/**
 * KS-400B1 (球研) — WORK DRIVER / PLUG(A) / PLUG(B) search-rule retune.
 * ============================================================================
 * eval 2026-08-28 (formula-driven families only; the cn-mapped 4664-21/22 pairs
 * are already 99.8 %):
 *     WORK DRIVER 20.1 % / 22.4 %   PLUG(A) 16.8 % / 21.6 % (72 none)
 *     PLUG(B)     31.0 % / 37.2 %
 *
 * Offsets vs the factory plan, measure_offsets.js 2026-08-29 (n≈580–600):
 *
 *   WORK DRIVER A  `ceil05(SD-0.5)`   Δ(shelf−calc) med −0.5, p10 −1, ≤1.0 98 %
 *       rule was tol +1 / −0  →  the `dim_a ≥ calc` floor drops the whole lower
 *       half (shelf sits ~0.5 below calc). Widen tol_minus 0 → 1.0.
 *       C `if(A<13,32,36)` ≤0.2 91 % and D `if(SD<13.5,24,30)` ≤0.2 99 % have
 *       NO rule — add both as rank-only tie-breakers (43-row shelf, A alone ties).
 *
 *   PLUG(A) A  `if(idAft_min<20, idAft_min*0.7, idAft_min-4)`  Δ med −0.08,
 *       ≤0.5 92 %, but rule was a ceiling (tol +0 / −null) → the ~35 % of shelf
 *       rows just above calc are excluded. Make it symmetric ±0.3.
 *   PLUG(A) B  `SD-0.5`  Δ med −0.3, p10 −1.8, ≤0.5 55 % — a weak dim wired as a
 *       hard `dim_b ≥ calc` floor (tol_minus 0, is_match_dim false). It filters
 *       out good primary matches and never ranks. Drop the filter (tol_minus →
 *       null) — B becomes inert, as its fit warrants.
 *
 *   PLUG(B) A  `if(idAft_min<20, idAft_min-0.7, idAft_min-1)`  Δ med −0.38,
 *       ≤0.5 91 %, but rule was tol_plus **−0.3** / is_match_dim **false** — a
 *       negative ceiling that neither ranks nor filters usefully; the family
 *       ranked only on C (`wAft_min*0.9`, ≤0.5 46 %). Make A a real symmetric
 *       match+rank dim (±0.4, is_match_dim true); leave C as the rank-only
 *       tie-breaker it already is.
 *
 * All formulas are UNCHANGED — this is a search-rule tolerance/geometry fix only.
 * Idempotent; `--revert` restores every original rule.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829c_ks400b1_workdriver_plug_rules.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829c_ks400b1_workdriver_plug_rules.js
 *   node api/engineer/mtc/db_migrations/20260829c_ks400b1_workdriver_plug_rules.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// UPDATEs to existing rules: [tooling, key, fwd{tol_plus,tol_minus,is_match_dim}, back{...}]
const RULE_UPDATES = [
  ['WORK DRIVER', 'A', { tol_plus: '1', tol_minus: '1.0', is_match_dim: true },
                       { tol_plus: '1', tol_minus: '0',   is_match_dim: true }],
  ['PLUG(A)', 'A', { tol_plus: '0.3', tol_minus: '0.3', is_match_dim: true },
                   { tol_plus: '0',   tol_minus: null,  is_match_dim: true }],
  ['PLUG(A)', 'B', { tol_plus: null, tol_minus: null, is_match_dim: false },
                   { tol_plus: null, tol_minus: '0',  is_match_dim: false }],
  ['PLUG(B)', 'A', { tol_plus: '0.4',  tol_minus: '0.4', is_match_dim: true },
                   { tol_plus: '-0.3', tol_minus: null,  is_match_dim: false }],
];

// Rank-only rules to ADD for WORK DRIVER (removed again on --revert).
const RULE_ADDS = [
  { tooling: 'WORK DRIVER', key: 'C', col: 'dim_c', label: 'Driver body OD step (rank)' },
  { tooling: 'WORK DRIVER', key: 'D', col: 'dim_d', label: 'Driver length step (rank)' },
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = 'KS-400B1'`)).rows[0].id;

    for (const [tooling, key, fwd, back] of RULE_UPDATES) {
      const v = revert ? back : fwd;
      const { rowCount } = await client.query(
        `UPDATE tooling_search_rule SET tol_plus = $1, tol_minus = $2, is_match_dim = $3
          WHERE machine_id = $4 AND tooling_name = $5 AND output_key = $6`,
        [v.tol_plus, v.tol_minus, v.is_match_dim, mid, tooling, key]);
      console.log(`[ks400b1] ${tooling}.${key} -> tol(${v.tol_plus}/${v.tol_minus}) match=${v.is_match_dim}  [${rowCount}]`);
    }

    for (const a of RULE_ADDS) {
      if (revert) {
        const { rowCount } = await client.query(
          `DELETE FROM tooling_search_rule
            WHERE machine_id = $1 AND tooling_name = $2 AND output_key = $3 AND inventory_column = $4`,
          [mid, a.tooling, a.key, a.col]);
        console.log(`[ks400b1] - ${a.tooling}.${a.key} (${a.col})  [${rowCount}]`);
      } else {
        const { rowCount } = await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
              is_match_dim, inventory_tooling_filter, label)
           VALUES ($1,$2,$3,$4,NULL,NULL,TRUE,$5,$6)
           ON CONFLICT (machine_id, tooling_name, output_key) DO NOTHING`,
          [mid, a.tooling, a.key, a.col, a.tooling, a.label]);
        console.log(`[ks400b1] + ${a.tooling}.${a.key} (${a.col}) rank-only  [${rowCount}]`);
      }
    }

    if (dryRun) { console.log('[ks400b1] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[ks400b1] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[ks400b1] FAILED:', e.message); process.exit(1); });
