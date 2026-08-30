'use strict';

/**
 * Add the RE33xxx §7 対象ワークサイズ limits for the three 組切削 machines that had
 * NONE — found 2026-08-29 when the RE PDFs were re-checked against the config
 * (the 2026-08-14 conformance pass predated these seven standards being vendored).
 *
 *   X-100      RE33039 A §7 — SPH 外径 (OD) ≤ φ60 (手動サイズ; 自動 ≤ φ41.275)
 *   XD-8       RE33040 A §7 — SPH 外径 (OD) ≤ φ41.275 · ボール巾 (W1) ≤ 32.51
 *   FTL-10(I)  RE33026 A §7 — D 切削後外径 (OD) ≤ φ50
 *   1MP-H      RE33034 B §7 — シャンク径 ≤ φ25   (harmless: female_shankdia is
 *              NULL on most bodies → checkMachineLimits skips a NULL input_var)
 *
 * Verified against `lpb.eng_r_pi_tool`: **0 planned C/N exceed OD** on any of the
 * three (X-100 max 59.5, XD-8 max 41.275, FTL max 44.45) and 0 exceed XD-8's
 * ballWidth. NOT added, standard behind practice:
 *   - X-100 ballWidth ≤ 32.51 — 15 planned C/N over (max 40)
 *   - TM330 (RE33036 C) シャンク径 ≤ 25 — 9 planned C/N over (max 30.15)
 * The cnPrefix limits from `20260829h_` already scope 1MP-H / TM330 to bodies.
 *
 * `input_var` values map to buildSpecContext keys: OD, ballWidth, shankDia.
 * Idempotent (delete+reinsert by (machine, input_var)). `--revert` removes them.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829i_re33_worksize_limits.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829i_re33_worksize_limits.js
 *   node api/engineer/mtc/db_migrations/20260829i_re33_worksize_limits.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// [machine, input_var, min, max, description]
const LIMITS = [
  ['X-100', 'OD', null, '60', 'RE33039 A §7: SPH 外径 (OD) ≤ φ60 (手動; 自動供給 ≤ φ41.275)'],
  ['XD-8', 'OD', null, '41.275', 'RE33040 A §7: SPH 外径 (OD) ≤ φ41.275'],
  ['XD-8', 'ballWidth', null, '32.51', 'RE33040 A §7: ボール巾 (W1) ≤ 32.51'],
  ['FTL-10(I)', 'OD', null, '50', 'RE33026 A §7: D 切削後外径 (OD) ≤ φ50'],
  ['1MP-H', 'shankDia', null, '25', 'RE33034 B §7: シャンク径 ≤ φ25 (skipped when female_shankdia NULL)'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, varr, lo, hi, desc] of LIMITS) {
      const m = await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [name]);
      if (!m.rows.length) { console.log(`[re33lim] ${name} missing — skip`); continue; }
      const mid = m.rows[0].id;
      await client.query(
        `DELETE FROM tooling_machine_limit WHERE machine_id = $1 AND input_var = $2`, [mid, varr]);
      if (!revert) {
        await client.query(
          `INSERT INTO tooling_machine_limit (machine_id, input_var, min_value, max_value, description)
           VALUES ($1, $2, $3, $4, $5)`, [mid, varr, lo, hi, desc]);
      }
      console.log(`[re33lim] ${name} ${varr} ${revert ? '- removed' : `≤ ${hi}`}`);
    }
    if (dryRun) { console.log('[re33lim] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[re33lim] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[re33lim] FAILED:', e.message); process.exit(1); });
