'use strict';

/**
 * 20260814h_kn113a_ball_inner_grind.js
 *
 * Adds **KN-113A** (和泉金属 / IZUMI ball inner-grinding, process 1181, drawing family
 * 4853) — one of the machines the RACE / SLEEVE / BALL sheet audit found missing from
 * Tooling Select entirely.
 *
 * ── Where the rules came from ────────────────────────────────────────────────
 * `4853_KN-113Aボール内研用.xls`, from the live Excel formulas in each sheet's
 * 加工対象物寸法記入欄 block — the same provenance as X-100 ARBOR and STOCKER CHUTE,
 * and the only kind this project accepts. Nothing here is inferred from the tooling
 * list; the 適用型式 columns beside each row are model labels and drive nothing.
 *
 *   WHEEL (4853-14)  from ワーク内径MIN and ワーク巾
 *       a = ROUND(ID_min × 0.75, 1)
 *       A = ROUNDDOWN(a, 0) + (MOD(a×10, 5) > 2.5 ? 0.5 : 0)     ← wheel dia
 *       B = A − 5                       D = B + 1
 *       c = ROUND(W × 0.7, 1)
 *       C = ROUND(c, 0) + (ROUNDUP(c,0) − c > 0.5 ? 0.5 : 0)     ← wheel width
 *       E = C + 21                      F = (D − 4 > 8) ? 8 : 6
 *
 *   BACK PLATE (4853-16)   A = ROUND(ワーク内径MAX + 0.6, 1)
 *
 *   JAW (4853-15)          A = ROUND(OD tolerance centre, 3)
 *                          B = A − 0.3
 *
 * ── What ships, and what does not ────────────────────────────────────────────
 * **JAW C is omitted.** The sheet computes it as ROUND(18.5 + 0.6 × OD, 1) stepped
 * down to the nearest 0.5, but the shelf does not follow that at all — C runs
 * 39·34·32.5·32·30·28 against A 47.75→25.12 and then rises again at the bottom, so it
 * is not monotonic in A and cannot be the same quantity the formula computes. Storing
 * it without a rule keeps the value visible and keeps the guess out of the search.
 *
 * **QUILL (4853-05) is not implemented.** Its whole block reads dimensions out of the
 * WHEEL sheet (`='WHEEL(4853-14)'!B34` etc.) rather than from the part, and the sheet
 * carries no 図番 rows at all — there is no shelf to search. It is a dependent item
 * chosen once the wheel is chosen, not a dimensional selection.
 *
 * ── Confidence ───────────────────────────────────────────────────────────────
 * On the three wheels that exist, E = C + 21 reproduces 3/3 and D = B + 1 reproduces
 * 2/3; 4853-14-0003 reproduces on every one of A/B/C/D/E/F. The two that miss are off
 * by 1 on B — the familiar reuse drift, and neither B nor D carries a search rule.
 * The searched dims are A (from ID) and C (from W), which are the two the block is
 * actually written to produce.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260814h_kn113a_ball_inner_grind.js --dry
 *   node db_migrations/20260814h_kn113a_ball_inner_grind.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'KN-113A';
const INV = 'tooling_kn113a';

// `a` and `c` are the sheet's intermediate cells. expr-eval has no local bindings, so
// each one is written out in full rather than leaked into the context as a fake output
// key — a formula row is user-visible, and 'a' is not a dimension on the drawing.
const A_RAW = 'roundN(idAft_min * 0.75, 1)';
const C_RAW = 'roundN(W * 0.7, 1)';

const SPEC = {
  WHEEL: {
    formulas: [
      { key: 'A', expr: `floorN(${A_RAW}, 0) + if((${A_RAW} * 10) % 5 > 2.5, 0.5, 0)`,
        desc: 'WHEEL(4853-14) B28: A = ROUNDDOWN(ROUND(ID_min×0.75,1),0) + 0.5 when the tenths digit is over .25' },
      { key: 'B', expr: 'A - 5',  desc: 'WHEEL(4853-14) B29: B = A − 5' },
      { key: 'C', expr: `roundN(${C_RAW}, 0) + if(ceilN(${C_RAW}, 0) - ${C_RAW} > 0.5, 0.5, 0)`,
        desc: 'WHEEL(4853-14) B33: C = ROUND(ROUND(W×0.7,1),0) stepped up 0.5 when the round-up gap exceeds .5' },
      { key: 'D', expr: 'B + 1', desc: 'WHEEL(4853-14) B34: D = B + 1' },
      { key: 'E', expr: 'C + 21', desc: 'WHEEL(4853-14) B35: E = C + 18 + 3' },
      { key: 'F', expr: 'if(D - 4 > 8, 8, 6)', desc: 'WHEEL(4853-14) B36: F = 8 when D−4 > 8, else 6' },
    ],
    // A is the wheel diameter that has to enter the bore and C is the width that has to
    // clear the race — those two are the fit. B/D/E/F all follow from them, so they are
    // stored and displayed but must not exclude a wheel that fits.
    rules: [
      { key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true,  prio: 0, label: 'Wheel dia (ID_min×0.75)' },
      { key: 'C', col: 'dim_c', plus: '2.0', minus: '2.0', match: true,  prio: 1, label: 'Wheel width (W×0.7)' },
      { key: 'D', col: 'dim_d', plus: null,  minus: null,  match: false, prio: 2, label: 'Shank dia' },
      { key: 'E', col: 'dim_e', plus: null,  minus: null,  match: false, prio: 3, label: 'Overall length' },
    ],
  },
  'BACK PLATE': {
    formulas: [
      { key: 'A', expr: 'roundN(idAft_max + 0.6, 1)',
        desc: 'BACK PLATE(4853-16) B24: A = ROUND(ワーク内径MAX + 0.6, 1)' },
    ],
    rules: [
      { key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true, prio: 0, label: 'Plate bore (ID_max+0.6)' },
    ],
  },
  JAW: {
    formulas: [
      { key: 'A', expr: 'roundN((odAft_max + odAft_min) / 2, 3)',
        desc: 'JAW(4853-15) B25: A = ROUND(work OD tolerance centre, 3)' },
      { key: 'B', expr: 'roundN(A - 0.3, 3)', desc: 'JAW(4853-15) B26: B = A − 0.3' },
    ],
    // B is A shifted by a constant, so filtering on both would narrow nothing and would
    // throw away the older rows whose gap is 0.32 rather than 0.30.
    rules: [
      { key: 'A', col: 'dim_a', plus: '0.5', minus: '0.5', match: true,  prio: 0, label: 'Jaw grip dia (OD centre)' },
      { key: 'B', col: 'dim_b', plus: null,  minus: null,  match: false, prio: 1, label: 'Jaw relief dia' },
    ],
  },
};

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${INV} (
        id            SERIAL PRIMARY KEY,
        tooling_name  TEXT NOT NULL,
        tooling_no    TEXT NOT NULL,
        machine       TEXT,
        dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC,
        dim_d NUMERIC, dim_e NUMERIC, dim_f NUMERIC
      )`);
    log.push(`── inventory ──\n   ${INV} ensured`);

    const data = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'data', 'kn113a_4853.json'), 'utf8'));

    for (const [tooling, rows] of Object.entries(data)) {
      const have = (await client.query(
        `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [tooling])).rows[0].n;
      if (have > 0) { log.push(`   ${tooling}: already ${have} rows — left alone`); continue; }
      // One multi-row INSERT; the column order below must match the values array exactly.
      const COLS = 8;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        tooling, r.tooling_no, MACHINE,
        r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null, r.dim_d ?? null, r.dim_e ?? null,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e)
         VALUES ${ph}`, vals);
      log.push(`   ${tooling}: inserted ${rows.length} rows (${rows[0].tooling_no} …)`);
    }

    // ── machine ──────────────────────────────────────────────────────────────
    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$1,$2,true) RETURNING id`, [MACHINE, INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) → ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    for (const [tooling, s] of Object.entries(SPEC)) {
      log.push(`\n── ${tooling} ──`);
      for (const [i, f] of s.formulas.entries()) {
        const r = await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, tooling, f.key, f.expr, i, f.desc]);
        log.push(`   formula ${r.rowCount ? 'added ' : 'exists'}  ${f.key} = ${f.expr.slice(0, 64)}`);
      }
      for (const q of s.rules) {
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
                 `${q.plus ? `±${q.plus}` : 'rank-only'}`);
      }
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
