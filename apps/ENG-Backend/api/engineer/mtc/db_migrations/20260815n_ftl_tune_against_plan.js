'use strict';

/**
 * 20260815n_ftl_tune_against_plan.js
 *
 * Corrects the FTL 4501 set against a live answer key, and **withdraws PUSHER OP1**.
 *
 * `lpb.eng_r_pi_tool` records the tooling the shop actually plans per C/N. Joined on
 * `process_plan_no` (the prefixed C/N) it yields 938 C/Ns carrying a 4501-01 or 4501-02,
 * 691 of which are in `tooling_spec_process` — a real answer key, of the kind
 * `.claude/rules/tooling-select.md` asks every machine seed to build. Measuring
 * `planned dim_a - computed A` over ~280 planned tools per family says plainly what each
 * shelf lookup is:
 *
 *     COLLET OP1   median  0.00   p10 -0.05  p90 +0.01    ceiling, but 24 % land just under
 *     COLLET OP2   median  0.00   p10 -0.05  p90 +0.01    same
 *     PUSHER OP2   median -0.15   p10 -0.24  p90 -0.07    97 % at or BELOW the computed A
 *     PUSHER OP1   median +4.75   p10 +1.53  p90 +9.61    tracks nothing
 *
 * ── PUSHER OP2 was keyed 0.15 too high ──────────────────────────────────────
 * Its offset is not noise: it is exactly the turning allowance `20260815m_` added. The
 * collet grips around the work and is built to the cutting OD at MAX, so `sphCutOd_max`
 * lands it dead-on. The pusher pushes on the face and is built to the SPH's own OD. Same
 * evidence, opposite conclusion for the two tools — which is why the number had to be
 * measured per family rather than shared. A is now `sphOd` with a ±0.5 nearest match
 * (93 % of planned pushers sit within 0.5 of it), and its sentinel flips from 999999 to
 * -999 with it: a BETWEEN fails closed on an absurd low value, a ceiling on an absurd
 * high one.
 *
 * ── The collets get 0.1 of slack ────────────────────────────────────────────
 * `MIN(IF(A >= A7))` is genuinely what the sheet does, so the ceiling stays. But a
 * quarter of the planned collets sit 0.01–0.05 below the computed value — spec revisions
 * that moved after the collet was made — and a hard `>= computed` throws those away for a
 * hundredth of a millimetre. `tol_minus = 0.1` keeps the ceiling's shape and lets the
 * ranking reach them.
 *
 * ── PUSHER OP1 is withdrawn ─────────────────────────────────────────────────
 * `20260815l_` shipped it as the sheet states it — `A7 = IF(WORK TYPE="Y", SD1, SD2)`,
 * ceiling — and against the plan it is right **2 %** of the time. This is not a tolerance
 * that needs widening: seventeen candidate quantities were scored against the 659 planned
 * OP1 pushers and the best of them (TB) puts only 25 % within 0.5 mm of its own median.
 * Even the 適合表's coarser claim fails — deriving the pusher's TYPE band from the ball
 * shoulder (`≤13 → 1`, `≤28 → 2`, else 3) agrees with the planned pusher's own TYPE on
 * 62 %, and errs high 215 times.
 *
 * The workbook says why, at the top of every sheet: 設計計算のみ有効・結果はACCESSに入力の事
 * — "only the design calculation is valid; the result goes into ACCESS". For OP1 the
 * sheet is a calculator for designing a NEW pusher, and the shop's choice among existing
 * ones lives somewhere this system cannot see. The 63 shelf rows stay in `tooling_ftl10`
 * (they are real, and PUSHER OP2 needs the table anyway); only the formulas and search
 * rules go, so the family reports nothing instead of reporting the wrong thing.
 *
 * SD1/SD2 are not wasted by that: they are what made the disproof possible, and PUSHER
 * OP2 — the larger family — ships on the same sync.
 *
 * ── One cosmetic guard ──────────────────────────────────────────────────────
 * COLLET OP2's B reads A, so on a part with no SPH it renders the 999999 sentinel as
 * `B = -26167`. The tooling correctly returns nothing either way, but a reader looking at
 * the computed dimensions should not be shown a number that looks like a broken formula.
 * B is gated on `sphOd` so it reports 0, the house absent-dimension value.
 *
 * Idempotent. Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815n_ftl_tune_against_plan.js --dry
 *   node api/engineer/mtc/db_migrations/20260815n_ftl_tune_against_plan.js
 */

const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FTL-10(I)';

const PUSHER_OP2_A =
  'if(sphOd > 0, sphOd, -999)';
