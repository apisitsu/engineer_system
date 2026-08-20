'use strict';

/**
 * 20260815e_release_set_stick.js
 *
 * Adds **SET STICK 4606-08** (15 rows) for process `2411` ゆるめ / RELEASE — the first
 * tooling of that process to reach Tooling Select.
 *
 * ── Finding the file at all ──────────────────────────────────────────────────
 * Two earlier sweeps of the shared drive for `4606` found nothing, because **no file
 * name on that drive contains the drawing family**. The list is
 * `ゆるめ_THAI用セットスティック(山本)/20200415_TOOLING LIST_RELEASE-JIG.xlsx`.
 *
 * The index that does carry the mapping is
 * `Tooling Select/20260202_Tooling_Excel_List.xlsm`, whose columns are
 * `リスト Excelファイル名 | 工程(Process) | マシン(Machine) | 詳細 | 図番(DWG/NO.)`:
 *
 *     20200415_TOOLING LIST_RELE…   仕上げ(FINISH)   RELEASE   ゆるめ(RELEASE)   4606
 *
 * **Search that index by 図番, never the drive by file name.**
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Printed above the table: `ワーク巾+0.5 (SBW+0.5)`. The two dimension columns are
 * `A1/巾(小)` and `A2/巾(大)` — small width and large width — and A1 < A2 on all 15 rows,
 * so they bracket the widths one stick serves:
 *
 *     A1 ≤ (W + 0.5) ≤ A2
 *
 * That is the `+0` containment pattern already used by KS-B80 WHEEL and KS-03A LOADER: a
 * one-sided tolerance emits `col <= computed + tol_plus` or `col >= computed - tol_minus`,
 * so `tol_plus = 0` against the min column plus `tol_minus = 0` against the max column is
 * exactly `min <= value <= max`. It needs **two output keys** — `tooling_search_rule` is
 * UNIQUE on (machine_id, tooling_name, output_key), so one key cannot serve both columns.
 *
 * Length (`長さ`) is 150 on every row; it is stored and never ranked.
 *
 * The shelf covers W + 0.5 from 7 to 27.5, i.e. work widths 6.5–27 mm.
 *
 * ── Machine name ─────────────────────────────────────────────────────────────
 * The Excel index calls the machine `RELEASE`, which is the *process* name. The SDS
 * dictionary already assigns `machine_type_code` **606** — the 4606 prefix — to
 * **`TP-SW-03他`**, a real machine model. Per the rule recorded in `sds-pipeline.md`
 * after `20260815d_…` had to rename three machines for exactly this reason, Tooling
 * Select is aligned to the dictionary rather than the reverse. Using the dictionary name
 * also makes the SDS picker's `byCode` path work on prefix 606 without any new row.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * TEMPLATE_B names three 4606 families — WORK GUIDE 4606-03, SET STICK 4606-08 and PIN
 * 4606-10 — under both 2411 and 2071/2031. Only the set stick has a list; the other two
 * have no file anywhere on the drive. The factory plan for 2411 in fact uses seven
 * (4606-01/03/04/05/06/08/10), so TEMPLATE_B itself covers 3 of 7.
 *
 * `sds_machine_tool` is registered for **2411 only**. TEMPLATE_B also files 4606 under
 * 2071/2031, but the factory process plan for those two carries no 4606 row at all, so
 * registering them would offer the stick where it is not run.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815e_release_set_stick.js --dry
 *   node db_migrations/20260815e_release_set_stick.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'TP-SW-03他';
const INV = 'tooling_tpsw03';
const TOOLING = 'SET STICK';
const PROCESS = '2411';

const FORMULAS = [
  { key: 'A', expr: 'W + 0.5', sort: 0,
    desc: 'RELEASE-JIG list header: ワーク巾 + 0.5 (SBW+0.5). Floor half of the A1 ≤ W+0.5 ≤ A2 containment.' },
  { key: 'B', expr: 'W + 0.5', sort: 1,
    desc: 'Same value as A — the second key exists because tooling_search_rule is UNIQUE on (machine, tooling, output_key) and containment needs one key per column.' },
];

// tol_plus 0 with no tol_minus → `dim_a <= W+0.5`; tol_minus 0 with no tol_plus →
// `dim_b >= W+0.5`. Together: A1 ≤ W+0.5 ≤ A2.
const RULES = [
  { key: 'A', col: 'dim_a', plus: '0',  minus: null, prio: 0, label: '巾(小) — stick min width' },
  { key: 'B', col: 'dim_b', plus: null, minus: '0',  prio: 1, label: '巾(大) — stick max width' },
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
        path.join(__dirname, 'data', 'set_stick_4606-08.json'), 'utf8'));
      // Column order below must match the values array exactly — a mismatch does not raise.
      const COLS = 6;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, MACHINE, r.dim_a, r.dim_b, r.dim_c ?? null,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c)
         VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} rows — covers W+0.5 from ` +
               `${Math.min(...rows.map((r) => r.dim_a))} to ${Math.max(...rows.map((r) => r.dim_b))}`);
    }

    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [MACHINE, 'TP-SW-03他 (ゆるめ RELEASE · process 2411)', INV])).rows[0];
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
         SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,true
          WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`,
        [mid, TOOLING, s.key, s.col, s.plus, s.minus, s.prio, s.label, TOOLING]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${s.key} -> ${s.col}  ` +
               `${s.plus !== null ? `+${s.plus}` : '--'} / ${s.minus !== null ? `-${s.minus}` : '--'}`);
    }

    // ── SDS: make it selectable under 2411 ───────────────────────────────────
    log.push('\n── sds_machine_tool ──');
    const typeId = (await client.query(
      `SELECT id FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
      [MACHINE])).rows[0]?.id ?? null;
    const t = await client.query(
      `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
       SELECT 'T1',$1::text,$2::text,'4606-08'::text,$3::int
        WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                           WHERE process_code=$1 AND machine_type=$2 AND tool_drawing_no='4606-08')
       RETURNING id`, [PROCESS, MACHINE, typeId]);
    log.push(`   ${t.rowCount ? 'added ' : 'exists'}  proc ${PROCESS} · 4606-08 · type_id ${typeId ?? '-'}`);

    const touched = await client.query(
      `UPDATE tooling_machine SET machine_name = machine_name
        WHERE machine_name = $1 RETURNING sds_machine_type_id`, [MACHINE]);
    log.push(`   tooling_machine.sds_machine_type_id → ${touched.rows[0]?.sds_machine_type_id ?? 'NULL'}`);

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
