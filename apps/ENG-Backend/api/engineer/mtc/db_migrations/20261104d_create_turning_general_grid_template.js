'use strict';

/**
 * Creates `sds_grid_template` "Turning_General" — a clone of "Turning_PB" (id=9)
 * with ONE fixture callout added in the otherwise-blank gap of the "TURNING
 * CUTTING LAYOUT" section (rows 15-26, before the real layout-diagram image box
 * which starts at row 27 — confirmed blank on id=9 before this migration).
 *
 * Why a new template rather than reusing Turning_PB or the older "Turning" (id=8)
 * directly: QTN200 needs to print ONE fixture (CHUCK JAW, a DWG-numbered tool,
 * not a free-text cutting operation) and Turning_PB has nowhere to print a
 * drawing number at all. The older "Turning" template has a proper F01-F08
 * fixture section but only 8 cutting-tool slots and a 2-column layout; LB12 and
 * QTN200 are both moving onto the 12-slot/3-column Turning_PB layout. Scope
 * confirmed with the requester: ONE fixture slot is enough for both machines
 * today (QTN200/CHUCK JAW is the only one in use; LB12 has no tooling in its
 * factory plan at process 0081 at all).
 *
 * New cells added (style copied from this template's own existing label/value
 * convention — right-aligned black label, `#ff0000` left-aligned value box,
 * Calibri 10, confirmed against A20/C20 "Holder :" on the live id=9 grid). Value
 * sits 2 columns after its label (AK -> AM), matching the SAME gap-column
 * spacing every other label/value pair on this sheet uses (A->C, M->O, S->U,
 * Y->AA, ...) — an adjacent AK->AL placement was tried first and rejected: at
 * this font size the label and value text visually ran together with no gap.
 *   AK15 "Tooling :"  -> AM15 (tool name value)
 *   AK16 "Dwg No :"   -> AM16 (tool drawing number value)
 * No Maker row — dropped at the requester's request; always empty in practice
 * (no maker data flows into `maker_T01` from either the factory plan or the
 * whitelist for this slot), so it only added visual clutter.
 * Image box anchored at AM17 (per the requester's own coordinates), extending
 * to AS26 — the remaining blank width/height in this gap before the real
 * layout-diagram box at row 27.
 *
 * These three value cells are driven by the EXISTING T-Select/whitelist-fed
 * param_keys `tool_name_T01` / `tool_dwg_no_T01` / `maker_T01` — the same
 * mechanism the older "Turning" template's F01-F08 section reuses (see
 * `20260916_seed_turning_excel_mapping_v2.js`'s own comment on this) — wired to
 * these new addresses by the companion seed migration
 * `20261104f_seed_turning_general_fixture_mapping.js`. The image box is wired by
 * a new `IMAGE_EXTENTS` entry in `sdsV2HeadlessController.js` (code, not data —
 * added by hand alongside this migration, same as `TURNING_FIXTURE_MACHINES` was
 * for the older template).
 *
 * Idempotent: looks up by `name = 'Turning_General'` first: no row -> INSERT,
 * existing row -> UPDATE grid_json (so re-running after an edit to the cell list
 * below refreshes it). `--revert` deletes the row — only do this if nothing is
 * still assigned to it (check `sds_machine_type_code.grid_template_id` first).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104d_create_turning_general_grid_template.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261104d_create_turning_general_grid_template.js
 *   node api/engineer/mtc/db_migrations/20261104d_create_turning_general_grid_template.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const SOURCE_TEMPLATE_ID = 9; // Turning_PB
const NAME = 'Turning_General';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function colIdx(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function rc(addr) {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  return (parseInt(m[2], 10) - 1) + ',' + (colIdx(m[1]) - 1);
}

const LABEL_STYLE = (v) => ({ f: { name: 'Calibri', size: 10, bold: false, italic: false, color: null }, a: { h: 'right', v: 'middle', wrap: false }, v });
const VALUE_STYLE = () => ({ f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#ff0000' }, a: { h: 'left', v: 'middle', wrap: false } });

function buildGridJson(sourceGridJson) {
  const grid = JSON.parse(sourceGridJson);
  // AK:AL merged for each label — a single unmerged 45-unit column measured
  // 6.111mm live (too narrow for "Tooling :"/"Dwg No :", confirmed by the
  // ellipsis clipping to "Toolin…"/"Dwg N…"); two merged columns give it
  // 12.222mm, matching the room every other 8-9 char label on this sheet
  // ("Holder :", "Overhang :", "Rotation :") gets from ITS own merge or spill
  // path. A merge is used here rather than relying on spill into AL, so the
  // label's width is fixed and explicit instead of depending on the spill
  // engine's border-crossing rule (see buildGridPdfHtml's spillWidthMm).
  // Field names are r1/c1 (start) and r2/c2 (end) — confirmed against
  // buildGridPdfHtml's own merge parser (`const r1=+m.r1,c1=+m.c1,r2=+m.r2,c2=+m.c2`),
  // NOT r0/c0. A first attempt using r0/c0 parsed r2/c2 as NaN and was silently
  // dropped by that function's own NaN guard — the merge looked present in the
  // stored JSON but had zero effect on the render.
  if (!grid.merges) grid.merges = [];
  grid.merges.push({ r1: 14, c1: colIdx('AK') - 1, r2: 14, c2: colIdx('AL') - 1 });
  grid.merges.push({ r1: 15, c1: colIdx('AK') - 1, r2: 15, c2: colIdx('AL') - 1 });
  grid.cells[rc('AK15')] = LABEL_STYLE('Tooling :');
  grid.cells[rc('AM15')] = VALUE_STYLE();
  grid.cells[rc('AK16')] = LABEL_STYLE('Dwg No :');
  grid.cells[rc('AM16')] = VALUE_STYLE();

  // Two earlier attempts touched the border pairs at idx 6+11 (G/L), 18+23
  // (S/X) and 30+35 (AE/AJ), believing them to be a redundant double-stroke
  // divider between tool-slot blocks. Both were wrong in ways that regressed
  // real borders ("ขอบไม่เต็ม หายไปเยอะ", then "เส้นขอบตั้งหาย" on the AE/AJ
  // pair specifically) — these columns are NOT a simple symmetric "block
  // boundary, gutter, next block" pattern; at least one of each pair sits
  // INSIDE a block's own content columns (e.g. AE/idx30 falls between T09's
  // own "ap=" and "Nose R:" cells, not past the block), so "keep one stroke,
  // drop the other" deleted borders that were doing real framing work in
  // some rows and not others, in a pattern not yet fully mapped.
  //
  // Root cause of the ORIGINAL report (stray marks beside "Hand :") turned
  // out to be unrelated to any of this — a stale `Tool_Photo_Key_N` param
  // left over from QTN200's prior "Turning" (id=8) config was placing an
  // unrelated tool photo at that template's own coordinates, which happened
  // to land in this area (fixed in sdsV2HeadlessController.js + the cleanup
  // migration, not here). With that gone, there is no remaining evidence
  // these border pairs need touching at all — reverted to the source
  // template's own borders, untouched, rather than keep guessing at a
  // pattern that has caused two regressions already.

  return JSON.stringify(grid);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      const inUse = await client.query(
        `SELECT machine_type_name FROM sds_machine_type_code WHERE grid_template_id = (SELECT id FROM sds_grid_template WHERE name = $1)`,
        [NAME]
      );
      if (inUse.rows.length) {
        await client.query('ROLLBACK');
        console.log(`[revert] ABORTED — still assigned to: ${inUse.rows.map(r => r.machine_type_name).join(', ')}`);
        return;
      }
      const del = await client.query(`DELETE FROM sds_grid_template WHERE name = $1`, [NAME]);
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} sds_grid_template row(s) named "${NAME}"`);
      await recordRevert({ file: __filename });
      return;
    }

    const src = await client.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [SOURCE_TEMPLATE_ID]);
    if (!src.rows.length) { console.log(`[error] source template id=${SOURCE_TEMPLATE_ID} not found`); return; }
    const newGridJson = buildGridJson(src.rows[0].grid_json);

    if (dryRun) {
      console.log(`[dry-run] would upsert sds_grid_template "${NAME}" (${newGridJson.length} bytes, cloned from id=${SOURCE_TEMPLATE_ID} + 1 fixture slot)`);
      return;
    }

    await client.query('BEGIN');
    const existing = await client.query(`SELECT id FROM sds_grid_template WHERE name = $1`, [NAME]);
    let id;
    if (existing.rows.length) {
      id = existing.rows[0].id;
      await client.query(`UPDATE sds_grid_template SET grid_json = $1, updated_at = now() WHERE id = $2`, [newGridJson, id]);
      console.log(`[update] refreshed "${NAME}" (id=${id})`);
    } else {
      const ins = await client.query(
        `INSERT INTO sds_grid_template (name, grid_json, is_default) VALUES ($1, $2, false) RETURNING id`,
        [NAME, newGridJson]
      );
      id = ins.rows[0].id;
      console.log(`[create] "${NAME}" created as id=${id}`);
    }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[FAILED]', e.message); process.exit(1); });