const PUSHER_OP2_A_DESC =
  'PUSHER OP2 sheet B7 = OD. The sheet states OD as the SPH cutting diameter at MAX, but ' +
  'measured against 284 planned pushers the shelf tracks sph_od itself — median offset ' +
  '-0.15, which is precisely the turning allowance COLLET OP2 needs and this does not. ' +
  'A pusher bears on the face, a collet grips the turned diameter. Nearest match +/-0.5 ' +
  '(93% of planned pushers land inside it). -999 is the fail-closed sentinel for a ' +
  'BETWEEN rule; a part with no SPH matches nothing.';

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0]?.id;
    if (!mid) throw new Error(`${MACHINE} not in tooling_machine — run 20260815h_ first`);

    // ── 1. PUSHER OP2: re-key onto sphOd with a two-sided tolerance ──────────
    log.push('── PUSHER OP2 ──');
    const f = await client.query(
      `UPDATE tooling_formula SET formula_expr = $1, description = $2
        WHERE machine_id = $3 AND tooling_name = 'PUSHER OP2' AND output_key = 'A'
          AND formula_expr IS DISTINCT FROM $1
      RETURNING id`, [PUSHER_OP2_A, PUSHER_OP2_A_DESC, mid]);
    log.push(`   A formula ${f.rowCount ? `-> ${PUSHER_OP2_A}` : 'already correct'}`);

    const r = await client.query(
      `UPDATE tooling_search_rule
          SET tol_plus = 0.5, tol_minus = 0.5,
              label = 'Pusher face — nearest to the SPH OD (+/-0.5)'
        WHERE machine_id = $1 AND tooling_name = 'PUSHER OP2' AND output_key = 'A'
          AND (tol_plus IS DISTINCT FROM 0.5 OR tol_minus IS DISTINCT FROM 0.5)
      RETURNING id`, [mid]);
    log.push(`   A rule ${r.rowCount ? '-> BETWEEN computed +/- 0.5' : 'already correct'}`);

    // ── 2. COLLET OP1 / OP2: keep the ceiling, allow 0.1 of drift ────────────
    log.push('\n── COLLET OP1 / OP2 ──');
    for (const tooling of ['COLLET OP1', 'COLLET OP2']) {
      const c = await client.query(
        `UPDATE tooling_search_rule
            SET tol_minus = 0.1,
                label = 'Collet bore — smallest at or above the computed value (0.1 of drift allowed)'
          WHERE machine_id = $1 AND tooling_name = $2 AND output_key = 'A'
            AND tol_minus IS DISTINCT FROM 0.1
        RETURNING id`, [mid, tooling]);
      log.push(`   ${tooling} A ${c.rowCount ? '-> col >= computed - 0.1' : 'already correct'}`);
    }

    // ── 3. COLLET OP2 B: don't render the sentinel as a dimension ────────────
    const PW = 'if(sphWidth < 6, 2.1, if(sphWidth < 10, 1.9, 1.7))';
    const COLLET_OP2_B =
      `if(sphOd > 0, ballWidth / 2 - sphCutOd_max / 2 * 0.05234 + ${PW}, 0)`;
    const b = await client.query(
      `UPDATE tooling_formula SET formula_expr = $1
        WHERE machine_id = $2 AND tooling_name = 'COLLET OP2' AND output_key = 'B'
          AND formula_expr IS DISTINCT FROM $1
      RETURNING id`, [COLLET_OP2_B, mid]);
    log.push(`\n── COLLET OP2 B ──\n   ${b.rowCount ? 'gated on sphOd (was rendering the 999999 sentinel as -26167)' : 'already correct'}`);

    // ── 4. PUSHER OP1: withdraw the rules, keep the shelf ────────────────────
    log.push('\n── PUSHER OP1 (withdrawn) ──');
    const dr = await client.query(
      `DELETE FROM tooling_search_rule
        WHERE machine_id = $1 AND tooling_name = 'PUSHER OP1' RETURNING id`, [mid]);
    const df = await client.query(
      `DELETE FROM tooling_formula
        WHERE machine_id = $1 AND tooling_name = 'PUSHER OP1' RETURNING id`, [mid]);
    const kept = (await client.query(
      `SELECT count(*)::int n FROM tooling_ftl10 WHERE tooling_name = 'PUSHER OP1'`)).rows[0].n;
    log.push(`   removed ${dr.rowCount} search rules, ${df.rowCount} formulas`);
    log.push(`   kept ${kept} inventory rows — the shelf is real, only the selection was not`);

    // sds_machine_tool keeps its 4501-02 row: PUSHER OP2 still ships it.
    const sds = (await client.query(
      `SELECT count(*)::int n FROM sds_machine_tool
        WHERE machine_type = $1 AND tool_drawing_no = '4501-02'`, [MACHINE])).rows[0].n;
    log.push(`   sds_machine_tool 4501-02 rows left in place: ${sds} (PUSHER OP2 still ships it)`);

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
    console.log(log.join('\n'));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

run();
