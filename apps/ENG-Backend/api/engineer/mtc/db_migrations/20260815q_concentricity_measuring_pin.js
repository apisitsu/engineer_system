'use strict';

/**
 * 20260815q_concentricity_measuring_pin.js
 *
 * Adds **CONCENTRICITY MEASURING PIN** (9901-09, 263 rows) — the 同心度測定ピン used at
 * 組切削, and the largest single gap left in processes 2071 / 2031.
 *
 * `.claude/rules/tooling-select.md` listed "the 9901 measuring pins" among the recurring
 * absentees without saying which, or how much work they carry. The plan answers both:
 * **9901-09 is the most-planned tooling of process 2071 outright** — 820 rows there and
 * 322 at 2031, ahead of FTL's collets and pushers — and it appears on **890 of the 1,540
 * C/Ns that carry X-100 tooling**, so a majority of X-100 work needs one and the system
 * offered nothing.
 *
 * It is inspection tooling (工程 = 検査, per `20260202_Tooling_Excel_List.xlsm`), not a
 * machining fixture, which is why no machine's own workbook mentions it and three passes
 * over the 組切削 sheets never surfaced it.
 *
 * ── The rule, straight out of the sheet ──────────────────────────────────────
 * `20190524_TOOLING LIST_CONCENTRICITY MEASURING PIN.xlsx`, sheet `9901-09-0XXX_SPH`,
 * carries a live calculation block over the DIMENSION inputs:
 *
 *     A ピン外径      = ROUNDDOWN(ID - 0.01, 2)          ← the whole selection key
 *     B ザグリ径      = ROUNDUP(TB + 0.5, 1)
 *     C ザグリ深さ    = ROUNDUP((W1 - W2)/2 + 0.5, 1)
 *     D 外径          = ROUND(OD - 1, 0)
 *     E フランジ巾    = ROUNDUP(IF(C <= 5, 8, C + 3), 0)
 *     F ピン長さ      = ROUND(IF(W1 < 15, W1 + 3, W1), 0)      L 全長 = 25 + E + F
 *
 * with `ID` = ボール内径 MIN, `W1` = ボール巾, `W2` = SPHレース巾, `OD` = SPH外径, and the
 * instruction `A-Dが全て青地の図番を選択すること` — pick the drawing where A to D are all
 * in range.
 *
 * ── A is the rule; B, C and D rank ──────────────────────────────────────────
 * Measured against 949 planned pins — by far the largest answer key in this system:
 *
 *     A = ROUNDDOWN(ID - 0.01, 2)      median -0.01   98 % within 0.02 · 99 % within 0.1
 *     B = ROUNDUP(TB + 0.5, 1)         median  0.50   56 % within 0.5
 *     C = ROUNDUP((W1-W2)/2 + 0.5, 1)  median  0.50   44 % within 0.5
 *     D = ROUND(OD - 1, 0)             median -0.10   56 % within 0.5
 *
 * A is the pin that enters the ball bore, so it is the functional fit and it behaves like
 * one. B/C/D are the counterbore and flange, where the shelf visibly mixes generations
 * (many rows carry `-` for B and C); they rank and never exclude. The stored formula keeps
 * the sheet's own `- 0.01`; the measured median says the shelf sits a further 0.01 below,
 * which the asymmetric tolerance covers without rewriting a documented rule.
 *
 * ── Machine ─────────────────────────────────────────────────────────────────
 * The SDS dictionary holds `machine_type_code` **901** — matching the 9901 prefix the same
 * way 501 matches 4501 and 879 matches 4879 — as **`測定用治具全般`**. Per the rule in
 * `sds-pipeline.md`, Tooling Select takes the dictionary's name.
 *
 * The 1XXX (BALL切削) and 2XXX (BALL・SLEEVE) blocks are loaded alongside 0XXX (SPH): the
 * pin is selected on bore, and the part class already decides which block can fit.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815q_concentricity_measuring_pin.js --dry
 *   node api/engineer/mtc/db_migrations/20260815q_concentricity_measuring_pin.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = '測定用治具全般';          // SDS machine_type_code 901
const INV = 'tooling_measuring';
const TOOLING = 'CONCENTRICITY MEASURING PIN';
const DRAWING = '9901-09';
const PROCESS = ['2071', '2031'];

const FORMULAS = [
  ['A', 'if(ballBore > 0, floorN(ballBore - 0.01, 2), -999)', 0,
    'Sheet 9901-09-0XXX_SPH: A ピン外径 = ROUNDDOWN(ID - 0.01, 2), ID being ボール内径 MIN. ' +
    'The pin enters the ball bore, so this is the functional fit and the only filter — ' +
    'median -0.01 against 949 planned pins, 98% within 0.02. -999 keeps a part with no ball ' +
    'off the shelf.'],
  ['B', 'ceilN(TB + 0.5, 1)', 1,
    'B ザグリ径 = ROUNDUP(TB + 0.5, 1). Rank-only: 56% within 0.5 — the shelf mixes ' +
    'generations and many rows carry "-" here.'],
  ['C', 'ceilN((ballWidth - sphWidth) / 2 + 0.5, 1)', 2,
    'C ザグリ深さ = ROUNDUP((W1 - W2)/2 + 0.5, 1), W1 = ボール巾, W2 = SPHレース巾. Rank-only.'],
  ['D', 'roundN(sphOd - 1, 0)', 3,
    'D 外径 = ROUND(OD - 1, 0), OD being SPH外径. Rank-only.'],
];

const RULES = [
  // Asymmetric: the sheet's own -0.01 plus the further 0.01 the shelf measures below it.
  ['A', 'dim_a', '0.01', '0.02', 0, 'Pin diameter — enters the ball bore', true],
  ['B', 'dim_b', null, null, 1, 'Counterbore diameter', true],
  ['C', 'dim_c', null, null, 2, 'Counterbore depth', true],
  ['D', 'dim_d', null, null, 3, 'Flange outside diameter', true],
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
        dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC, dim_e NUMERIC
      )`);
    log.push(`── inventory ──\n   ${INV} ensured`);

    const have = (await client.query(
      `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [TOOLING])).rows[0].n;
    if (have > 0) {
      log.push(`   ${TOOLING}: already ${have} rows — left alone`);
    } else {
      const rows = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'data', 'cmp_9901-09.json'), 'utf8'))[TOOLING];
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
      log.push(`   inserted ${rows.length} rows (A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
    }

    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [MACHINE, '測定用治具全般 (検査 · 9901 series)', INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) -> ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    log.push('\n── formulas ──');
    for (const [key, expr, sort, desc] of FORMULAS) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, key, expr, sort, desc]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr}`);
    }

    log.push('\n── search rules ──');
    for (const [key, col, plus, minus, prio, label, match] of RULES) {
      const r = await client.query(
        `INSERT INTO tooling_search_rule
           (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
            sort_priority, label, inventory_tooling_filter, is_match_dim)
         SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$2::text,$9::boolean
          WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, key, col, plus, minus, prio, label, match]);
      const fixed = r.rowCount ? 0 : (await client.query(
        `UPDATE tooling_search_rule
            SET tol_plus = $4::numeric, tol_minus = $5::numeric, is_match_dim = $6::boolean
          WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3
            AND (tol_plus IS DISTINCT FROM $4::numeric
              OR tol_minus IS DISTINCT FROM $5::numeric
              OR is_match_dim IS DISTINCT FROM $6::boolean)
        RETURNING id`, [mid, TOOLING, key, plus, minus, match])).rowCount;
      log.push(`   ${r.rowCount ? 'added ' : fixed ? 'fixed ' : 'exists'}  ${key} -> ${col} ` +
               `${plus !== null ? `+${plus}/-${minus}` : 'no filter'}${match ? ' · ranks' : ''}`);
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
         SELECT 'T1',$1::text,$2::text,$3::text,$4::int
          WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                             WHERE process_code=$1 AND machine_type=$2 AND tool_drawing_no=$3)
         RETURNING id`, [pc, MACHINE, DRAWING, typeId])).rowCount;
    }
    log.push(`   proc ${PROCESS.join('/')} · ${DRAWING} · type_id ${typeId ?? '-'} -> ${added} new`);

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
