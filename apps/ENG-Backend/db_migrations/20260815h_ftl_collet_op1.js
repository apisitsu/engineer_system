'use strict';

/**
 * 20260815h_ftl_collet_op1.js
 *
 * Adds **FTL COLLET OP1** (4501-01, 126 rows) — the first piece of the largest gap in
 * process 2071. `4501-02` and `4501-01` are the two most-used tooling families of that
 * process (1,664 and 1,619 plan rows, ahead of X-100's own arbor at 1,070), and neither
 * was in Tooling Select at all.
 *
 * It became possible only because `20260815f_` synced the ball/race component dimensions
 * from `lpb`; before that, none of this sheet's inputs reached the formula engine.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * `20220418_…_FTL_TOOLING_LIST.xlsx`, sheet `COLLET OP1`, is a C/N-driven block:
 *
 *     A7 = RD                                     ← the whole selection key
 *     A8 = MIN(IF(A12:A161 >= A7, A12:A161))      ← smallest shelf A at or above it
 *     B7 = BW/2 + RD/2 × SIN(RADIANS(3)) + PW     ← informational, follows from the row
 *
 * The shelf lookup is a **ceiling**, not a nearest match. `searchInventory` expresses that
 * exactly: a lone `tol_minus` emits `col >= computed - tol_minus`, so `tol_minus = 0` with
 * no `tol_plus` is `dim_a >= RD`, and the ranking then picks the smallest qualifying row —
 * which is what `MIN(IF(...))` does.
 *
 * B is stored but carries no rule: the sheet reads it out of whichever row A selected, so
 * filtering on it would be filtering on the answer.
 *
 * ── RD is `race_od`, measured not assumed ────────────────────────────────────
 * Scored against the workbook's own 22-row C/N sheet: `RD = race_od` 88 % (n=16). Two
 * other sheets corroborate the same column — J-WAVE's `ROD` matches `race_od` at 95 %
 * (n=21) and its `RW` matches `race_width` at 100 %.
 *
 * ── What is NOT shipped, and why ─────────────────────────────────────────────
 * **COLLET OP2** keys on the sheet's `OD` (`A7 = DIMENSION!F3`), which reproduces against
 * no column in the spec table — not `sph_od`, not `od_aft`. Its 142 rows stay out.
 * **PUSHER OP1/OP2** need `SD1`/`SD2`, equally unresolved.
 * **J-WAVE 4879** is blocked on the same wall: every one of its sheets keys on a value
 * derived from `SW`, `TB` or `SD`, none of which any `lpb` table reproduces.
 *
 * Five component dimensions are now solid — `ball_width`, `ball_bore`, `ball_dia`,
 * `race_od`, `race_width`. The three that remain (`SW`, `TB`, `SD`) are what stands
 * between here and roughly 600 more rows across FTL and J-WAVE.
 *
 * ── Machine name ─────────────────────────────────────────────────────────────
 * The SDS dictionary already holds `machine_type_code` **501** — the 4501 prefix — as
 * **`FTL-10(I)`**. Per the rule in `sds-pipeline.md`, Tooling Select takes the
 * dictionary's name rather than the bare `FTL` the Excel index uses.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815h_ftl_collet_op1.js --dry
 *   node db_migrations/20260815h_ftl_collet_op1.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FTL-10(I)';
const INV = 'tooling_ftl10';
const TOOLING = 'COLLET OP1';
const PROCESS = ['2071', '2031'];

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
        path.join(__dirname, 'data', 'ftl_collet_4501.json'), 'utf8'))[TOOLING];
      // Column order below must match the values array exactly — a mismatch does not raise.
      const COLS = 6;
      const ph = rows.map((_, i) =>
        `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
      const vals = rows.flatMap((r) => [
        TOOLING, r.tooling_no, MACHINE, r.dim_a, r.dim_b ?? null, r.dim_c ?? null,
      ]);
      await client.query(
        `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c)
         VALUES ${ph}`, vals);
      log.push(`   inserted ${rows.length} rows (A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
    }

    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [MACHINE, 'FTL-10(I) (組切削 COLLET CHUCK · process 2071/2031)', INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) → ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    log.push('\n── formulas ──');
    for (const [key, expr, sort, desc] of [
      ['A', 'raceOd', 0,
        'COLLET OP1 sheet A7 = RD, the race outside diameter. RD == lpb.eng_race.od, scored 88% on the workbook\'s own C/N sheet and 95% against J-WAVE\'s ROD.'],
      ['B', 'ballWidth / 2 + raceOd / 2 * 0.05234 + 3.4', 1,
        'COLLET OP1 sheet B7 = BW/2 + RD/2 x SIN(RADIANS(3)) + PW. Informational only — the sheet reads B out of the row that A selected. PW is banded on SW (3.2/3.4/3.6); 3.4 is the middle band and SW is not yet resolvable.'],
    ]) {
      const r = await client.query(
        `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
         SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
          WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                             WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
         RETURNING id`, [mid, TOOLING, key, expr, sort, desc]);
      log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr}`);
    }

    // tol_minus 0 with no tol_plus → `dim_a >= RD`; ranking then takes the smallest such
    // row, which is exactly the sheet's MIN(IF(A >= A7)) ceiling lookup.
    log.push('\n── search rules ──');
    for (const [key, col, plus, minus, prio, label, match] of [
      ['A', 'dim_a', null, '0', 0, 'Collet bore — smallest at or above RD', true],
      ['B', 'dim_b', null, null, 1, 'Collet face', false],
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
               `${minus !== null ? `>= computed` : 'rank-only'}`);
    }

    // ── SDS ──────────────────────────────────────────────────────────────────
    log.push('\n── sds_machine_tool ──');
    const typeId = (await client.query(
      `SELECT id FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
      [MACHINE])).rows[0]?.id ?? null;
    let added = 0;
    for (const pc of PROCESS) {
      added += (await client.query(
        `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
         SELECT 'T1',$1::text,$2::text,'4501-01'::text,$3::int
          WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                             WHERE process_code=$1 AND machine_type=$2 AND tool_drawing_no='4501-01')
         RETURNING id`, [pc, MACHINE, typeId])).rowCount;
    }
    log.push(`   proc ${PROCESS.join('/')} · 4501-01 · type_id ${typeId ?? '-'} → ${added} new`);
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
