'use strict';

/**
 * KS-400B1 PLUG(B) A — correct the input, drop the fitted residual (2026-08-31).
 * ============================================================================
 * `20260831c_` set PLUG(B) A to a before-grind input with a `< 20` split and
 * fitted constants (-0.83 / -1.13). Measured against `lpb.eng_r_pi_tool` with the
 * live ranking rules it scores **45.6% top-2** — a regression (baseline 49.6%,
 * `20260831b_` fitted form 75.2%). The `-1.13` branch over-shrinks every plug
 * with idBf_min ≥ 20.
 *
 * This sets PLUG(B) A to the plain re-sourced form: the workbook's before-grind
 * ID input (DIMENSION!O5+Q5 = idBf_min) with the drawing's own -0.7 constant,
 * falling back to after-grind ID when id_bf is NULL. Measured: **68.8% top-2**.
 * That is below the 75.2% of the plan-fitted `-0.95` but it is fully traceable to
 * the 4664 workbook — the re-sourcing goal. The remaining ~0.13 median residual
 * is a known id_bf sync gap, left documented rather than fitted out.
 *
 * Idempotent. `--revert` restores the `20260831c_` value. `--dry-run` rolls back.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831d_tselect_plugb_a_fix.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831d_tselect_plugb_a_fix.js
 *   node api/engineer/mtc/db_migrations/20260831d_tselect_plugb_a_fix.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const ID = 423;
const FROM_C = 'if(idBf > 0, if(idBf_min < 20, idBf_min - 0.83, idBf_min - 1.13), if(idAft_min < 20, idAft_min - 0.95, idAft_min - 1.25))';
const SOURCED = 'if(idBf > 0, idBf_min - 0.7, idAft_min - 0.7)';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const from = revert ? SOURCED : FROM_C;
    const to = revert ? FROM_C : SOURCED;
    const r = await client.query(
      `UPDATE tooling_formula SET formula_expr = $2 WHERE id = $1 AND formula_expr = $3`,
      [ID, to, from]);
    console.log(`[plugbfix] PLUG(B) A ${r.rowCount ? '-> ' + to : 'not at expected value — skip'}`);

    if (dryRun) { console.log('[plugbfix] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[plugbfix] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[plugbfix] FAILED:', e.message); process.exit(1); });
