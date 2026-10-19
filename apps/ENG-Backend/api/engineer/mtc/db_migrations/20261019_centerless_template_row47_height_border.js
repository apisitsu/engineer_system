'use strict';

/**
 * Centerless grid template (sds_grid_template id 4): row 47 — the "8th Time" row of the
 * CUTTING CONDITION table — was drawn as a spacer: 8 px high (every sibling row is 26) with no
 * bottom border in any of the table's columns A:I. It holds real data ("8th Time", the cut depth,
 * "mm", the roundness note), so the sheet printed it squashed, and with no line under it.
 * Reported on the PB Ring HIGRIND1D sheet (CN 294065 / process 1011) 2026-10-19.
 *
 * The template is shared: the four machines that use it (HI-GRIND-1-D, OC-18BR-150, OC-20BR-200,
 * OC-16A in the real SDS, plus PB Ring's HIGRIND1D/OC18BR150/OC20BR200/OMIYA) all get the fix.
 * The other spacer on this layout — row 37, between GRIND SPEED and RUBBER WHEEL SPEED — holds
 * nothing and is left alone.
 *
 * Changes ONLY: rowH[46] 8 → the height of row 45, and the bottom border of A47:I47 copied from
 * A46:I46. Skips (idempotent) if the row is no longer in the broken state, so a hand fix in the
 * grid editor is never overwritten. `--revert` restores the 8 px height and removes those borders.
 *
 *   node api/engineer/mtc/db_migrations/20261019_centerless_template_row47_height_border.js [--revert] [--dry-run]
 */
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dry = process.argv.includes('--dry-run');
const TEMPLATE_ID = 4;
const ROW = 46;                        // 0-based (row 47 in the editor)
const COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // the CUTTING CONDITION table, columns A:I
const BROKEN_H = 8;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const { rows } = await engPool.query(`SELECT name, grid_json FROM sds_grid_template WHERE id = $1`, [TEMPLATE_ID]);
  if (!rows.length || rows[0].name !== 'Centerless') throw new Error(`template ${TEMPLATE_ID} is not "Centerless" — refusing to edit`);
  const grid = JSON.parse(rows[0].grid_json);
  const B = grid.borders || (grid.borders = {});

  if (revert) {
    grid.rowH[ROW] = BROKEN_H;
    for (const c of COLS) { if (B[`${ROW},${c}`]) delete B[`${ROW},${c}`].b; }
  } else {
    const bottomOfAbove = c => (B[`${ROW - 1},${c}`] || {}).b;
    const hasBottom = COLS.some(c => (B[`${ROW},${c}`] || {}).b);
    if (grid.rowH[ROW] !== BROKEN_H || hasBottom) {
      console.log(`row ${ROW + 1} is not in the broken state (height ${grid.rowH[ROW]}, bottom border: ${hasBottom}) — nothing to do`);
      return;
    }
    grid.rowH[ROW] = grid.rowH[ROW - 1];
    for (const c of COLS) {
      const b = bottomOfAbove(c);
      if (b) B[`${ROW},${c}`] = { ...(B[`${ROW},${c}`] || {}), b: { ...b } };
    }
  }
  if (dry) return console.log(`[dry-run] row ${ROW + 1}: height ${grid.rowH[ROW]}, bottom borders ${COLS.map(c => ((B[`${ROW},${c}`] || {}).b ? 'B' : '.')).join('')}`);

  await engPool.query(`UPDATE sds_grid_template SET grid_json = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(grid), TEMPLATE_ID]);
  if (revert) await recordRevert({ file: __filename }); else await recordRun({ file: __filename });
  console.log(revert ? 'reverted' : `applied — row ${ROW + 1} is now ${grid.rowH[ROW]} px with a bottom border on A:I`);
}

main().then(() => engPool.end()).catch(async (e) => { console.error(e.message); await engPool.end().catch(() => {}); process.exit(1); });
