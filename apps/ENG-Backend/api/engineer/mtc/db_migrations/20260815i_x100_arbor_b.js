'use strict';

/**
 * 20260815i_x100_arbor_b.js
 *
 * Ships **X-100 ARBOR dimension B**, the last of the four the sheet computes and the one
 * left out twice — first because the spec context had no component dimensions at all, then
 * because とば口径 could not be found in any factory table.
 *
 *     B = ROUNDUP(SPH TB + 0.4, 1)
 *
 * ── とば口径 is not stored anywhere, and does not need to be ─────────────────
 * It is a **race** dimension (the XD-8 workbook's dimension table groups it under RACE,
 * beside RACE WIDTH), but `lpb.eng_race` has no column for it — od, width, id, chaner and
 * mating_ball were each scored against 366 matched rows and none comes close.
 *
 * It is derivable instead. A race of width RW wrapped around a sphere of diameter BD
 * leaves a circular mouth of exactly:
 *
 *     TB = sqrt(BD² − RW²)
 *
 * Checked against the 503 C/N rows of the XD-8 workbook's own DIMENSION sheet, which lists
 * TB directly: **96.6 % land within 0.01 mm, median error 0.003 mm**. That is a geometric
 * identity showing through rather than a fitted curve — the residual is the usual spec
 * revision drift. `buildSpecContext` now exposes it as `TB`, computed from `ball_dia` and
 * `race_width`, both synced by `20260815f_`. 2,679 spec rows can produce it.
 *
 * ── B ranks, it does not exclude ─────────────────────────────────────────────
 * The formula is sound — computed B lands within 0.5 of a shelf value on 93 % of the 2,679
 * eligible parts (within 0.3 on 87 %), comparable to D's 96 %. But A, C, D and B must all
 * hit the *same* arbor, and a fourth simultaneous filter over a 123-row shelf empties the
 * result: adding B as a filter dropped a 4-of-4 sample to 1-of-5.
 *
 * So B carries no tolerance. It still feeds the ranking, so an arbor matching on the mouth
 * wins over one that does not, but it can never zero the result. This is the same call
 * STOCKER CHUTE made for its C and D — a derived dimension should not discard a tool that
 * fits on the dimensions that actually matter.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815i_x100_arbor_b.js --dry
 *   node api/engineer/mtc/db_migrations/20260815i_x100_arbor_b.js
 */

const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'X-100';
const TOOLING = 'ARBOR';

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0].id;

    const f = await client.query(
      `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
       SELECT $1,$2::text,'B'::text,$3::text,3,$4::text
        WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                           WHERE machine_id=$1 AND tooling_name=$2 AND output_key='B')
       RETURNING id`,
      [mid, TOOLING, 'ceilN(TB + 0.4, 1)',
        'X-100 ARBOR sheet row 20: B = ROUNDUP(SPH TB + 0.4, 1). とば口径 is stored in no factory table; it is derived as sqrt(ball_dia^2 - race_width^2), which reproduces the XD-8 workbook TB column within 0.01mm on 96.6% of its 503 rows.']);
    log.push(`── formula ──\n   ${f.rowCount ? 'added ' : 'exists'}  B = ceilN(TB + 0.4, 1)`);

    const r = await client.query(
      `INSERT INTO tooling_search_rule
         (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
          sort_priority, label, inventory_tooling_filter, is_match_dim)
       SELECT $1,$2::text,'B'::text,'dim_b'::text,NULL,NULL,3,$3::text,$2::text,false
        WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                           WHERE machine_id=$1 AND tooling_name=$2 AND output_key='B')
       RETURNING id`, [mid, TOOLING, 'Arbor mouth (SPH TB + 0.4)']);
    log.push(`── search rule ──\n   ${r.rowCount ? 'added ' : 'exists'}  B -> dim_b  rank-only`);

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
