'use strict';

/**
 * `sds_grid_template.grid_json` — un-right-align the UNIT columns (D and I) in the
 * GRIND CONDITION / DRESS CONDITION block (rows ~15-58).
 * ------------------------------------------------------------------------------
 * Reported live on CN314110 (KS-B80): the unit text ("mm", "mm/s", "time", …) sits far
 * from its own value and hugs the NEXT field instead. Root cause is the same shape as
 * `20260915_` / `20260921b_` (CUTTING CONDITION column D truncation) but the other half
 * of the SAME problem, on rows those two migrations never touched:
 *
 *   row_N_C = the NUMBER (right-aligned — correct, numbers read right-to-left)
 *   row_N_D = the UNIT   ("mm" etc.) — ALSO right-aligned, which pins it to the far edge
 *             of its own (55-unit-wide) column instead of the edge next to the value it
 *             describes. The visible gap is the whole width of column D; "mm" instead
 *             sits flush against column E (label2 of the NEXT field group, e.g.
 *             "#12 SPARK OUT 2"), reading as if it belongs to the wrong field.
 *   row_N_H = the second group's NUMBER (right-aligned — correct)
 *   row_N_I = the second group's UNIT — same problem, and untouched by any earlier fix.
 *
 * `20260915_`/`20260921b_` only stripped column D's right-align on the rows holding the
 * long "(Control … is not more than …)" SENTENCE (22-26, 36-46/48-55) — a truncation bug,
 * not a unit-placement one — and never touched column I at all. This migration covers
 * the remaining rows (verified live per template: template 1 D={15-21,27-35,47,56-58},
 * I=every row 16-58; template 4 D={15-21,27-39,47,56-58}, I=every row 16-58) so the
 * ENTIRE unit-column range is now left-aligned, consistent with the two already-fixed
 * sentence rows.
 *
 * Dropping `a.h` (→ default 'left') makes the unit text hug its value with a small gap
 * and leaves the rest of its own cell's width empty on the right — the normal
 * "0.070 mm" reading. Column C/H (the numbers) are untouched.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261017b_sds_grind_dress_unit_column_alignment.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261017b_sds_grind_dress_unit_column_alignment.js
 *   node api/engineer/mtc/db_migrations/20261017b_sds_grind_dress_unit_column_alignment.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_grid_template';
const BACKUP = 'sds_grid_template_backup_20261017_grind_dress_unit_align';
const TEMPLATE_IDS = [1, 4];
const COL_D = 3; // 0-based
const COL_I = 8;
const ROW_RANGE = { from: 15, to: 58 }; // scan the whole block; only touches cells that are still a.h='right'
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function stripRightAlign(grid) {
  let changed = 0;
  const cells = grid.cells || {};
  for (let rowNum = ROW_RANGE.from; rowNum <= ROW_RANGE.to; rowNum++) {
    for (const col of [COL_D, COL_I]) {
      const key = `${rowNum - 1},${col}`;
      const cell = cells[key];
      if (cell && cell.a && cell.a.h === 'right') {
        const { h, ...restA } = cell.a;
        cells[key] = { ...cell, a: restA };
        changed++;
      }
    }
  }
  return changed;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const { rows } = await client.query(`SELECT to_regclass($1) AS t`, [BACKUP]);
      if (!rows[0].t) { console.log(`[revert] no ${BACKUP} — nothing to restore`); await recordRevert({ file: __filename }); return; }
      await client.query('BEGIN');
      await client.query(
        `UPDATE ${TABLE} t SET grid_json = b.grid_json
           FROM ${BACKUP} b WHERE b.id = t.id AND b.grid_json IS DISTINCT FROM t.grid_json`);
      await client.query(`DROP TABLE ${BACKUP}`);
      await client.query('COMMIT');
      console.log('[revert] grid_json restored from backup; backup dropped');
      await recordRevert({ file: __filename });
      return;
    }

    const toUpdate = [];
    for (const id of TEMPLATE_IDS) {
      const { rows: t } = await client.query(`SELECT id, name, grid_json FROM ${TABLE} WHERE id = $1`, [id]);
      if (!t[0]) { console.log(`[fix] template ${id} not found, skipped`); continue; }
      const grid = JSON.parse(t[0].grid_json);
      const changed = stripRightAlign(grid);
      console.log(`[fix] ${id} ${t[0].name}: ${changed} cell(s) to change`);
      if (changed) toUpdate.push({ id, grid_json: JSON.stringify(grid) });
    }

    if (!toUpdate.length) { console.log('[fix] already correct — nothing to do'); await recordRun({ file: __filename }); return; }
    if (dryRun) { console.log('\n[fix] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS ${BACKUP}`);
    await client.query(`CREATE TABLE ${BACKUP} AS SELECT *, now() AS _backed_up_at FROM ${TABLE} WHERE id = ANY($1)`,
      [toUpdate.map((t) => t.id)]);
    for (const t of toUpdate) {
      await client.query(`UPDATE ${TABLE} SET grid_json = $1, updated_at = NOW() WHERE id = $2`, [t.grid_json, t.id]);
    }
    await client.query('COMMIT');
    console.log(`\n[fix] ${toUpdate.length} template(s) updated · backup → ${BACKUP}`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[fix] FAILED:', e.message); process.exit(1); });
