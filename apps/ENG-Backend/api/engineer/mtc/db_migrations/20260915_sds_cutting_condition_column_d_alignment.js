'use strict';

/**
 * `sds_grid_template.grid_json` — fix CUTTING CONDITION column D right-alignment.
 * ------------------------------------------------------------------------------
 * Reported from the floor: TSG-300W/TSG-300ZNC SDS PDFs print the CUTTING CONDITION
 * block (rows 22-26, "1st Time" .. "5th Time") with column D truncated to a few
 * characters — "(Contr." instead of "(Control Roughness is not more than ... µm)".
 *
 * Root cause is cell FORMAT, not data. `buildGridPdfHtml`'s anti-overlap fix (see
 * "Excel spills over EMPTY neighbours only" in .claude/rules/sds-pipeline.md) lets a
 * long unwrapped value spill only in the direction its alignment sends it: a
 * right-aligned cell may only spill LEFT. Column D in both templates was imported from
 * the original xlsx with `a.h = 'right'`, so a long D value can only spill toward
 * column C — which is occupied ("mm" in this section) — capping the text at D's own
 * 55px column width (~7.3mm) regardless of how much empty room sits to its right
 * (columns E/F/G are blank in this section, up to the occupied H value cell).
 *
 * Column D holds two different KINDS of content across machines sharing these
 * templates, and only one kind is affected:
 *   - a short right-aligned VALUE ("mm", "sec", "0.020", "104.23") — unaffected either
 *     way; 2-6 characters fit inside D's own width under either alignment.
 *   - a long left-to-right SENTENCE ("(Control Roughness is not more than ... µm)") —
 *     only on HAMAI 5B, TSG-300W, TSG-300ZNC (`sds_parameter` audited 2026-09-15) — and
 *     this is what the right-alignment truncates, because the text should spill
 *     RIGHTWARD through the empty E/F/G cells up to the value in H, not left into C.
 *
 * Fix: drop `a.h` (→ default 'left') on column D, rows 22-26, in every grid template.
 * Verified in a headless-Chrome DOM measurement (not just the HTML string): before the
 * fix the rendered span is clipped to 28px against a 109px-wide sentence; after, 109px
 * against 109px — no truncation, and no growth beyond the room already free. Templates
 * checked: id 1 "Standard" (both affected machines) and id 4 "Centerless" (no machine
 * on it currently uses columns 22-26 at all, so this is a latent-bug fix with zero
 * visible effect there — checked live, zero non-null row_2[2-6]_D values across all
 * four of its machines).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260915_sds_cutting_condition_column_d_alignment.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260915_sds_cutting_condition_column_d_alignment.js
 *   node api/engineer/mtc/db_migrations/20260915_sds_cutting_condition_column_d_alignment.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_grid_template';
const BACKUP = 'sds_grid_template_backup_20260915_cutting_cond_align';
const ROWS = [22, 23, 24, 25, 26]; // "1st Time" .. "5th Time"
const COL_D = 3; // 0-based column index for 'D'
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function stripRightAlign(grid) {
  let changed = 0;
  const cells = grid.cells || {};
  for (const rowNum of ROWS) {
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

    const { rows: templates } = await client.query(`SELECT id, name, grid_json FROM ${TABLE} ORDER BY id`);
    const toUpdate = [];
    for (const t of templates) {
      let grid;
      try { grid = JSON.parse(t.grid_json); } catch (e) { console.log(`[fix] ${t.id} ${t.name}: PARSE ERROR, skipped`); continue; }
      const changed = stripRightAlign(grid);
      console.log(`[fix] ${t.id} ${t.name}: ${changed} cell(s) to change`);
      if (changed) toUpdate.push({ id: t.id, name: t.name, grid_json: JSON.stringify(grid) });
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
    for (const t of toUpdate) console.log(`  ${t.id} ${t.name}`);
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
