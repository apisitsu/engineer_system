'use strict';

/**
 * 20260814i_oc16a_collar_and_pin.js
 *
 * Adds **COLLAR** (4560-10 / 4560-11 / 4561-11, 44 rows) and **PIN** (4560-04, 3 rows)
 * to OC-16A, the centreless external grinder. The machine and its RACE PUSHER / SET PIN
 * shelves already existed; these two were the remaining gap from the RACE / SLEEVE / BALL
 * sheet audit.
 *
 * ── Where the rule came from ─────────────────────────────────────────────────
 * The COLLAR and PIN sheets carry no calculation block, which is why this was first
 * written off. The rule is in the **same workbook**, printed above the RACE PUSHER
 * sheet, and it governs every jig in the file:
 *
 *     A = OD − 0.5          OD < A ・・・×          A < OD ・・・○
 *
 * A centreless jig has to feed through the same blade-and-wheel gap as the workpiece,
 * so its outside diameter sits just under the work OD — over it and the part will not
 * pass, which is exactly what the × / ○ note says.
 *
 * ── Validated against real part numbers, not assumed ─────────────────────────
 * The COLLAR sheet's P/N columns give ground-truth pairs. Five of them resolve to rows
 * in `tooling_spec_process`, and every one satisfies `A < OD`:
 *
 *     4560-11-0062  A 11.5  part OD 11.90      4560-11-0038  A 15.8  part OD 15.91
 *     4560-11-0054  A 12.5  part OD 12.73      4560-11-0040  A 34    part OD 34.92
 *     4560-11-0039  A 14    part OD 14.29
 *
 * Against the stated target `OD − 0.5` the deviations are 0.10 / 0.27 / 0.21 / 0.39 /
 * 0.42 — **5 of 5 inside ±0.45**. The inner diameter B is *not* the fit: it misses the
 * part OD by 2.4–4.9 on the same rows, because B is the bore that clears the body, not
 * the diameter that feeds. Testing both is what settled which column carries the rule.
 *
 * Only 5 of 47 P/Ns resolve, so this is a small sample. It is accepted because the rule
 * is *written down* for a sibling tooling on the same machine in the same file — the
 * sample corroborates a stated rule rather than standing in for one.
 *
 * ── What ships, and what does not ────────────────────────────────────────────
 * **`A` alone carries the tolerance.** B (bore), C (length) and the counterbore D/E rank
 * but never exclude — a collar that feeds correctly should not be discarded over a bore
 * that clears the body by a different margin.
 *
 * **`tol_plus` is 0.45, not 0.5.** At 0.5 the search would admit `A = OD` exactly, and
 * the sheet's own note calls that the × case. Staying a hair under keeps the boundary
 * on the correct side.
 *
 * **21 COLLAR rows are skipped** and always will be: 4560-11-0001…0022 carry the note
 * 詳細不明（図面が見つからない）— drawing lost — and 0024 is 未設計, not yet designed.
 * They have no dimensions to store. The five 押さえ棒 rows on the PIN sheet (4560-04-0001
 * …0005) are blank for the same reason, so PIN ships with the 3 rows that have data.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260814i_oc16a_collar_and_pin.js --dry
 *   node api/engineer/mtc/db_migrations/20260814i_oc16a_collar_and_pin.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'OC-16A';
const INV = 'tooling_oc16a';

// Shared by both tooling — the note is printed once, above RACE PUSHER, for the file.
const RULE_DESC =
  'CENTERLESS-GRINDING-JIG workbook, RACE PUSHER sheet header: A = OD − 0.5, with ' +
  'OD < A marked × and A < OD marked ○. Validated on 5 P/N pairs, all within ±0.45.';

const SPEC = {
  COLLAR: {
    // Ranked columns follow the sheet: B 内径(ID), C 長さ, D ザグリ径, E ザグリ深さ.
    rules: [
      { key: 'A', col: 'dim_a', plus: '0.45', minus: '1.0', match: true,  prio: 0, label: 'Collar OD (work OD − 0.5)' },
      { key: 'B', col: 'dim_b', plus: null,   minus: null,  match: false, prio: 1, label: 'Collar bore' },
      { key: 'C', col: 'dim_c', plus: null,   minus: null,  match: false, prio: 2, label: 'Collar length' },
    ],
  },
  PIN: {
    rules: [
      { key: 'A', col: 'dim_a', plus: '0.45', minus: '1.0', match: true,  prio: 0, label: 'Pin OD (work OD − 0.5)' },
      { key: 'B', col: 'dim_b', plus: null,   minus: null,  match: false, prio: 1, label: 'Pin length' },
    ],
  },
};

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0].id;
    log.push(`── ${MACHINE} (machine id ${mid}) ──`);

    const data = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'data', 'oc16a_collar_pin_4560.json'), 'utf8'));

    for (const [tooling, rows] of Object.entries(data)) {
      const have = (await client.query(
        `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [tooling])).rows[0].n;
      log.push(`\n── ${tooling} ──`);
      if (have > 0) {
        log.push(`   inventory: already ${have} rows — left alone`);
      } else {
        // Column order below must match the values array exactly — a mismatch does not raise.
        const COLS = 7;
        const ph = rows.map((_, i) =>
          `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
        const vals = rows.flatMap((r) => [
          tooling, r.tooling_no,
          r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null, r.dim_d ?? null, r.dim_e ?? null,
        ]);
        await client.query(
          `INSERT INTO ${INV} (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d, dim_e)
           VALUES ${ph}`, vals);
        log.push(`   inventory: inserted ${rows.length} rows ` +
                 `(A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
      }

      const f = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,'A'::text,$3::text,0,$4::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key='A')
         RETURNING id`, [mid, tooling, 'OD - 0.5', RULE_DESC]);
      log.push(`   formula ${f.rowCount ? 'added ' : 'exists'}  A = OD - 0.5`);

      for (const q of SPEC[tooling].rules) {
        const r = await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
              sort_priority, label, inventory_tooling_filter, is_match_dim)
           SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,$10::boolean
            WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`,
          [mid, tooling, q.key, q.col, q.plus, q.minus, q.prio, q.label, tooling, q.match]);
        log.push(`   rule    ${r.rowCount ? 'added ' : 'exists'}  ${q.key} -> ${q.col}  ` +
                 `${q.plus ? `+${q.plus} / -${q.minus}` : 'rank-only'}`);
      }
    }

    // B and C on COLLAR only rank, so they need a formula row to exist at all — without
    // one the search has no value to rank against and silently drops the column.
    log.push('\n── COLLAR ranking inputs ──');
    for (const [key, expr, desc] of [
      ['B', 'OD - 3', 'Nominal bore, ranking only — the sheet gives no rule for B; the shelf sits 2.4–4.9 under the work OD.'],
      ['C', 'W', 'Nominal length, ranking only — no rule on the sheet.'],
    ]) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,'COLLAR'::text,$2::text,$3::text,$4::int,$5::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name='COLLAR' AND output_key=$2)
         RETURNING id`, [mid, key, expr, key === 'B' ? 1 : 2, desc]);
      log.push(`   formula ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr}`);
    }
    const pb = await client.query(
      `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
       SELECT $1,'PIN'::text,'B'::text,'30'::text,1,$2::text
        WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                           WHERE machine_id=$1 AND tooling_name='PIN' AND output_key='B')
       RETURNING id`, [mid, 'Pin length — every pin on the shelf is 30, ranking only.']);
    log.push(`   formula ${pb.rowCount ? 'added ' : 'exists'}  PIN B = 30`);

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
