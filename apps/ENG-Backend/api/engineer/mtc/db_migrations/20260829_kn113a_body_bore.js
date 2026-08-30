'use strict';

/**
 * KN-113A (和泉 4853 body inner-grind) — fix the eval 0.6 % top-2 collapse.
 * ============================================================================
 * eval_tooling_accuracy.js (2026-08-28, 5 508-CN run) scored KN-113A at
 * **0.6 % top-2** — BACKING PLATE 0/68, GAUGE 0/95. Root cause, found 2026-08-29:
 *
 *   • KN-113A's 4853-01 / 4853-07 / 4853-14 families run almost entirely on
 *     BODY-class parts (C11/C12/C19 — 99 % of the planned C/N population).
 *   • Body C/Ns are in `tooling_spec_process` but with **od_aft = id_aft = w_aft = 0**.
 *     The sync-new body branch fills `final_id`, `blank_head`, `head_width` … but
 *     never id_aft, because a body has no race-style OD/ID/W table.
 *   • BACKING PLATE / GAUGE formulas are `A = OD`  →  A = 0  →  the ±0.5 window is
 *     [-0.5, 0.5], nothing on a 13–51 mm shelf matches. Total miss.
 *
 * What the shelf actually keys on (scored against the factory plan, n=64/91):
 *
 *     BACKING PLATE  dim_a ≈ final_id + [0.08 .. 1.8]   med +0.78   (0 % negative)
 *     GAUGE          dim_a ≈ final_id + [0.08 .. 0.94]  med +0.78   (0 % negative)
 *     WHEEL          dim_a ≈ 0.75 · final_id            (existing formula, once ID>0)
 *
 * `final_id` IS the body's finished bore — the dimension KN-113A inner-grinds — so
 * it is legitimately the part's after-grind ID. The migration:
 *
 *   1. DATA — `id_aft = final_id` for the 1 065 body C/Ns that have final_id and
 *      id_aft = 0. Scoped by `final_id > 0` (no non-body row carries final_id) and
 *      `id_aft = 0` (no body row carries a real id_aft), so it is exact and
 *      reversible. id_aft_max/min deltas stay 0 (eng_body has no bore tolerance).
 *
 *   2. CONFIG — KN-113A BACKING PLATE + GAUGE:
 *        A : `OD`      → `roundN(ID + 0.8, 1)`   (centres on the measured offset)
 *        B : `OD + 5`  → `ID + 5`                (BACKING PLATE, rank-only)
 *      search-rule tolerances on A widened to bracket the one-sided offset:
 *        BACKING PLATE A  tol_plus 0.5→1.1  tol_minus 0.5→0.9
 *        GAUGE         A  tol_plus 0.5→0.3  tol_minus 0.5→0.9
 *
 * WHEEL / JAW (4853-06/15/16) formulas are unchanged — WHEEL already reads
 * idAft_min and simply starts working once id_aft is non-zero.
 *
 * Idempotent; `--revert` restores id_aft = 0 on the touched body rows and the
 * original OD formulas / ±0.5 tolerances.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829_kn113a_body_bore.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829_kn113a_body_bore.js
 *   node api/engineer/mtc/db_migrations/20260829_kn113a_body_bore.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const BODY_CLASS = `(left(cn,2) BETWEEN '11' AND '19' OR left(cn,2) BETWEEN '51' AND '59')`;

// [tooling, output_key, forward_expr, back_expr]
const FORMULAS = [
  ['BACKING PLATE', 'A', 'roundN(ID + 0.8, 1)', 'OD'],
  ['BACKING PLATE', 'B', 'ID + 5', 'OD + 5'],
  ['GAUGE', 'A', 'roundN(ID + 0.8, 1)', 'OD'],
];
// [tooling, output_key, fwd_plus, fwd_minus, back_plus, back_minus]
const RULES = [
  ['BACKING PLATE', 'A', '1.1', '0.9', '0.5', '0.5'],
  ['GAUGE', 'A', '0.3', '0.9', '0.5', '0.5'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = 'KN-113A'`)).rows[0].id;

    // ── 1. DATA ────────────────────────────────────────────────────────────
    if (!revert) {
      const { rowCount } = await client.query(
        `UPDATE tooling_spec_process SET id_aft = final_id
          WHERE ${BODY_CLASS} AND COALESCE(final_id,0) > 0 AND COALESCE(id_aft,0) = 0`);
      console.log(`[kn113a] data: id_aft <- final_id on ${rowCount} body rows`);
    } else {
      const { rowCount } = await client.query(
        `UPDATE tooling_spec_process SET id_aft = 0
          WHERE ${BODY_CLASS} AND COALESCE(final_id,0) > 0 AND id_aft = final_id`);
      console.log(`[kn113a] revert data: id_aft -> 0 on ${rowCount} body rows`);
    }

    // ── 2. CONFIG: formulas ───────────────────────────────────────────────
    for (const [tooling, key, fwd, back] of FORMULAS) {
      const to = revert ? back : fwd;
      const from = revert ? fwd : back;
      const { rows: cur } = await client.query(
        `SELECT id, formula_expr FROM tooling_formula
          WHERE machine_id = $1 AND tooling_name = $2 AND output_key = $3`, [mid, tooling, key]);
      if (!cur.length) { console.log(`[kn113a] formula ${tooling}.${key} missing — skip`); continue; }
      if (cur[0].formula_expr === to) { console.log(`[kn113a] formula ${tooling}.${key} already "${to}"`); continue; }
      if (cur[0].formula_expr !== from)
        throw new Error(`${tooling}.${key} unexpected "${cur[0].formula_expr}" (want "${from}")`);
      await client.query(
        `UPDATE tooling_formula SET formula_expr = $1, updated_at = NOW() WHERE id = $2`, [to, cur[0].id]);
      console.log(`[kn113a] formula ${tooling}.${key}: "${from}" -> "${to}"`);
    }

    // ── 2. CONFIG: search-rule tolerances ─────────────────────────────────
    for (const [tooling, key, fp, fm, bp, bm] of RULES) {
      const [tp, tm] = revert ? [bp, bm] : [fp, fm];
      const { rowCount } = await client.query(
        `UPDATE tooling_search_rule SET tol_plus = $1, tol_minus = $2
          WHERE machine_id = $3 AND tooling_name = $4 AND output_key = $5`,
        [tp, tm, mid, tooling, key]);
      console.log(`[kn113a] rule ${tooling}.${key}: tol ±(${tp}/${tm})  [${rowCount} row]`);
    }

    if (dryRun) { console.log('[kn113a] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[kn113a] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[kn113a] FAILED:', e.message); process.exit(1); });
