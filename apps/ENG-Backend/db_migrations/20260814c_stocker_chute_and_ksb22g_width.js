'use strict';

/**
 * 20260814c_stocker_chute_and_ksb22g_width.js
 *
 * Closes the last RE330xx conformance gap, and parks one question the floor owns.
 *
 * ── 1. STOCKER CHUTE 4664-34 (RE33037 D §6-6) ────────────────────────────────
 * The one tooling the standards name that Tooling Select could not select. It was
 * blocked on the design rule, which is published on the tooling drawing rather than
 * in RE33037 D — the standard gives only the TYPE split. With the drawing in hand:
 *
 *     OD : Turning OD 荒径 (MAX)      ← the ROUGH / before-turning diameter, MAX
 *     W  : Width 巾 (Nominal)
 *     SD : Shoulder Dia. (Nominal)
 *
 *     A = OD + 0.5            D = 2 (SD≤6) · 4 (6<SD≤8) · 6 (8<SD≤10) · 8 (10<SD)
 *     B = W + 0.5             E = B / 2
 *     C = 22 (B≤17) · 32 (17<B≤27)          TYPE1 W≤10 · TYPE2 10<W
 *
 * `OD = 荒径 MAX` is why this resisted three earlier attempts: tested against the
 * after-grind OD the rule matches 1 of 87 rows, and against the plain before-grind
 * OD 46 of 87. Against the before-grind MAX it matches 73 of 87 — and the rules that
 * need no part data land at 79/80 (C) and 80/80 (E).
 *
 * The residual ~16 % is part-revision drift, not a wrong formula: the sheet accumulated
 * over years against specs that have since moved. That is exactly what the search
 * tolerance is for — the formula computes the target and the search finds the nearest
 * chute that exists, which is how every other tooling here already works.
 *
 * ── 2. KS-B22G width back to 5 ───────────────────────────────────────────────
 * `20260814_conform_…` set W ≥ 14 per RE33042 A §7 and that removed the machine from
 * 7,069 of the 8,255 parts it had been offered for — 6,145 of them on width alone.
 * The floor has asked for 5 back while the question is settled: either the standard is
 * behind actual practice (then RE33042 A needs revising) or the parts were never really
 * run there. The bound is restored and the description now records the open question
 * instead of pretending 5 is the standard.
 *
 * The ID bounds (φ4.8–16) stay at the standard — they were not part of the request and
 * account for 924 of the drop.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260814c_stocker_chute_and_ksb22g_width.js --dry
 *   node db_migrations/20260814c_stocker_chute_and_ksb22g_width.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const ROWS_JSON = process.argv.find((a) => a.endsWith('.json'));

const MACHINE = 'KS-400B1';       // the drawing's Machine Limit (OD φ32 MAX, W 30 MAX) is KS-400B1's
const TOOLING = 'STOCKER CHUTE';
const INV = 'tooling_ks400b';

// Straight from the drawing. `odBf_max` is the Turning OD 荒径 MAX; the `odBf > 0` guard
// is the house fallback — ~62 % of spec rows carry no before-grind OD, and without it
// those parts would compute A = 0.5 and match the smallest chute on the shelf.
const FORMULAS = [
  { key: 'A', expr: 'if(odBf > 0, odBf_max, odAft_max) + 0.5', sort: 0, desc: 'RE33037 D / 4664-34 drawing: A = Turning OD 荒径 MAX + 0.5' },
  { key: 'B', expr: 'W + 0.5',                                  sort: 1, desc: 'drawing: B = Width (nominal) + 0.5' },
  { key: 'C', expr: 'if(B <= 17, 22, 32)',                      sort: 2, desc: 'drawing: C = 22 (B≤17) / 32 (17<B≤27)' },
  { key: 'D', expr: 'if(SD <= 6, 2, if(SD <= 8, 4, if(SD <= 10, 6, 8)))', sort: 3, desc: 'drawing: D stepped on Shoulder Dia.' },
  { key: 'E', expr: 'B / 2',                                    sort: 4, desc: 'drawing: E = B / 2' },
  { key: 'T', expr: 'if(W <= 10, 1, 2)',                        sort: 5, desc: 'RE33037 D §8-6: TYPE1 W≤10, TYPE2 10<W' },
];

// A and B are the part-fit dimensions and carry the tolerance; C and D are steps that
// follow from B and SD, so they rank but must not exclude — a hard filter on a derived
// step throws away a chute that fits on the dimensions that matter.
const RULES = [
  { key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true,  prio: 0, label: 'Chute bore (OD+0.5)' },
  { key: 'B', col: 'dim_b', plus: '1.0', minus: '1.0', match: true,  prio: 1, label: 'Chute width (W+0.5)' },
  { key: 'C', col: 'dim_c', plus: null,  minus: null,  match: false, prio: 2, label: 'Body length' },
  { key: 'D', col: 'dim_d', plus: null,  minus: null,  match: false, prio: 3, label: 'Step (SD)' },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    // ── KS-B22G width ────────────────────────────────────────────────────────
    const w = await client.query(
      `UPDATE tooling_machine_limit l SET min_value = '5', min_inclusive = true, description = $1
         FROM tooling_machine m
        WHERE m.id = l.machine_id AND m.machine_name = 'KS-B22G' AND l.input_var = 'W'
          AND (l.min_value IS DISTINCT FROM '5' OR l.description IS DISTINCT FROM $1)
      RETURNING l.id`,
      ['W ≥ 5 — RESTORED at the floor\'s request while the question is open. RE33042 A §7 says W ≥ 14; enforcing it removed KS-B22G from 6,145 parts. Either the standard is behind practice (revise RE33042 A) or those parts were never run here. ID bounds remain at the standard.']
    );
    log.push(`── KS-B22G width ──\n   ${w.rowCount ? 'restored to W ≥ 5, question recorded in the description' : 'already 5'}`);

    // ── STOCKER CHUTE inventory ──────────────────────────────────────────────
    const have = await client.query(
      `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [TOOLING]);
    log.push(`\n── ${TOOLING} inventory ──`);
    if (have.rows[0].n > 0) {
      log.push(`   already present: ${have.rows[0].n} rows — left alone`);
    } else {
      const file = ROWS_JSON || path.join(__dirname, 'data', 'stocker_chute_4664-34.json');
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      // One multi-row INSERT, not a loop — 80 rows is small but the house rule is the
      // house rule, and the column order here must match the values array exactly.
      const COLS = 8;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, null, r.dim_a, r.dim_b, r.dim_c, r.dim_d, r.dim_e,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e)
         VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} rows (${rows[0].tooling_no} … ${rows[rows.length - 1].tooling_no})`);
    }

    // ── formulas ─────────────────────────────────────────────────────────────
    const mid = (await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0].id;
    log.push(`\n── formulas (${MACHINE}) ──`);
    for (const f of FORMULAS) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, f.key, f.expr, f.sort, f.desc]);
      log.push(`   ${r.rowCount ? 'added  ' : 'exists '} ${f.key} = ${f.expr}`);
    }

    // ── search rules ─────────────────────────────────────────────────────────
    log.push(`\n── search rules ──`);
    for (const s of RULES) {
      const r = await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
            sort_priority, label, inventory_tooling_filter, is_match_dim)
         SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,$10::boolean
          WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`,
        [mid, TOOLING, s.key, s.col, s.plus, s.minus, s.prio, s.label, TOOLING, s.match]);
      log.push(`   ${r.rowCount ? 'added  ' : 'exists '} ${s.key} -> ${s.col}  ${s.plus ? `±${s.plus}` : 'rank-only'}${s.match ? '' : '  (not a ranking dim)'}`);
    }

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
