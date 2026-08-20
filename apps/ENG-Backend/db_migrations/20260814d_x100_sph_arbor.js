'use strict';

/**
 * 20260814d_x100_sph_arbor.js
 *
 * Brings the SPH sheets' first machine — **X-100** (組切削 / TURN SPH, process 2071 &
 * 2031, drawing family 4857) — into Tooling Select. TEMPLATE_B's four SPH sheets need
 * two machines the system did not have, X-100 and XD-8; this is X-100's ARBOR.
 *
 * ── Where the rule came from ─────────────────────────────────────────────────
 * Not from `型式別治具リスト`. That sheet records which *model* has historically used
 * which tooling, and it cannot drive a dimensional search: 46 of its 463 dimension
 * keys are ambiguous even using all six columns — six models measuring identically
 * (ID 6.338 · OD 17.585 · RaceW 6.475 · BallW 8.31 · SD 11.13 · Sφ 12.878) carry six
 * different arbors. Its first column is also a 型式, not a part number: `4ABK10` does
 * not exist in `lpb.eng_item` at all.
 *
 * The design rule is in the workbook itself, as Excel formulas on `ARBOR` row 20,
 * fed from a `DIMENSION` sheet that is driven by C/N alone (「C/Nのみ入力すること」):
 *
 *     A = ROUNDDOWN(BALL ID(MIN) − 0.01, 2)
 *     B = ROUNDUP(SPH TB + 0.4, 1)
 *     C = ROUNDDOWN(SPH OD − 0.2, 1)     [held at 31.5 when it would exceed and TB < 28]
 *     D = ROUNDUP((BALL BW − SPH SW) / 2 + 0.5, 1)
 *
 * ── What ships, and what does not ────────────────────────────────────────────
 * Only **A and C**. B and D need `TB`, `BW` and `SW` — dimensions of the BALL and RACE
 * *components*, which `buildSpecContext` does not carry (it holds the assembly's own
 * OD/ID/W/SD). They are stored on the inventory rows so they are ready the day the
 * context can supply them, but no search rule references them.
 *
 * The 31.5 cap on C is likewise omitted: its branch needs TB. It only bites above
 * C = 31.5, and leaving it out computes a slightly larger target that still ranks to
 * the nearest arbor.
 *
 * ── Confidence ───────────────────────────────────────────────────────────────
 * `A` reproduces the inventory on 42 of 43 (arbor × part) pairs — 98 %. B/C/D land at
 * 70–81 %, which is the expected signature of tooling reuse rather than a wrong rule:
 * an arbor is designed for one part and then shared with others whose dimensions are
 * close, so only the design-basis part reproduces it exactly. The same pattern was
 * accepted for STOCKER CHUTE (73/87).
 *
 * (A, C) identifies an arbor uniquely for 75 % of the shelf at ±0.1, worst cluster 3 —
 * the remaining ties are resolved by the ranking, as everywhere else in this system.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260814d_x100_sph_arbor.js --dry
 *   node db_migrations/20260814d_x100_sph_arbor.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'X-100';
const INV = 'tooling_x100';
const TOOLING = 'ARBOR';

// `floorN` is the house rewrite of ROUNDDOWN — `_preprocess` maps round/ceil/floor to
// the N-arg forms because expr-eval treats the bare names as unary.
const FORMULAS = [
  { key: 'A', expr: 'floorN(idAft_min - 0.01, 2)', sort: 0,
    desc: 'X-100 ARBOR sheet row 20: A = ROUNDDOWN(BALL ID(MIN) − 0.01, 2)' },
  { key: 'C', expr: 'floorN(OD - 0.2, 1)', sort: 1,
    desc: 'X-100 ARBOR sheet row 20: C = ROUNDDOWN(SPH OD − 0.2, 1). The 31.5 cap needs TB, which the spec context does not carry.' },
];

// A is the bore the arbor has to enter — it is the fit that matters, so it is tight.
// C is the outside envelope and tolerates more.
const RULES = [
  { key: 'A', col: 'dim_a', plus: '0.2', minus: '0.2', prio: 0, label: 'Arbor bore (BALL ID−0.01)' },
  { key: 'C', col: 'dim_c', plus: '0.5', minus: '0.5', prio: 1, label: 'Arbor envelope (SPH OD−0.2)' },
];

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
        dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC,
        dim_e NUMERIC, dim_f NUMERIC
      )`);
    log.push(`── inventory table ──\n   ${INV} ensured`);

    const have = (await client.query(
      `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [TOOLING])).rows[0].n;
    if (have > 0) {
      log.push(`   ${TOOLING}: already ${have} rows — left alone`);
    } else {
      const rows = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'data', 'x100_arbor_4857-01.json'), 'utf8'));
      const COLS = 6;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      // Column order here MUST match the values array — a mismatch writes silently wrong dims.
      const vals = rows.flatMap((r) => [TOOLING, r.tooling_no, r.dim_a, r.dim_b, r.dim_c, r.dim_d]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, dim_a, dim_b, dim_c, dim_d) VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} ${TOOLING} rows (${rows[0].tooling_no} …)`);
    }

    // ── machine ──────────────────────────────────────────────────────────────
    let m = (await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$1,$2,true) RETURNING id`, [MACHINE, INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) → ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    // ── formulas ─────────────────────────────────────────────────────────────
    log.push('\n── formulas ──');
    for (const f of FORMULAS) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, f.key, f.expr, f.sort, f.desc]);
      log.push(`   ${r.rowCount ? 'added  ' : 'exists '} ${f.key} = ${f.expr}`);
    }

    // ── search rules ─────────────────────────────────────────────────────────
    log.push('\n── search rules ──');
    for (const s of RULES) {
      const r = await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
            sort_priority, label, inventory_tooling_filter, is_match_dim)
         SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,true
          WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`,
        [mid, TOOLING, s.key, s.col, s.plus, s.minus, s.prio, s.label, TOOLING]);
      log.push(`   ${r.rowCount ? 'added  ' : 'exists '} ${s.key} -> ${s.col}  ±${s.plus}`);
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
