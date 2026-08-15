'use strict';

/**
 * 20260815k_ftl_collet_op1_ceiling_sentinel.js
 *
 * Fixes a silent wrong-match: **FTL COLLET OP1 returns a collet for parts that have no
 * race at all.** Verified live before and after — C/N 110001, 110011 and 110016 are
 * bodies with no OD, ID, W or component dimension of any kind, and each was being handed
 * `4501-01-A004` / `4501-01-A015` as its two best matches.
 *
 * ── Why a ceiling rule fails open where a BETWEEN rule fails closed ──────────
 * `20260815h_` ships `A = raceOd` with a lone `tol_minus = 0`, which `searchInventory`
 * emits as `dim_a >= computed`. On a part with no race, `buildSpecContext` yields
 * `raceOd = 0` — the house absent-dimension value — so the filter becomes `dim_a >= 0`,
 * every one of the 126 shelf rows qualifies, and the combined-distance ORDER BY then
 * ranks them by `ABS(dim_a - 0)` and returns the two smallest. Nothing errors; the answer
 * is simply wrong.
 *
 * The seeding rule in `.claude/rules/tooling-select.md` already covers this ("gate a
 * tooling branch with an unmatchable sentinel, never a skipped condition_expr") but its
 * worked example is `-999`, which is correct for a `BETWEEN` and **backwards for a
 * ceiling** — `dim_a >= -999` matches even more rows than `dim_a >= 0`. A ceiling rule's
 * sentinel has to sit ABOVE every shelf value, not below it.
 *
 *     BETWEEN   (tol_plus AND tol_minus)   sentinel -999      nothing is within tolerance
 *     ceiling   (tol_minus only)           sentinel  999999   nothing is >= it
 *     floor     (tol_plus only)            sentinel -999      nothing is <= it
 *
 * COLLET OP1's shelf tops out at A = 56.06, so 999999 can never be reached by a real
 * collet and the tooling correctly returns no match.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815k_ftl_collet_op1_ceiling_sentinel.js --dry
 *   node db_migrations/20260815k_ftl_collet_op1_ceiling_sentinel.js
 */

const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'FTL-10(I)';
const TOOLING = 'COLLET OP1';

const EXPR = 'if(raceOd > 0, raceOd, 999999)';
const DESC =
  'COLLET OP1 sheet A7 = RD, the race outside diameter (RD == lpb.eng_race.od, 88% on the ' +
  "workbook's own C/N sheet, 95% against J-WAVE's ROD). The guard is not part of the sheet: " +
  'the search rule is a ceiling (dim_a >= A), so a part with no race would compute A = 0 and ' +
  'match the whole shelf. 999999 sits above every collet on it, so such a part matches nothing.';

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const mid = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0]?.id;
    if (!mid) throw new Error(`${MACHINE} not in tooling_machine — run 20260815h_ first`);

    const before = (await client.query(
      `SELECT formula_expr FROM tooling_formula
        WHERE machine_id = $1 AND tooling_name = $2 AND output_key = 'A'`,
      [mid, TOOLING])).rows[0];
    if (!before) throw new Error(`${TOOLING} A formula not found — run 20260815h_ first`);

    if (before.formula_expr === EXPR) {
      log.push(`── formula ──\n   already guarded: ${EXPR}`);
    } else {
      await client.query(
        `UPDATE tooling_formula SET formula_expr = $1, description = $2
          WHERE machine_id = $3 AND tooling_name = $4 AND output_key = 'A'`,
        [EXPR, DESC, mid, TOOLING]);
      log.push(`── formula ──\n   was: ${before.formula_expr}\n   now: ${EXPR}`);
    }

    const top = (await client.query(
      `SELECT max(dim_a)::numeric m FROM tooling_ftl10 WHERE tooling_name = $1`, [TOOLING])).rows[0].m;
    log.push(`\n── sanity ──\n   largest COLLET OP1 dim_a on the shelf: ${top} (sentinel 999999 is unreachable)`);

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
