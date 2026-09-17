'use strict';

/**
 * `sds_excel_mapping` — machine-specific mapping for the FINAL "Turning" grid template
 * (sds_grid_template id 8, name "Turning" — the layout that merged the cutting-tool
 * section with a jig/fixture section, uploaded 2026-09-16 from sheet "bfd_qsm200m" of
 * a 24-sheet export). Supersedes `20260915b_seed_turning_excel_mapping.js`, which
 * targeted an earlier, since-replaced version of the layout (12 tools, no fixture
 * section) — that file is left in place as history but should not be re-run against
 * this template; its cell addresses no longer match anything.
 *
 * Layout is 59 rows x 46 cols, confirmed by dumping every cell/border/merge of
 * grid_json id=8 (see the "ได้แล้ว ช่วยตรวจสอบเรื่อง config" conversation):
 *
 *   - 8 cutting tools (T01-T08, not 12 — the third column group was replaced by the
 *     fixture section), 2 columns (A-group / M-group) x 4 row-blocks (15/26/37/48,
 *     an 11-row cycle — one row tighter than the previous layout's 12-row cycle).
 *   - 8 jig/fixture slots (F01-F08), each just "Tooling No :" + "Maker :" (no name or
 *     photo box) — labelled F to avoid colliding with the T01-T08 cutting-tool badges,
 *     but there is no reason to invent new param_keys for them: their labels are
 *     exactly what the EXISTING T-Select-driven `tool_dwg_no_T0N` / `maker_T0N` fields
 *     already mean, and X-100 (max 7 fixtures @2031/2071), XD-8 (max 8 @2021) and
 *     J-WAVE (max 5) all fit inside 8 slots. So this migration maps those SAME param
 *     keys onto the new addresses — no code change, no new naming.
 *
 * Known risk, not fixed here: `tool_image_T0N` placement is UNCONDITIONAL in
 * sdsV2HeadlessController.js — it fires whenever a T-Select result carries an image,
 * at hardcoded coordinates (K18:P23 etc.) designed for the OLD grinding layout. This
 * template has no photo box for F01-F08 at all, and K18:P23 lands inside this
 * layout's T05 text block (cols K/L sit in the gap between the A-group and M-group,
 * but the box's right edge (P=16) reaches into the M-group's own columns). If any of
 * X-100/XD-8/J-WAVE's configured fixtures have an uploaded `sds_tooling_image` row,
 * assigning this template will silently draw that photo over the T05 slot's text.
 * Render a real sheet per machine after assigning the template and check for this
 * before treating the rollout as done — it depends on which fixtures happen to have
 * photos uploaded, which this migration cannot know.
 *
 * Fixed since the previous version: AB3 ("{{Process_Code}} {{Process}}" in the source
 * workbook, one cell) now maps `process_code_name` — a new combined field computed in
 * buildValueMap (sdsV2HeadlessController.js) right after process_code/process_name —
 * instead of `process_name` alone, so the code prints again ("2071 SPH BRG TURN").
 *
 * Same rough edges as the previous version, unchanged:
 *   - AJ4 is labelled "PROGRAM REV :" but its placeholder token reads "{{Program_name}}"
 *     — kept literal (mapped as `program_name`), matching the workbook's own token.
 *   - `material_size` (→ O5) has no automatic source; per-CN manual entry only.
 *
 * Idempotent: deletes this machine's rows for every param_key this seed owns, then
 * re-inserts — safe to re-run if the template layout changes again. `--revert` removes
 * them. `--machine` may be repeated to seed several machines in one run.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260916_seed_turning_excel_mapping_v2.js --machine="X-100" --machine="XD-8" --machine="J-WAVE" --dry-run
 *   node api/engineer/mtc/db_migrations/20260916_seed_turning_excel_mapping_v2.js --machine="X-100" --machine="XD-8" --machine="J-WAVE"
 *   node api/engineer/mtc/db_migrations/20260916_seed_turning_excel_mapping_v2.js --machine="X-100" --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_excel_mapping';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINES = process.argv
  .filter((a) => a.startsWith('--machine='))
  .map((a) => a.slice('--machine='.length).replace(/^"|"$/g, ''))
  .filter(Boolean);

function colIdx(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const addr = (col, row) => `${col}${row}`;

const HEADER_FIELDS = [
  { param_key: 'machine_type_name', cell_address: 'C3',  description: 'MACHINE NO. value box' },
  { param_key: 'parts_no',          cell_address: 'O3',  description: 'PART NO value box' },
  { param_key: 'dwg_rev',           cell_address: 'U3',  description: 'REV value box' },
  { param_key: 'process_code_name', cell_address: 'AB3', description: 'PROCESS value box — combined "<code> <name>" string (sdsV2HeadlessController.js buildValueMap), matching the workbook\'s own "{{Process_Code}} {{Process}}" cell' },
  { param_key: 'sds_rev',           cell_address: 'AJ3', description: 'SETUP DATA SHEET REV. value box' },
  { param_key: 'ct',                cell_address: 'C4',  description: 'CYCLE TIME value box' },
  { param_key: 'cn',                cell_address: 'O4',  description: 'C/N value box' },
  { param_key: 'program_no',        cell_address: 'AB4', description: 'PROGRAM NO value box' },
  { param_key: 'program_name',      cell_address: 'AJ4', description: 'labelled PROGRAM REV in the sheet but token reads Program_name — kept literal' },
  { param_key: 'category',          cell_address: 'C5',  description: 'CATEGORY value box' },
  { param_key: 'material_size',     cell_address: 'O5',  description: 'MAT\'L SIZE value box — no automatic source, manual sds_parameter entry only' },
  { param_key: 'material',          cell_address: 'AB5', description: 'MAT\'L TYPE value box' },
  { param_key: 'description_1', cell_address: 'M9' },  { param_key: 'description_2', cell_address: 'M10' },
  { param_key: 'description_3', cell_address: 'M11' }, { param_key: 'description_4', cell_address: 'M12' },
  { param_key: 'description_5', cell_address: 'M13' },
  { param_key: 'remark_1', cell_address: 'Y9' },  { param_key: 'remark_2', cell_address: 'Y10' },
  { param_key: 'remark_3', cell_address: 'Y11' }, { param_key: 'remark_4', cell_address: 'Y12' },
  { param_key: 'remark_5', cell_address: 'Y13' },
  { param_key: 'stamp_prepared', cell_address: 'AL4', description: 'PREPARED stamp box' },
  { param_key: 'stamp_checked',  cell_address: 'AO4', description: 'CHECKED stamp box' },
  { param_key: 'stamp_approved', cell_address: 'AR4', description: 'APPROVED stamp box' },
  // rev_1..5 / ecn_no_1..5 / date_1..5 land on A9-13 / B9-13 / G9-13, same as the
  // shared default — no override needed.
];

// Per-cutting-tool fields (T01-T08), generated from the repeating block/column pattern.
const FIELDS = [
  { key: 'Tool_Detail',  dRow: 0, col: 'C' },
  { key: 'Usage',        dRow: 0, col: 'J' },
  { key: 'VC',           dRow: 1, col: 'B' },
  { key: 'F',            dRow: 1, col: 'D' },
  { key: 'AP',           dRow: 1, col: 'F' },
  { key: 'Nose_R',       dRow: 1, col: 'J' },
  { key: 'Insert_Info',  dRow: 2, col: 'C' },
  { key: 'Insert_Maker', dRow: 3, col: 'C' },
  { key: 'Holder_Info',  dRow: 4, col: 'C' },
  { key: 'Holder_Maker', dRow: 5, col: 'C' },
  { key: 'Overhang',     dRow: 6, col: 'C' },
  { key: 'H_Width',      dRow: 7, col: 'C' },
  { key: 'Rotation',     dRow: 8, col: 'C' },
  { key: 'Hand',         dRow: 9, col: 'C' },
];
const BLOCK_ROWS = [15, 26, 37, 48];   // 4 row-blocks, 11-row cycle
const GROUP_COL_OFFSET = [0, 12];      // A-group / M-group, in letters

function buildToolFields() {
  const rows = [];
  for (let n = 1; n <= 8; n++) {
    const group = Math.floor((n - 1) / 4);   // 0=A, 1=M
    const within = (n - 1) % 4;
    const rowBase = BLOCK_ROWS[within];
    const colOff = GROUP_COL_OFFSET[group];
    for (const f of FIELDS) {
      const row = rowBase + f.dRow;
      const col = colLetter(colIdx(f.col) + colOff);
      rows.push({ param_key: `${f.key}_${n}`, cell_address: addr(col, row) });
    }
  }
  return rows;
}

// Jig/fixture slots F01-F08 — reuse the EXISTING T-Select-driven param_keys
// (tool_dwg_no_T0N / maker_T0N) so the auto-fill mechanism just works; only the
// CELL ADDRESS is new, the data source (buildValueMap's `tooling` array) is not.
function buildFixtureFields() {
  const rows = [];
  for (let n = 1; n <= 8; n++) {
    const block = Math.floor((n - 1) / 2);   // which of the 4 row-blocks
    const side = (n - 1) % 2;                // 0 = left (Y), 1 = right (AD)
    const rowBase = BLOCK_ROWS[block];
    const toolingNoRow = rowBase + 9;
    const makerRow = toolingNoRow + 1;
    // 2026-09-16: left column (F01/F03/F05/F07) reverted to AA, but the right column
    // (F02/F04/F06/F08) stays shifted at AG — an asymmetric final layout, confirmed
    // explicitly by the owner after the first (symmetric) revert undid both sides.
    const valueCol = side === 0 ? 'AA' : 'AG';
    const slot = `T${String(n).padStart(2, '0')}`;
    rows.push({ param_key: `tool_dwg_no_${slot}`, cell_address: addr(valueCol, toolingNoRow), description: `F0${n} Tooling No (T-Select fixture, reused slot ${slot})` });
    rows.push({ param_key: `maker_${slot}`, cell_address: addr(valueCol, makerRow), description: `F0${n} Maker` });
    // Tooling NAME (e.g. "ARBOR") — added 2026-09-16, placed on the SAME row as the
    // F0N badge itself (rowBase), one column past it: Z next to the Y-badge (F01 etc,
    // unmerged single cell), AF next to the AD:AE-merged badge (F02 etc). Reuses
    // tool_name_T0N, the same param_key the Standard layout already fills from
    // T-Select — no new data source, only a new address.
    const nameCol = side === 0 ? 'Z' : 'AF';
    rows.push({ param_key: `tool_name_${slot}`, cell_address: addr(nameCol, rowBase), description: `F0${n} Tooling name (T-Select fixture, reused slot ${slot})` });
  }
  return rows;
}

async function main() {
  if (!MACHINES.length) {
    console.error('[error] at least one --machine="<sds_machine_type_code.machine_type_name>" is required');
    process.exitCode = 1;
    return;
  }
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const allFields = [...HEADER_FIELDS, ...buildToolFields(), ...buildFixtureFields()];
  const client = await engPool.connect();
  try {
    // Delete by param_key OR cell_address (union of both): a re-run after this seed's
    // OWN field list changes shape — a param_key moving to a new address (the AA/AG
    // column shifts), or an address being repointed to a new param_key
    // (process_name -> process_code_name at AB3) — must still clear the row it is
    // replacing. Matching on only one side leaves an orphaned duplicate that then
    // fails the (machine_type_name, cell_address) unique constraint on insert.
    const ownedKeys = allFields.map((f) => f.param_key);
    const ownedAddrs = allFields.map((f) => f.cell_address);

    if (revert) {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = ANY($1) AND (param_key = ANY($2) OR cell_address = ANY($3))`,
        [MACHINES, ownedKeys, ownedAddrs]
      );
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} mapping row(s) for machines: ${MACHINES.join(', ')}`);
      await recordRevert({ file: __filename });
      return;
    }

    console.log(`[seed] ${allFields.length} mapping rows x ${MACHINES.length} machine(s) = ${allFields.length * MACHINES.length} total`);
    if (dryRun) {
      for (const f of allFields) console.log(`  ${f.param_key.padEnd(20)} -> ${f.cell_address}`);
      console.log('\n[seed] --dry-run — no changes written. machines:', MACHINES.join(', '));
      return;
    }

    await client.query('BEGIN');
    let totalDeleted = 0;
    for (const machine of MACHINES) {
      const delRes = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND (param_key = ANY($2) OR cell_address = ANY($3))`,
        [machine, ownedKeys, ownedAddrs]
      );
      totalDeleted += delRes.rowCount;
      const COLS = 4;
      const placeholders = allFields.map((_, i) =>
        `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3},$${i * COLS + 4})`
      ).join(',');
      const values = allFields.flatMap((f) => [machine, f.cell_address, f.param_key, f.description || null]);
      await client.query(
        `INSERT INTO ${TABLE} (machine_type_name, cell_address, param_key, description) VALUES ${placeholders}`,
        values
      );
      console.log(`  ${machine}: replaced ${delRes.rowCount} old row(s) with ${allFields.length} new row(s)`);
    }
    await client.query('COMMIT');
    console.log(`[seed] done — ${totalDeleted} old row(s) removed, ${allFields.length * MACHINES.length} new row(s) inserted`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[seed] FAILED:', e.message); process.exit(1); });
