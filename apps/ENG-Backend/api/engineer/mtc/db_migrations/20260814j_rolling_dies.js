'use strict';

/**
 * 20260814j_rolling_dies.js
 *
 * Adds **ROLLING** (転造 thread rolling, process 2511 / 2501, drawing families
 * 4800-56 / 4800-57 / 4800-61) — 73 roll dies from `新_転造ダイス先端R.xls`.
 *
 * ── Why this was first written off, and what changed ─────────────────────────
 * The die is chosen by **thread size**, not by OD/ID/W, and `buildSpecContext` was
 * read as carrying no thread information. That was wrong on both counts:
 *
 *   • `tooling_spec_process` already stores `thread_name`, `thread_max_od`,
 *     `thread_min_od` and `thread_length`, populated on 1,064 rows.
 *   • The sheet does carry per-row drawing numbers — they sit in three columns headed
 *     巾 60mm / 巾 80mm / 巾 100mm (die width), which is why a scan of the first
 *     fourteen rows made it look like a bare standards table.
 *
 * `buildSpecContext` now derives `threadDia` (nominal diameter in **inches**) and
 * `threadTPI` from `thread_name`. The parse handles both spellings the factory uses for
 * the same thread — `.3125-24UNJF` and `5/16-24UNF` — and the mixed fractions
 * `1-1/8-12UNJF`, which must be tested before the decimal form or they truncate to 1.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * There is no arithmetic to reproduce: the sheet is a direct lookup keyed on thread.
 *
 *     A = threadDia   (nominal inches — the sheet's column A)
 *     B = threadTPI   (the pitch, e.g. −24 → 24)
 *
 * Both match **exactly** (tol_plus = tol_minus = 0). A thread-rolling die either cuts
 * the thread or it does not; there is no nearest-fit. Width (dim_c) deliberately carries
 * no rule — 60/80/100 mm is a machine setup choice, so all widths for the thread are
 * returned and the operator picks.
 *
 * dim_d / dim_e carry the 転造ダイス先端R min/max in mm for reference; they are the
 * die's own tip radius and are not selection inputs.
 *
 * ── Coverage ─────────────────────────────────────────────────────────────────
 * 73 dies over 17 distinct threads, 0.19″ to 1.375″. Only parts whose spec row has a
 * `thread_name` can match, which is the correct behaviour — a part with no thread is
 * not rolled.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260814j_rolling_dies.js --dry
 *   node api/engineer/mtc/db_migrations/20260814j_rolling_dies.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'ROLLING';
const INV = 'tooling_rolling';
const TOOLING = 'ROLL DIE';

const FORMULAS = [
  { key: 'A', expr: 'threadDia', sort: 0,
    desc: '新_転造ダイス先端R.xls column A: nominal thread diameter in inches, parsed from thread_name.' },
  { key: 'B', expr: 'threadTPI', sort: 1,
    desc: '新_転造ダイス先端R.xls column B: threads per inch, parsed from thread_name.' },
];

// Exact match on both. Ranking cannot help here — a die for 5/16-24 does not roll 3/8-24.
const RULES = [
  { key: 'A', col: 'dim_a', plus: '0', minus: '0', match: true, prio: 0, label: 'Thread dia (in)' },
  { key: 'B', col: 'dim_b', plus: '0', minus: '0', match: true, prio: 1, label: 'Threads per inch' },
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
        thread        TEXT,
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
        path.join(__dirname, 'data', 'rolling_dies_4800.json'), 'utf8'));
      // Column order below must match the values array exactly — a mismatch does not raise.
      const COLS = 9;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, MACHINE, r.thread,
        r.dim_a, r.dim_b, r.dim_c, r.dim_d, r.dim_e,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, thread, dim_a, dim_b, dim_c, dim_d, dim_e)
         VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} dies over ` +
               `${new Set(rows.map((r) => r.dim_a)).size} threads (${rows[0].thread} …)`);
    }

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
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${s.key} -> ${s.col}  exact`);
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
