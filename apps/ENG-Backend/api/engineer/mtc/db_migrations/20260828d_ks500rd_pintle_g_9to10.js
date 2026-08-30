'use strict';

/**
 * `tooling_formula` — KS-500RD LOADING PINTLE, output G: 9 → 10.
 * ------------------------------------------------------------------------------
 * Phase B (formula vs workbook, `api/engineer/mtc/doc/tooling_calc_blocks/4033.md`) found the config
 * computes `G = if(ID <= 24.5, 9, 20)` where the current workbook design of the pintle
 * (`PINTLE.pdf`, `IDに依存` per-P/N table) uses **10** in the ID ≤ 24.5 band, not 9:
 *
 *   3SR16-T   ID 16     G 10        3ABK14DON-T ID 22.225  G 10
 *   3ABT16(R)-T ID 25.4  G 20        3MBT28-T    ID 28      G 20
 *
 * `9` appears only on the older `4033-02-0011 / -0012` (S00178) pintles — a superseded
 * generation. The modern shelf is 10 / 20.
 *
 * WHY THIS IS SAFE — and why the measurable effect is ~0:
 * `G` is `tooling_search_rule` `dim_g`, **`is_match_dim = false`, `sort_priority = 7`** —
 * it is rank-only and near-last. It cannot change which pintles pass the search (it is
 * not a filter); it only nudges the tie-break order among candidates that already
 * qualify on A (±1.5 match) and H (±1.5 match). So this brings the formula in line with
 * the workbook without any risk of a selection regression — a correctness fix, not a
 * performance fix.
 *
 * The other Phase B nit on this tooling — `A`/`B` using integer `round()` where the
 * workbook rounds to 1 dp — is intentionally NOT touched here: `A` IS a match dim, so
 * shifting it by up to 0.2 changes the ±1.5 window edges, and that should be verified
 * against `eval_tooling_accuracy.js` before shipping.
 *
 * Idempotent; `--revert` restores `9`.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260828d_ks500rd_pintle_g_9to10.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260828d_ks500rd_pintle_g_9to10.js
 *   node api/engineer/mtc/db_migrations/20260828d_ks500rd_pintle_g_9to10.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const OLD = 'if(ID <= 24.5, 9, 20)';
const NEW = 'if(ID <= 24.5, 10, 20)';
const WHERE = `machine_id = (SELECT id FROM tooling_machine WHERE machine_name = 'KS-500RD')
               AND tooling_name = 'LOADING PINTLE' AND output_key = 'G'`;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    const from = revert ? NEW : OLD;
    const to = revert ? OLD : NEW;

    const { rows: cur } = await client.query(
      `SELECT id, formula_expr FROM tooling_formula WHERE ${WHERE}`);
    if (!cur.length) { console.log('[pintle-G] no matching row — nothing to do'); }
    console.log(`[pintle-G] current: ${cur.map((r) => `#${r.id} "${r.formula_expr}"`).join(' ')}`);

    if (cur.length && cur[0].formula_expr === to) {
      console.log(`[pintle-G] already "${to}" — nothing to do`);
      revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
      return;
    }
    if (cur.length && cur[0].formula_expr !== from) {
      throw new Error(`unexpected formula "${cur[0].formula_expr}" (expected "${from}") — aborting`);
    }
    console.log(`[pintle-G] "${from}"  ->  "${to}"`);
    if (dryRun) { console.log('[pintle-G] --dry-run — no changes written'); return; }

    const { rowCount } = await client.query(
      `UPDATE tooling_formula SET formula_expr = $1, updated_at = NOW() WHERE ${WHERE} AND formula_expr = $2`,
      [to, from]);
    console.log(`[pintle-G] ${rowCount} row updated`);
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[pintle-G] FAILED:', e.message); process.exit(1); });
