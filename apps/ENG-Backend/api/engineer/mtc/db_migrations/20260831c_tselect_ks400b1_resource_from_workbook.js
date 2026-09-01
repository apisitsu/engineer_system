'use strict';

/**
 * KS-400B1 — re-source PLUG / WORK DRIVER formulas from the 4664 workbook (2026-08-31).
 * ============================================================================
 * `20260831_` and `20260831b_` raised these families with search-rule changes plus
 * two fitted constants. Reading the actual cell formulas in
 * `doc/tooling_calc_blocks/4664/source.xlsx` (DIMENSION + WORK DIRVER + PLUG sheets)
 * showed the fits were standing in for the real rule:
 *
 *  • The workbook's PLUG A input is DIMENSION!O5+Q5 = TURNING (before-grind) ID at
 *    its minimum — NOT after-grind ID. Reproduced against the sheet's own P/N list:
 *    with idBf_min, PLUG(A) A is exact on 78% of shelf rows (median 0.000); with
 *    idAft_min, median -0.093 / 61% within 0.1. So the -0.07..-0.25 bias the fits
 *    corrected was a wrong input variable, not a wrong formula.
 *
 *  • WORK DRIVER A is CEILING(SD-0.5, 0.5) and the pick is MAX(shelf_A <= A) —
 *    a CEILING lookup. `20260831_` changed it to floor05 + BETWEEN ±1.0, which
 *    scored well by luck. ceil05 + a ceiling search rule is the real rule and
 *    scores better (top-2 80.8% vs 79%).
 *
 * Changes (each reverts to its immediately-prior value):
 *  1. PLUG(A) A  — idAft_min  ->  if(idBf>0, idBf_min, idAft_min)   [×0.7 / −4.0]
 *                  measured top-2 71.0% (was 70.8%), formula now matches the sheet.
 *  2. PLUG(B) A  — after-grind fit  ->  before-grind input, drawing −0.7 branch
 *                  plus a documented +(-0.13) residual measured from 71 shelf rows
 *                  (our id_bf sync is not byte-identical to the sheet's O5).
 *                  -> if(idBf>0, if(idBf_min<20, idBf_min-0.83, idBf_min-1.13),
 *                                <the 20260831b_ after-grind fallback>)
 *  3. WORK DRIVER A formula — floor05(SD-0.5) -> ceil05(SD-0.5)  (the sheet's CEILING)
 *  4. WORK DRIVER A search rule — BETWEEN ±1.0 -> ceiling (tol_plus 0, tol_minus 3)
 *
 * Idempotent (skips a change already applied). `--revert` restores the values
 * below (i.e. the 20260831_ / 20260831b_ state). `--dry-run` rolls back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831c_tselect_ks400b1_resource_from_workbook.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831c_tselect_ks400b1_resource_from_workbook.js
 *   node api/engineer/mtc/db_migrations/20260831c_tselect_ks400b1_resource_from_workbook.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const IDB = 'if(idBf > 0, idBf_min, idAft_min)';

// [formula_id, label, oldExpr, newExpr]
const FORMULAS = [
  [417, 'PLUG(A) A',
    'if(idAft_min < 20, idAft_min * 0.7, idAft_min - 4.0)',
    `if(${IDB} < 20, ${IDB} * 0.7, ${IDB} - 4.0)`],
  [423, 'PLUG(B) A',
    'if(idAft_min < 20, idAft_min - 0.95, idAft_min - 1.25)',
    'if(idBf > 0, if(idBf_min < 20, idBf_min - 0.83, idBf_min - 1.13), if(idAft_min < 20, idAft_min - 0.95, idAft_min - 1.25))'],
  [434, 'WORK DRIVER A',
    'floor05(SD - 0.5)',
    'ceil05(SD - 0.5)'],
];

// WORK DRIVER A search rule (id 88): BETWEEN ±1.0  ->  ceiling
const WD_RULE = { id: 88, old: { p: '1', m: '1.0' }, neu: { p: '0', m: '3' } };

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    for (const [id, label, oldExpr, newExpr] of FORMULAS) {
      const from = revert ? newExpr : oldExpr;
      const to = revert ? oldExpr : newExpr;
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr = $2 WHERE id = $1 AND formula_expr = $3`,
        [id, to, from]);
      console.log(`[rsrc] ${label} ${r.rowCount ? '-> ' + to : 'not at expected value — skip'}`);
    }

    {
      const from = revert ? WD_RULE.neu : WD_RULE.old;
      const to = revert ? WD_RULE.old : WD_RULE.neu;
      const r = await client.query(
        `UPDATE tooling_search_rule SET tol_plus = $2, tol_minus = $3
         WHERE id = $1 AND tol_plus = $4 AND tol_minus = $5`,
        [WD_RULE.id, to.p, to.m, from.p, from.m]);
      console.log(`[rsrc] WORK DRIVER A search rule ${r.rowCount ? `-> tol_plus ${to.p} / tol_minus ${to.m}` : 'not at expected value — skip'}`);
    }

    if (dryRun) { console.log('[rsrc] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[rsrc] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[rsrc] FAILED:', e.message); process.exit(1); });
