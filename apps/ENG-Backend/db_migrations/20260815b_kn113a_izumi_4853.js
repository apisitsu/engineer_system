'use strict';

/**
 * 20260815b_kn113a_izumi_4853.js
 *
 * Adds the second KN-113A workbook — `20250217_TOOLING LIST_4853-XX_和泉用治具.xlsx`,
 * which is a **different file** from the `4853_KN-113Aボール内研用.xls` already loaded by
 * `20260814h_…`. Same machine, three more drawing families, 93 rows.
 *
 * ── Names come from TEMPLATE_B, which the sheets themselves do not carry ─────
 * The workbook's sheets are named only `4853-01-XXXX` / `4853-06-XXXX` / `4853-07-XXXX`.
 * TEMPLATE_B's M-BODY and F-BODY sheets name them against process `1121 / 1061`
 * (ID SPH GRIND / ID GRIND) on machine **KN-113A**:
 *
 *     BACKING PLATE 4853-01 · JAW 4853-06 · GAUGE 4853-07 · QUILL 4853-05 · WHEEL 4853-14
 *
 * That also confirms KN-113A was the right machine name for `20260814h_…`.
 *
 * ── Two families that already exist under different drawing numbers ──────────
 * `20260814h_…` loaded `JAW` = 4853-15 and `BACK PLATE` = 4853-16 from the other
 * workbook. Neither number appears in TEMPLATE_B's LINK LIST (which lists 01, 03, 05,
 * 06, 07, 10, 11, 14). TEMPLATE_B is the sheet engineers actually select from, so its
 * numbers take the plain names and the other workbook's keep a drawing-qualified one —
 * the same shape as `LOADER (4559-06 REF)`. Both stay visible; nothing is deleted.
 *
 *     4853-01 → BACKING PLATE          4853-16 → BACK PLATE (4853-16)
 *     4853-06 → JAW (4853-06)          4853-15 → JAW
 *
 * `tooling_search_rule` is UNIQUE on (machine_id, tooling_name, output_key), so two
 * families sharing a name would collide on insert regardless.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Column A is the **work OD** (confirmed by the engineer). Two independent checks agree:
 * BACKING PLATE A spans 13.6–51 and GAUGE A spans 11.251–51 — and the two carry the
 * *same set of values*, which is what you expect from two jigs keyed off one dimension.
 *
 *     BACKING PLATE   A = OD        (C = A + 0.2 and D = A + 1 are the sheet's own
 *     GAUGE           A = OD         internal relations, not selection inputs)
 *
 * ── JAW 4853-06 ships as inventory with NO search rule ───────────────────────
 * Its column A runs **7–25.8 on 30 of 42 rows** — it is not the OD, whose range on this
 * machine is 13.6–51. Column B is 16.5 on every row sampled while A varies, so B is a
 * fixed mount diameter, not a work dimension either. Rather than guess which column is
 * the key, the 42 rows are stored and the family is left unsearchable until someone who
 * knows the jig says which column the work dimension is. Storing it now means the day
 * that answer arrives the fix is one `tooling_formula` row, not another data extraction.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815b_kn113a_izumi_4853.js --dry
 *   node db_migrations/20260815b_kn113a_izumi_4853.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'KN-113A';
const INV = 'tooling_kn113a';

// Renames applied to what 20260814h_ loaded, so TEMPLATE_B's numbers get the plain names.
const RENAMES = [
  { from: 'BACK PLATE', to: 'BACK PLATE (4853-16)' },
  { from: 'JAW',        to: 'JAW (4853-15)' },
];

const SPEC = {
  'BACKING PLATE': {
    formulas: [{ key: 'A', expr: 'OD', sort: 0,
      desc: '4853-01 sheet column A = work OD (confirmed by engineering). C = A+0.2 and D = A+1 are the sheet\'s internal relations.' }],
    rules: [
      { key: 'A', col: 'dim_a', plus: '0.5', minus: '0.5', match: true,  prio: 0, label: 'Plate bore (work OD)' },
      { key: 'B', col: 'dim_b', plus: null,  minus: null,  match: false, prio: 1, label: 'Plate OD' },
    ],
    extraFormulas: [{ key: 'B', expr: 'OD + 5', sort: 1,
      desc: 'Ranking only — the sheet gives no rule for B; the shelf sits above the bore.' }],
  },
  GAUGE: {
    formulas: [{ key: 'A', expr: 'OD', sort: 0,
      desc: '4853-07 sheet column A = work OD (confirmed by engineering); shares its value set with BACKING PLATE 4853-01.' }],
    rules: [
      { key: 'A', col: 'dim_a', plus: '0.5', minus: '0.5', match: true, prio: 0, label: 'Gauge bore (work OD)' },
    ],
    extraFormulas: [],
  },
  // No formulas, no rules — see the header. Inventory only.
  'JAW (4853-06)': { formulas: [], rules: [], extraFormulas: [] },
};

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0].id;
    log.push(`── ${MACHINE} (machine id ${mid}) ──`);

    // ── disambiguate the two families loaded from the other workbook ─────────
    log.push('\n── Rename (TEMPLATE_B numbers take the plain names) ──');
    for (const r of RENAMES) {
      let moved = 0;
      for (const [t, c] of [['tooling_kn113a', 'tooling_name'], ['tooling_formula', 'tooling_name'],
        ['tooling_search_rule', 'tooling_name'], ['tooling_search_rule', 'inventory_tooling_filter']]) {
        const q = t === 'tooling_kn113a'
          ? await client.query(`UPDATE ${t} SET ${c} = $2 WHERE ${c} = $1 RETURNING 1`, [r.from, r.to])
          : await client.query(
            `UPDATE ${t} SET ${c} = $2 WHERE ${c} = $1 AND machine_id = $3 RETURNING 1`, [r.from, r.to, mid]);
        moved += q.rowCount;
      }
      log.push(`   "${r.from}" → "${r.to}"  ${moved} row(s)`);
    }

    const data = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'data', 'kn113a_izumi_4853.json'), 'utf8'));

    for (const [tooling, rows] of Object.entries(data)) {
      log.push(`\n── ${tooling} ──`);
      const have = (await client.query(
        `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [tooling])).rows[0].n;
      if (have > 0) {
        log.push(`   inventory: already ${have} rows — left alone`);
      } else {
        // Column order below must match the values array exactly — a mismatch does not raise.
        const COLS = 9;
        const ph = rows.map((_, i) =>
          `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
        const vals = rows.flatMap((r) => [
          tooling, r.tooling_no, MACHINE,
          r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null,
          r.dim_d ?? null, r.dim_e ?? null, r.dim_f ?? null,
        ]);
        await client.query(
          `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e, dim_f)
           VALUES ${ph}`, vals);
        log.push(`   inventory: inserted ${rows.length} rows (${rows[0].tooling_no} …)`);
      }

      const s = SPEC[tooling];
      if (!s.formulas.length) { log.push('   no formula / rule — key column not identified (see header)'); continue; }
      for (const f of [...s.formulas, ...s.extraFormulas]) {
        const r = await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, tooling, f.key, f.expr, f.sort, f.desc]);
        log.push(`   formula ${r.rowCount ? 'added ' : 'exists'}  ${f.key} = ${f.expr}`);
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
        log.push(`   rule    ${r.rowCount ? 'added ' : 'exists'}  ${q.key} -> ${q.col}  ${q.plus ? `±${q.plus}` : 'rank-only'}`);
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
