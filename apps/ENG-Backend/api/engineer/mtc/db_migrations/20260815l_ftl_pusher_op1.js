'use strict';

/**
 * 20260815l_ftl_pusher_op1.js
 *
 * >>> SUPERSEDED: `20260815n_` WITHDRAWS the selection this migration adds. <<<
 * >>> Against the factory plan this rule is right 2 % of the time. Run both, in order — <<<
 * >>> this one still seeds the 63 inventory rows, which are real and which `n` keeps.  <<<
 * >>> Read `20260815n_`'s header before reinstating anything here.                     <<<
 *
 * Adds **FTL PUSHER OP1** (4501-02, 63 rows) — the family that `20260815h_` recorded as
 * blocked on SD1/SD2, both of which now reach the formula engine (`20260815j_` synced the
 * stored Y-ball shoulder; SD2 is geometry off dimensions already there).
 *
 * `4501-02` is the single most-used tooling family of process 2071 — 1,664 plan rows,
 * ahead of 4501-01's 1,619 and X-100's arbor at 1,070.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * `20231122_…_FTL_TOOLING_LIST.xlsx`, sheet `PUSHER OP1`:
 *
 *     A7 = IF(WORK TYPE = "Y", SD1, SD2)          ← the whole selection key
 *     A8 = MIN(IF(A12:A182 >= A7, A12:A182))      ← smallest shelf A at or above it
 *     E7 = IF(A8 <= 10, 6, 8)                     ← shaft dia, follows from the row
 *     H7 = IF(COLLET TYPE = 1, 90, 100)           ← overall length, likewise
 *
 * The 適合表 states the same key in words — the pusher's 適用範囲 column reads
 * `Φ8＜BALL肩径≦Φ13` / `Φ13＜BALL肩径≦Φ28` / `Φ25＜BALL肩径≦30`. A pusher is chosen by
 * the ball's shoulder and nothing else, which is why this family could not be approximated
 * from any dimension the spec table already had.
 *
 * ── Why the key is a branch and not a column ─────────────────────────────────
 * ボール肩径 is stored for a Y-ball and computed for a normal one, and each sheet fills
 * exactly one of its two columns per row:
 *
 *     SD1  drawing value   lpb.eng_ball.shoulder_dia   62 % exact / 95 % within 0.1 (n=21)
 *     SD2  =ROUND(SQRT(BD^2-BW^2),2)                   86 % exact / 96 % within 0.1 (n=382)
 *
 * so `if(isYBall == 1, SD1, SD2)` is the sheet's own IF, not an approximation of it.
 * `isYBall` is the spec's `yball` column alone — deliberately NOT `isBallInner`, which
 * also takes an INNER type and would send normal balls down the SD1 branch, where they
 * have no value at all.
 *
 * ── The sentinel, and why it is 999999 and not -999 ──────────────────────────
 * The shelf lookup is a ceiling (`tol_minus = 0` → `dim_a >= A`), so an absent dimension
 * of 0 would match the whole shelf rather than none of it — the failure `20260815k_` just
 * fixed on COLLET OP1. A part with neither shoulder computes 999999 instead, which is
 * above the largest pusher on the shelf (A = 30) and therefore unmatchable.
 *
 * ── Only A filters ───────────────────────────────────────────────────────────
 * D is the COLLET TYPE the pusher must pair with. It is a real constraint, but a second
 * hard filter over a 63-row shelf is exactly what took X-100 ARBOR from 4-of-4 to 1-of-5,
 * so it ranks rather than excludes — and it earns its place there, because eight A values
 * repeat on this shelf and A alone would leave the tie to row order.
 *
 * **The sheet's own C dimension gets no formula at all.** It is
 * `'COLLET OP1'!F4 + F4 - G4` — the pusher nose read off whichever collet was chosen — so
 * it cannot be computed before the collet is. Nothing else on the shelf reproduces it
 * (`dim_a` 3.8/6/8 against `dim_b` 4/4.5/5 is not a ratio), and a stand-in that reproduces
 * nothing is worse than an absent column: it would be shown to a reader as a design value.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815l_ftl_pusher_op1.js --dry
 *   node api/engineer/mtc/db_migrations/20260815l_ftl_pusher_op1.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FTL-10(I)';
const INV = 'tooling_ftl10';
const TOOLING = 'PUSHER OP1';
const PROCESS = ['2071', '2031'];

// The sheet's A7, wrapped in the ceiling-safe sentinel described above.
const SHOULDER = 'if(isYBall == 1, SD1, SD2)';
const A_EXPR = `if(${SHOULDER} > 0, ${SHOULDER}, 999999)`;

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0]?.id;
    if (!mid) throw new Error(`${MACHINE} not in tooling_machine — run 20260815h_ first`);

    const have = (await client.query(
      `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [TOOLING])).rows[0].n;
    if (have > 0) {
      log.push(`── inventory ──\n   ${TOOLING}: already ${have} rows — left alone`);
    } else {
      const rows = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'data', 'ftl_pusher_4501-02.json'), 'utf8'))[TOOLING];
      // Column order below must match the values array exactly — a mismatch does not raise.
      const COLS = 8;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, MACHINE,
        r.dim_a, r.dim_b ?? null, r.dim_c ?? null, r.dim_d ?? null, r.dim_e ?? null,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e)
         VALUES ${ph}`, vals);
      log.push(`── inventory ──\n   inserted ${rows.length} rows ` +
               `(A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
    }

    log.push('\n── formulas ──');
    for (const [key, expr, sort, desc] of [
      ['A', A_EXPR, 0,
        'PUSHER OP1 sheet A7 = IF(WORK TYPE="Y", SD1, SD2) — the ball shoulder diameter, and ' +
        'the pusher\'s only selection key (the 適合表 states it as 適用範囲 Φ8<BALL肩径≦Φ13 etc). ' +
        'SD1 is lpb.eng_ball.shoulder_dia (Y-balls, 245 rows); SD2 is sqrt(BD^2-BW^2) for normal ' +
        'balls. The 999999 guard is not in the sheet — the search rule is a ceiling (dim_a >= A), ' +
        'so a part with neither shoulder would compute 0 and match the whole shelf.'],
      ['D', 'if(raceOd > 30, 2, 1)', 2,
        'COLLET TYPE the pusher must pair with — コレット設計時のサイズ区分 puts OP1 TYPE 2 ' +
        '(先端径Φ56) above レース単体外径MAX 30 and TYPE 1 (Φ38) below it. A real constraint, ' +
        'but it ranks rather than filters: a second hard filter on a 63-row shelf is what took ' +
        'X-100 ARBOR from 4-of-4 to 1-of-5.'],
      ['E', 'if(if(isYBall == 1, SD1, SD2) <= 10, 6, 8)', 3,
        'PUSHER OP1 sheet E7 = IF(A <= 10, 6, 8) — shaft diameter, and with it the screw ' +
        '(M6x1.0 / M8x1.25). Reported for the drawing; no search rule.'],
    ]) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, key, expr, sort, desc]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr}`);
    }

    log.push('\n── search rules ──');
    for (const [key, col, plus, minus, prio, label, match] of [
      ['A', 'dim_a', null, '0', 0, 'Pusher bore — smallest at or above the ball shoulder', true],
      // Eight A values repeat on this shelf, so A alone leaves ties. TYPE is the only
      // other quantity that is genuinely computable here, and it breaks them correctly.
      ['D', 'dim_d', null, null, 2, 'Collet TYPE it pairs with — tie-breaker on equal A', true],
    ]) {
      const r = await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
            sort_priority, label, inventory_tooling_filter, is_match_dim)
         SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$2::text,$9::boolean
          WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, key, col, plus, minus, prio, label, match]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} -> ${col}  ` +
               `${minus !== null ? '>= computed' : 'rank-only'}`);
    }

    log.push('\n── sds_machine_tool ──');
    const typeId = (await client.query(
      `SELECT id FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
      [MACHINE])).rows[0]?.id ?? null;
    let added = 0;
    for (const pc of PROCESS) {
      added += (await client.query(
        `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
         SELECT 'T2',$1::text,$2::text,'4501-02'::text,$3::int
          WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                             WHERE process_code=$1 AND machine_type=$2 AND tool_drawing_no='4501-02')
         RETURNING id`, [pc, MACHINE, typeId])).rowCount;
    }
    log.push(`   proc ${PROCESS.join('/')} · 4501-02 · type_id ${typeId ?? '-'} → ${added} new`);

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
