'use strict';

/**
 * 20260815g_x100_arbor_d.js
 *
 * Ships **X-100 ARBOR dimension D**, which `20260814d_x100_sph_arbor.js` deliberately left
 * out because the spec context could not supply its inputs. `20260815f_` added them.
 *
 * The rule, from the ARBOR sheet's row 20:
 *
 *     D = ROUNDUP((BALL BW − SPH SW) / 2 + 0.5, 1)
 *
 * ── Which column is SPH SW, settled by measurement ───────────────────────────
 * `SW` could plausibly have been the race width or the SPH's own width. Computing D both
 * ways over the 5,165 spec rows that now carry ball and SPH dimensions, and checking each
 * result against the 121 arbors on the shelf that have a D:
 *
 *     (ballWidth − sphWidth)  / 2 + 0.5   →  87 % land exactly on a shelf value, 92 % within 0.1
 *     (ballWidth − raceWidth) / 2 + 0.5   →  59 % exactly, 75 % within 0.1
 *
 * So SW is the **SPH width**. 87 % exact reproduction is far above the 70–81 % that A/B/C
 * managed at the original seeding, which is the expected signature of a correct rule
 * rather than tooling reuse.
 *
 * ── B still cannot ship ──────────────────────────────────────────────────────
 * `B = ROUNDUP(SPH TB + 0.4, 1)` needs とば口径, and no column in eng_sph_design, eng_race,
 * eng_ball or eng_sleeve reproduces it. B stays out; do not substitute a near-name.
 *
 * ── Tolerance ────────────────────────────────────────────────────────────────
 * ±0.3, tighter than A's ±0.2 would suggest only because D is a step rather than a fit —
 * but at 87 % exact it can carry a real filter, and narrowing the candidate set is the
 * whole point of adding it. A (the bore) stays the primary ranking dimension.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815g_x100_arbor_d.js --dry
 *   node api/engineer/mtc/db_migrations/20260815g_x100_arbor_d.js
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
       SELECT $1,$2::text,'D'::text,$3::text,2,$4::text
        WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                           WHERE machine_id=$1 AND tooling_name=$2 AND output_key='D')
       RETURNING id`,
      [mid, TOOLING, 'ceilN((ballWidth - sphWidth) / 2 + 0.5, 1)',
        'X-100 ARBOR sheet row 20: D = ROUNDUP((BALL BW − SPH SW) / 2 + 0.5, 1). SW is the SPH width, not the race width — 87% of computed values land exactly on a shelf D against 59% for race width.']);
    log.push(`── formula ──\n   ${f.rowCount ? 'added ' : 'exists'}  D = ceilN((ballWidth - sphWidth) / 2 + 0.5, 1)`);

    const r = await client.query(
      `INSERT INTO tooling_search_rule
         (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
          sort_priority, label, inventory_tooling_filter, is_match_dim)
       SELECT $1,$2::text,'D'::text,'dim_d'::text,0.3,0.3,2,$3::text,$2::text,true
        WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                           WHERE machine_id=$1 AND tooling_name=$2 AND output_key='D')
       RETURNING id`, [mid, TOOLING, 'Arbor step ((BALL BW − SPH SW)/2 + 0.5)']);
    log.push(`── search rule ──\n   ${r.rowCount ? 'added ' : 'exists'}  D -> dim_d  ±0.3`);

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
