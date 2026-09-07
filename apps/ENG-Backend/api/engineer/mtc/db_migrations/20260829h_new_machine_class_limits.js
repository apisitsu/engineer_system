'use strict';

/**
 * Round-7 fix — the 6 machines onboarded 2026-08-29 (`20260829e/f/g_`) had NO
 * `tooling_machine_limit`, so `search()` ran their full formula + inventory +
 * similar-ref + fallback passes for EVERY part. On a heavy SPH C/N (e.g. 414303,
 * 15 processes) that added ~8 s → total ~16 s → past the frontend's 10 s timeout →
 * "Search failed". None of the 6 actually serves that C/N's class.
 *
 * `checkMachineLimits` evaluates `ctx[input_var]` for ANY context key, and
 * `buildSpecContext` exposes `cnPrefix` (the 2-digit CN class). So a
 * `input_var = 'cnPrefix'` limit gates a machine to its real part-class window —
 * an excluded machine is dropped in Phase 1 and skips every downstream pass.
 *
 * Windows chosen from each machine's own cn-map class histogram (generous — a few
 * <2 % strays in an out-of-window class lose their pin, which the audit accepts):
 *
 *   QTN200      cnPrefix 11–39   (bodies + a few 25/39 race/ball)
 *   TM330       cnPrefix 11–19   (F/M bodies)
 *   1MP-H       cnPrefix 11–19   (bodies; drops 2 class-81 rows)
 *   NSV-1555FE  cnPrefix 11–19   (bodies; drops 4 class-58 rows)
 *   DTS-IS      cnPrefix 31–39   (SPH ball components — NOT the 4x assembly)
 *   その他       cnPrefix 61–99   (sleeves + 99; drops 2 class-19 rows)
 *
 * 414303 is class 41 → excluded by all six.
 *
 * Idempotent (delete+reinsert the cnPrefix limit per machine). `--revert` removes them.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829h_new_machine_class_limits.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829h_new_machine_class_limits.js
 *   node api/engineer/mtc/db_migrations/20260829h_new_machine_class_limits.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const LIMITS = [
  ['QTN200', 11, 39],
  ['TM330', 11, 19],
  ['1MP-H', 11, 19],
  ['NSV-1555FE', 11, 19],
  ['DTS-IS', 31, 39],
  ['その他', 61, 99],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, lo, hi] of LIMITS) {
      const m = await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [name]);
      if (!m.rows.length) { console.log(`[classlim] ${name} — machine missing, skip`); continue; }
      const mid = m.rows[0].id;
      await client.query(
        `DELETE FROM tooling_machine_limit WHERE machine_id = $1 AND input_var = 'cnPrefix'`, [mid]);
      if (!revert) {
        await client.query(
          `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, description)
           VALUES ($1, 'cnPrefix', $2, $3, $4)`,
          [mid, lo, hi, `round-7: gate to CN class ${lo}–${hi} (own cn-map histogram) — perf + cross-class noise`]);
      }
      console.log(`[classlim] ${name} ${revert ? '- removed' : `cnPrefix ${lo}–${hi}`}`);
    }
    if (dryRun) { console.log('[classlim] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[classlim] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[classlim] FAILED:', e.message); process.exit(1); });
