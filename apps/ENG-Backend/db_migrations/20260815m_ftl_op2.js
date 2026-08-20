'use strict';

/**
 * 20260815m_ftl_op2.js
 *
 * Adds **FTL COLLET OP2** (142 rows, already extracted by `20260815h_` but left unwired)
 * and **FTL PUSHER OP2** (116 rows). With `20260815l_`'s PUSHER OP1 that completes the
 * 4501 collet-chuck set — all four sheets of the workbook now select.
 *
 * ── What was blocking them ───────────────────────────────────────────────────
 * Both key on the sheet's `OD`, 「SPH 切削外径」— the diameter the SPH is turned to.
 * `20260815h_` wrote it off: "reproduces against no column in the spec table — not
 * `sph_od`, not `od_aft`". That was right about equality and wrong about the conclusion.
 * It is `sph_od` plus a fixed machining allowance, and the two workbooks quote the same
 * allowance in two different ways, which is what makes it a rule rather than a fit:
 *
 *     XD-8 DIMENSION   OD is a NOMINAL, with its own +TOL column (0.05 on 360 of 413 rows)
 *                      OD - sph_od = 0.10   on 81 % of 371 rows
 *     FTL  DIMENSION   OD is already stated as a MAX (`ノミナル` row reads MAX)
 *                      OD - sph_od = 0.15   on 53 % of 32 rows
 *
 * 0.10 + 0.05 = 0.15. Two sheets, maintained by different people for different machines,
 * agree on the allowance to the hundredth. `buildSpecContext` exposes both as `sphCutOd`
 * and `sphCutOd_max`; these two rules take the MAX, as their sheets do.
 *
 * The rows that miss are the two-stage parts. A C/N appears twice on the FTL sheet — once
 * `D切削` and once `OP2` — and the first row's OD is an intermediate diameter chosen by
 * the designer, which no spec column holds and none should.
 *
 * ── The rules ────────────────────────────────────────────────────────────────
 * Sheet `COLLET OP2`:
 *     A7 = OD                                     A8 = MIN(IF(A >= A7))   ceiling
 *     B7 = BW/2 - A/2 x SIN(RADIANS(3)) + PW      PW = 2.1 / 1.9 / 1.7 banded on SW
 * Sheet `PUSHER OP2`:
 *     B7 = OD                                     ceiling, same shelf shape
 *     C7 = ROUND(TB + 1.5, 1)
 *     D7 = ROUND(3 + (BW - SW)/2, 2)              E7 = D7 - 2
 *
 * Note PUSHER OP2's C7 is why `TB` had to be corrected first (`searchService.js`): this
 * sheet's `TB` comes from `DIMENSION!L3`, which is `SQRT(BD^2 - SW^2)` off the **assembled**
 * SPH race width — the same one X-100 means, not XD-8's race blank.
 *
 * ── Filters ──────────────────────────────────────────────────────────────────
 * One each, deliberately. Both B/C carry the sheet's arithmetic and rank; neither
 * excludes, because a 142- and a 116-row shelf cannot absorb a second simultaneous bound
 * (X-100 ARBOR, 123 rows, went 4-of-4 to 1-of-5 on exactly that). The ceiling sentinel is
 * 999999 for the reason `20260815k_` records: a 0 would match the whole shelf, not none.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815m_ftl_op2.js --dry
 *   node db_migrations/20260815m_ftl_op2.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FTL-10(I)';
const INV = 'tooling_ftl10';

// SIN(RADIANS(3)) = 0.05234. PW is a step lookup on SW; the bands differ per sheet.
const PW_OP2 = 'if(sphWidth < 6, 2.1, if(sphWidth < 10, 1.9, 1.7))';
const OD_KEY = 'if(sphCutOd_max > 0, sphCutOd_max, 999999)';

const FAMILIES = [
  {
    tooling: 'COLLET OP2',
    data: 'ftl_collet_4501.json',
    drawing: '4501-01',
    cols: ['dim_a', 'dim_b', 'dim_c'],
    formulas: [
      ['A', OD_KEY, 0,
        'COLLET OP2 sheet A7 = OD, 「SPH 切削外径」at MAX. Not sph_od itself: sph_od plus the ' +
        'turning allowance, 0.10 nominal + 0.05 tolerance = 0.15, corroborated across the XD-8 ' +
        'sheet (0.10 on 81% of 371 rows) and this one (0.15 on 53% of 32). The 999999 guard ' +
        'keeps a part with no SPH off a ceiling rule that a 0 would satisfy wholesale.'],
      ['B', `ballWidth / 2 - ${OD_KEY} / 2 * 0.05234 + ${PW_OP2}`, 1,
        'COLLET OP2 sheet B7 = BW/2 - A/2 x SIN(RADIANS(3)) + PW, with PW banded on SW ' +
        '(<6 → 2.1, <10 → 1.9, else 1.7) from the sheet\'s own H4:J6 lookup. Rank-only: the ' +
        'sheet reads B out of the row A selected, so filtering on it filters on the answer.'],
    ],
    rules: [
      ['A', 'dim_a', null, '0', 0, 'Collet bore — smallest at or above the SPH cutting OD', true],
      ['B', 'dim_b', null, null, 1, 'Collet face', false],
    ],
  },
  {
    tooling: 'PUSHER OP2',
    data: 'ftl_pusher_4501-02.json',
    drawing: '4501-02',
    cols: ['dim_a', 'dim_b', 'dim_c', 'dim_d', 'dim_e'],
    formulas: [
      ['A', OD_KEY, 0,
        'PUSHER OP2 sheet B7 = OD, 「SPH 切削外径」at MAX — the same key as COLLET OP2, and ' +
        'the same sph_od + 0.15 allowance behind it.'],
      ['B', 'roundN(TB + 1.5, 1)', 1,
        'PUSHER OP2 sheet C7 = ROUND(TB + 1.5, 1). TB here is DIMENSION!L3 = SQRT(BD^2 - SW^2) ' +
        'off the ASSEMBLED SPH race width — the reading X-100 shares and XD-8 does not. ' +
        'Rank-only.'],
      ['C', 'roundN(3 + (ballWidth - sphWidth) / 2, 2)', 2,
        'PUSHER OP2 sheet D7 = ROUND(3 + (BW - SW)/2, 2). The sheet\'s own D is C - 2 and is ' +
        'not stored separately. Rank-only.'],
    ],
    rules: [
      ['A', 'dim_a', null, '0', 0, 'Pusher bore — smallest at or above the SPH cutting OD', true],
      ['B', 'dim_b', null, null, 1, 'Pusher mouth (とば口径 + 1.5)', false],
      ['C', 'dim_c', null, null, 2, 'Pusher step', false],
    ],
  },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0]?.id;
    if (!mid) throw new Error(`${MACHINE} not in tooling_machine — run 20260815h_ first`);

    const typeId = (await client.query(
      `SELECT id FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
      [MACHINE])).rows[0]?.id ?? null;

    for (const fam of FAMILIES) {
      log.push(`\n══ ${fam.tooling} ══`);

      const have = (await client.query(
        `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [fam.tooling])).rows[0].n;
      if (have > 0) {
        log.push(`   inventory: already ${have} rows — left alone`);
      } else {
        const rows = JSON.parse(fs.readFileSync(
          path.join(__dirname, 'data', fam.data), 'utf8'))[fam.tooling];
        // Column order below must match the values array exactly — a mismatch does not raise.
        const names = ['tooling_name', 'tooling_no', 'machine', ...fam.cols];
        const COLS = names.length;
        const ph = rows.map((_, i) =>
          `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
        const vals = rows.flatMap((r) => [
          fam.tooling, r.tooling_no, MACHINE, ...fam.cols.map((c) => r[c] ?? null),
        ]);
        await client.query(`INSERT INTO ${INV} (${names.join(', ')}) VALUES ${ph}`, vals);
        log.push(`   inventory: inserted ${rows.length} rows ` +
                 `(A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
      }

      for (const [key, expr, sort, desc] of fam.formulas) {
        const r = await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, fam.tooling, key, expr, sort, desc]);
        log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr.length > 78 ? expr.slice(0, 75) + '...' : expr}`);
      }

      for (const [key, col, plus, minus, prio, label, match] of fam.rules) {
        const r = await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
              sort_priority, label, inventory_tooling_filter, is_match_dim)
           SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$2::text,$9::boolean
            WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, fam.tooling, key, col, plus, minus, prio, label, match]);
        log.push(`   ${r.rowCount ? 'added ' : 'exists'}  rule ${key} -> ${col}  ` +
                 `${minus !== null ? '>= computed' : 'rank-only'}`);
      }

      let added = 0;
      for (const pc of ['2071', '2031']) {
        added += (await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           SELECT 'T1',$1::text,$2::text,$3::text,$4::int
            WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                               WHERE process_code=$1 AND machine_type=$2 AND tool_drawing_no=$3)
           RETURNING id`, [pc, MACHINE, fam.drawing, typeId])).rowCount;
      }
      log.push(`   sds_machine_tool: ${fam.drawing} → ${added} new`);
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
