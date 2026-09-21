'use strict';

/**
 * `sds_grid_template.grid_json` (id 8, "Turning") — fix "Maket :" typo, should be
 * "Maker :". ------------------------------------------------------------------------
 * The label came straight from the source workbook: all 8 F0N Maker-label cells
 * (Y25/AD25, Y36/AD36, Y47/AD47, Y58/AD58 — one row below each F01/03/05/07 and
 * F02/04/06/08 badge, right where the value cells AA/AG hold the T-Select-driven
 * `maker_T0N`) carry the literal text "Maket :" instead of "Maker :". Reported live.
 *
 * Idempotent: only rewrites a cell whose value is exactly "Maket :"; a re-run after the
 * first fix finds nothing left to change. `--revert` restores the typo (no reason to use
 * this outside testing the migration itself).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260917_fix_turning_maker_label_typo.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260917_fix_turning_maker_label_typo.js
 *   node api/engineer/mtc/db_migrations/20260917_fix_turning_maker_label_typo.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TEMPLATE_ID = 8;
const TARGETS = ['Y25', 'AD25', 'Y36', 'AD36', 'Y47', 'AD47', 'Y58', 'AD58'];
const WRONG = 'Maket :';
const RIGHT = 'Maker :';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function colIdx(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    const { rows } = await client.query(`SELECT grid_json FROM ${'sds_grid_template'} WHERE id = $1`, [TEMPLATE_ID]);
    if (!rows[0]) { console.log(`[fix] template id=${TEMPLATE_ID} not found`); return; }
    const grid = JSON.parse(rows[0].grid_json);
    const from = revert ? RIGHT : WRONG;
    const to = revert ? WRONG : RIGHT;
    let changed = 0;
    for (const addr of TARGETS) {
      const m = addr.match(/^([A-Z]+)(\d+)$/);
      const key = `${parseInt(m[2], 10) - 1},${colIdx(m[1])}`;
      const cell = grid.cells[key];
      if (!cell || cell.v !== from) continue;
      grid.cells[key] = { ...cell, v: to };
      changed++;
    }
    console.log(`[fix] ${changed} cell(s) to change (${revert ? 'restore typo' : 'fix typo'})`);
    if (!changed) { await (revert ? recordRevert : recordRun)({ file: __filename }); return; }
    if (dryRun) { console.log('[fix] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    await client.query(`UPDATE sds_grid_template SET grid_json = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(grid), TEMPLATE_ID]);
    await client.query('COMMIT');
    console.log(`[fix] template id=${TEMPLATE_ID} updated`);
    await (revert ? recordRevert : recordRun)({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[fix] FAILED:', e.message); process.exit(1); });
