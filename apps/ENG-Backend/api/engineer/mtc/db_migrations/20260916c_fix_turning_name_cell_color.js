'use strict';

/**
 * `sds_grid_template.grid_json` (id 8, "Turning") — fix white-on-white tool-name cells.
 * ------------------------------------------------------------------------------
 * Reported live: after mapping `tool_name_T0N` to Z15/Z26/Z37/Z48 (the F01/F03/F05/F07
 * badge row, one column past the badge — see 20260916_seed_turning_excel_mapping_v2.js),
 * the PDF's text layer carried the fixture name ("WRIST END ASSY" etc.) but nothing was
 * VISIBLE — those four cells were pre-formatted in the source workbook with white font
 * (`color: #ffffff`), presumably meant to sit on the same black fill as the badge cell
 * beside them (Y15 etc.), but the black fill itself does not extend into Z/Z26/Z37/Z48.
 * White text on the page's white background is invisible even though it renders
 * correctly and even copies out of the PDF.
 *
 * The mirror cells for F02/F04/F06/F08 (AF15/AF26/AF37/AF48) carry NO font override at
 * all (confirmed: `cell === undefined`), so their names render in the default black —
 * which is why only the right-hand names ever appeared. This migration clears just the
 * `color` key on the four white cells so they fall back to the same default.
 *
 * Idempotent: no-ops if the color is already gone. `--revert` restores white (matching
 * the original workbook) — only useful if this cell is repurposed for something meant
 * to sit on a dark fill again.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260916c_fix_turning_name_cell_color.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260916c_fix_turning_name_cell_color.js
 *   node api/engineer/mtc/db_migrations/20260916c_fix_turning_name_cell_color.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TEMPLATE_ID = 8;
const TARGET_ROWS = [15, 26, 37, 48]; // F01/F03/F05/F07 badge rows
const COL = 'Z';
const WHITE = '#ffffff';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function colIdx(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    const { rows } = await client.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [TEMPLATE_ID]);
    if (!rows[0]) { console.log(`[fix] template id=${TEMPLATE_ID} not found`); return; }
    const grid = JSON.parse(rows[0].grid_json);
    const c = colIdx(COL);
    let changed = 0;
    for (const rowNum of TARGET_ROWS) {
      const key = `${rowNum - 1},${c}`;
      const cell = grid.cells[key];
      if (!cell || !cell.f) continue;
      if (revert) {
        if (cell.f.color === WHITE) continue;
        grid.cells[key] = { ...cell, f: { ...cell.f, color: WHITE } };
        changed++;
      } else {
        if (cell.f.color !== WHITE) continue;
        const { color, ...restF } = cell.f;
        grid.cells[key] = { ...cell, f: restF };
        changed++;
      }
    }
    console.log(`[fix] ${changed} cell(s) to change (${revert ? 'restore white' : 'clear white'})`);
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
