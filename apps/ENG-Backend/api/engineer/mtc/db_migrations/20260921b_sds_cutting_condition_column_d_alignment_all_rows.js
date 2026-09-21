'use strict';

/**
 * `sds_grid_template.grid_json` — finish the CUTTING CONDITION column D right-alignment fix.
 * ------------------------------------------------------------------------------
 * `20260915_sds_cutting_condition_column_d_alignment.js` only covered rows 22-26 (the
 * TSG-300W / HAMAI 5B block that was reported at the time) and assumed no other machine
 * used the sentence there. Reported again from OC-16A ("(Contr." on every "Nth Time" row of
 * the centerless sheet): the same "(Control Roughness/Roundness is not more than ..." sentence
 * lives in column D on many more rows, on machines using both templates —
 *   Standard (id 1):   rows 36-46, 48-55   (KVD-300CRII, KVD350S, GS-64PFII, MSG-410, PSG-64,
 *                                            HI-GRIND-1-D)
 *   Centerless (id 4): rows 40-46, 48-55   (OC-16A, OC-18BR-150, OC-20BR-200, HI-GRIND-1-D)
 * Same root cause: a right-aligned cell may only spill LEFT (into the occupied "mm" cell), so the
 * sentence is clipped to D's own ~7mm. Columns E/F/G are empty on every one of these rows
 * (checked against grid_json), so left alignment lets it spill right into free space.
 *
 * The row lists come from `sds_parameter` (every `row_N_D` holding "(Control ...") joined to the
 * machine's template — a machine with no assigned template uses the default (Standard, id 1).
 * Only cells still `a.h === 'right'` are touched, so this is idempotent and skips 22-26.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260921b_sds_cutting_condition_column_d_alignment_all_rows.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260921b_sds_cutting_condition_column_d_alignment_all_rows.js
 *   node api/engineer/mtc/db_migrations/20260921b_sds_cutting_condition_column_d_alignment_all_rows.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_grid_template';
const BACKUP = 'sds_grid_template_backup_20260921_cutting_cond_align_all';
const COL_D = 3;
const ROWS_BY_TEMPLATE = {
  1: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55],
  4: [40, 41, 42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55],
};
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function stripRightAlign(grid, rows) {
  let changed = 0;
  const cells = grid.cells || {};
  for (const rowNum of rows) {
    const key = `${rowNum - 1},${COL_D}`;
    const cell = cells[key];
    if (cell && cell.a && cell.a.h === 'right') {
      const { h, ...restA } = cell.a;
      cells[key] = { ...cell, a: restA };
      changed++;
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
    for (const [idStr, rows] of Object.entries(ROWS_BY_TEMPLATE)) {
      const id = Number(idStr);
      const { rows: t } = await client.query(`SELECT id, name, grid_json FROM ${TABLE} WHERE id = $1`, [id]);
      if (!t[0]) { console.log(`[fix] template ${id} not found, skipped`); continue; }
      const grid = JSON.parse(t[0].grid_json);
      const changed = stripRightAlign(grid, rows);
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
