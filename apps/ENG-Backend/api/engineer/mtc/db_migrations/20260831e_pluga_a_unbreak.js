'use strict';

/**
 * KS-400B1 PLUG(A) A — un-break the formula shipped in 20260831c_ (2026-08-31).
 * ============================================================================
 * `20260831c_` set PLUG(A) A to:
 *   if(if(idBf > 0, idBf_min, idAft_min) < 20, if(idBf > 0, ...) * 0.7, if(idBf > 0, ...) - 4.0)
 * i.e. a nested if() *inside the condition* of an outer if(). That form hangs
 * `expr-eval` in formulaService.computeDimensions — a single-CN eval never
 * returns — which would hang the live /search request for any PLUG(A) part.
 *
 * This rewrites it as a nested if() used only for the BRANCH VALUES (the same
 * shape 20260831b_ used safely for PLUG(B)), keeping the intended re-sourced
 * meaning: before-grind ID at minimum (DIMENSION!O5+Q5), after-grind fallback,
 * with the workbook's own IF(ID<20, ID*0.7, ID-4) split on each side:
 *   if(idBf > 0,
 *      if(idBf_min  < 20, idBf_min  * 0.7, idBf_min  - 4.0),
 *      if(idAft_min < 20, idAft_min * 0.7, idAft_min - 4.0))
 *
 * Idempotent. `--revert` restores the (broken) 20260831c_ string. `--dry-run`
 * rolls back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831e_pluga_a_unbreak.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831e_pluga_a_unbreak.js
 *   node api/engineer/mtc/db_migrations/20260831e_pluga_a_unbreak.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const ID = 417;
const BROKEN = 'if(if(idBf > 0, idBf_min, idAft_min) < 20, if(idBf > 0, idBf_min, idAft_min) * 0.7, if(idBf > 0, idBf_min, idAft_min) - 4.0)';
const FIXED = 'if(idBf > 0, if(idBf_min < 20, idBf_min * 0.7, idBf_min - 4.0), if(idAft_min < 20, idAft_min * 0.7, idAft_min - 4.0))';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const from = revert ? FIXED : BROKEN;
    const to = revert ? BROKEN : FIXED;
    const r = await client.query(
      `UPDATE tooling_formula SET formula_expr = $2 WHERE id = $1 AND formula_expr = $3`,
      [ID, to, from]);
    console.log(`[unbreak] PLUG(A) A ${r.rowCount ? '-> ' + to : 'not at expected value — skip'}`);

    if (dryRun) { console.log('[unbreak] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[unbreak] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[unbreak] FAILED:', e.message); process.exit(1); });
