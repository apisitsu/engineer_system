'use strict';

/**
 * 20260815c_body_holder_finish_id.js
 *
 * Adds **FINISH ID** (process `0351`) — BODY HOLDER 4651-20, 203 rows. This was the one
 * entry in the process audit's ❌ group that is dimensional tooling with a *published*
 * design standard rather than an assembly or inspection jig.
 *
 * ── The standard ─────────────────────────────────────────────────────────────
 * `RE33024 D` (2024.02.16, in `api/engineer/mtc/doc/`) classifies by head diameter:
 *
 *     BODY HOLDER 4651-20-XXXX          HD ≤ 55        (thin type; RE33033 merged in at rev D)
 *     BODY HOLDER 4651-12-XXXX (BDXXXX) 55 < HD ≤ 68
 *     CLAMP PLATE 4651-13-XXXX (PEXXXX) TYPE1 / TYPE2
 *     対象ワークサイズ                   HD ≤ φ68
 *
 * It gives the classification and the STD-TYPE drawing names but not the arithmetic.
 * That is in `20210916_TOOLING LIST_薄型ボディホルダー.xls`, whose `DIMENSION` sheet is
 * C/N-driven (「CNのみ直接入力のこと」) exactly like the X-100 ARBOR workbook:
 *
 *     A = ROUND(HD, 2)                       頭部受け径  (head receive dia)
 *     B = ROUND(CD + 0.5, 1)                 内径
 *     C = ROUND(10 + W × 0.75, 0)            厚さ        (thickness)
 *     D = FLOOR(FL − C/2 ∓ 1, 0.5), cap 28   受け面長さ  (∓ picks on W ≤ SHD)
 *     E = D + 5  when D < 25                 Dカット高さ
 *
 * ── Which spec column is which, settled by measurement ───────────────────────
 * The DIMENSION sheet carries 147 C/Ns with their HD/CD/W/FL/SHD, so the mapping was
 * *tested* rather than guessed — every candidate column in `tooling_spec_process` was
 * scored against it:
 *
 *     HD  == blank_head       73/73   (100 %)     → context `HD`
 *     W   == head_width       81/81   ( 98 %)     → context `headWidth`
 *     SHD == female_shankdia  20/21   ( 95 %)     → context `shankDia`
 *     CD  — no column above 50 %                  → not available
 *     FL  — no column above 50 %                  → not available
 *
 * `head_width` is *not* the head diameter despite the name — it is the 巾, and reading it
 * as HD would have put a 25.85 mm head against an 8.31 mm value.
 *
 * ── What ships ───────────────────────────────────────────────────────────────
 * **A and C only.** B needs CD and D/E need FL, neither of which the spec context can
 * supply — the same call made for X-100 ARBOR, and for the same reason. They are stored
 * on the inventory rows so they are ready the day those dimensions arrive.
 *
 * A is the head that seats in the holder, so it is the fit and carries the tight
 * tolerance. C is the thickness and ranks.
 *
 * ── Not in this migration ────────────────────────────────────────────────────
 * BODY HOLDER 4651-12 and CLAMP PLATE 4651-13 have no tooling list on the shared drive
 * under any name searched (`4651-1[23]`, `CLAMP`, `ボディホルダ`). Only 4651-20 (thin
 * type) and 4651-10 (guide pin) have one. Since rev D folded RE33033 in and made the thin
 * holder the standard design, 4651-20 is also the family still being drawn — but the
 * 55 < HD ≤ 68 band has no shelf here, so parts in it will find nothing rather than a
 * wrong holder.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815c_body_holder_finish_id.js --dry
 *   node api/engineer/mtc/db_migrations/20260815c_body_holder_finish_id.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FINISH ID';
const INV = 'tooling_finish_id';
const TOOLING = 'BODY HOLDER';

const FORMULAS = [
  { key: 'A', expr: 'roundN(HD, 2)', sort: 0,
    desc: 'RE33024 D / 薄型ボディホルダー list row 6: A = ROUND(HD, 2), the head receive diameter. HD is tooling_spec_process.blank_head.' },
  { key: 'C', expr: 'roundN(10 + headWidth * 0.75, 0)', sort: 1,
    desc: 'Same sheet: C = ROUND(10 + 巾 × 0.75, 0), the holder thickness. 巾 is tooling_spec_process.head_width.' },
];

const RULES = [
  { key: 'A', col: 'dim_a', plus: '0.3', minus: '0.3', match: true,  prio: 0, label: 'Head receive dia (HD)' },
  { key: 'C', col: 'dim_c', plus: null,  minus: null,  match: false, prio: 1, label: 'Thickness' },
];

// RE33024 D §7: 対象ワークサイズ 頭部径 φ68 以下. The first eligibility bound any of the
// machines added this week has had — every other new machine is offered for every part.
const LIMITS = [
  { v: 'HD', min: null, max: '68',
    desc: 'RE33024 D §7 対象ワークサイズ: 頭部径 (HD) φ68mm 以下. HD = tooling_spec_process.blank_head.' },
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
        dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC,
        dim_d NUMERIC, dim_e NUMERIC, dim_f NUMERIC
      )`);
    log.push(`── inventory ──\n   ${INV} ensured`);

    const have = (await client.query(
      `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [TOOLING])).rows[0].n;
    if (have > 0) {
      log.push(`   ${TOOLING}: already ${have} rows — left alone`);
    } else {
      const rows = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'data', 'body_holder_4651-20.json'), 'utf8'));
      // Column order below must match the values array exactly — a mismatch does not raise.
      const COLS = 9;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, MACHINE,
        r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null,
        r.dim_d ?? null, r.dim_e ?? null, r.dim_f ?? null,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e, dim_f)
         VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} rows (A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
    }

    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [MACHINE, 'FINISH ID (内径仕上げ · process 0351)', INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) → ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    log.push('\n── formulas ──');
    for (const f of FORMULAS) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, f.key, f.expr, f.sort, f.desc]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${f.key} = ${f.expr}`);
    }

    log.push('\n── search rules ──');
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
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${s.key} -> ${s.col}  ${s.plus ? `±${s.plus}` : 'rank-only'}`);
    }

    log.push('\n── eligibility limits ──');
    for (const l of LIMITS) {
      const r = await client.query(
        `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, max_inclusive, description)
         SELECT $1,$2::text,$3::numeric,$4::numeric,true,$5::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_machine_limit WHERE machine_id=$1 AND input_var=$2)
         RETURNING id`, [mid, l.v, l.min, l.max, l.desc]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${l.v} ≤ ${l.max}`);
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
