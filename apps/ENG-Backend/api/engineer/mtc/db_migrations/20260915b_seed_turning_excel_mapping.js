'use strict';

/**
 * `sds_excel_mapping` — machine-specific mapping for the "Turning" grid template
 * (sds_grid_template id 5, uploaded via the new xlsx-upload admin feature 2026-09-15).
 * ------------------------------------------------------------------------------
 * This layout is a lathe insert/holder sheet, not a variant of the grinding Standard
 * layout — every shared (`machine_type_name IS NULL`) mapping address lands on the
 * WRONG cell here (e.g. shared `cn`→M4 is this sheet's "C/N :" LABEL, not its value box
 * at O4; shared `tool_dwg_no_T01`→M24 is this sheet's "Rotation :" label). Confirmed by
 * dumping every cell/border/merge of grid_json id=5 and cross-checking against every
 * shared param_key — see the "ฉันบันทึกชื่อ Turning" conversation. Every field below is a
 * MACHINE-SPECIFIC row so it overrides the shared default for this machine only; no
 * shared row is touched, so every existing grinding machine is unaffected.
 *
 * The sheet has 12 tool positions (T01-T12), arranged 3 columns (A/M/Y-based) × 4
 * row-blocks (15/27/39/51), each carrying the SAME 14 fields at a fixed row offset from
 * its block and a fixed column offset from its column group (+0 / +12 / +24 letters) —
 * generated here rather than typed 168 times by hand. Confirmed against the dump:
 * T01-T12 labels sit exactly where the (group, block) formula predicts.
 *
 * Values are supplied per-CN via `sds_parameter` (cn-specific rows), exactly like the
 * existing row_N_A..I grinding-condition fields — no code change needed for the text
 * fields. Tool photos (Holder_Info_N-keyed, uploaded via the SDS Admin "Turning Tool
 * Code" mode) are a separate, code-side mechanism — see sdsV2HeadlessController.js
 * TURNING_IMAGE_EXTENTS / turning_tool_image_N.
 *
 * Known rough edges, not fixed here (ask before "fixing" — see the chat for why):
 *   - AA3 holds ONE cell for both process_code and process_name ("{{Process_Code}}
 *     {{Process}}") — this seed maps `process_name` there only; process_code is dropped
 *     unless a future change combines them into one valueMap field.
 *   - AH4 is labelled "PROGRAM REV :" but its placeholder token reads "{{Program_name}}"
 *     — probably an authoring inconsistency in the uploaded workbook. Seeded literally
 *     as `program_name`→AH4; the true SDS revision is AH3 ("SETUP DATA SHEET REV. :"),
 *     mapped here as `sds_rev`→AH3 (NOT the shared AH4, which would collide).
 *   - `material_size`→O5 is a NEW param_key with no automatic data source — it only
 *     shows anything once someone enters it manually via sds_parameter, same as any
 *     other per-CN field with no factory feed.
 *
 * Idempotent: deletes this machine's rows for every param_key this seed owns, then
 * re-inserts — safe to re-run if the template layout changes. `--revert` removes them.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260915b_seed_turning_excel_mapping.js --machine="LB15" --dry-run
 *   node api/engineer/mtc/db_migrations/20260915b_seed_turning_excel_mapping.js --machine="LB15"
 *   node api/engineer/mtc/db_migrations/20260915b_seed_turning_excel_mapping.js --machine="LB15" --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_excel_mapping';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const machineArg = process.argv.find((a) => a.startsWith('--machine='));
const MACHINE_NAME = machineArg ? machineArg.slice('--machine='.length).replace(/^"|"$/g, '') : null;

function colIdx(letters) { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const addr = (col, row) => `${col}${row}`;

// ── Header / scalar fields (cell addresses read off the actual grid_json dump) ──────
const HEADER_FIELDS = [
  { param_key: 'machine_type_name', cell_address: 'C3',  description: 'MACHINE NO. value box' },
  { param_key: 'parts_no',          cell_address: 'O3',  description: 'PART NO value box' },
  { param_key: 'dwg_rev',           cell_address: 'U3',  description: 'REV value box' },
  { param_key: 'process_name',      cell_address: 'AA3', description: 'PROCESS value box — shares its cell with process_code in the source xlsx; process_code is not shown' },
  { param_key: 'sds_rev',           cell_address: 'AH3', description: 'SETUP DATA SHEET REV. value box (NOT AH4 — see migration header note)' },
  { param_key: 'ct',                cell_address: 'C4',  description: 'CYCLE TIME value box' },
  { param_key: 'cn',                cell_address: 'O4',  description: 'C/N value box' },
  { param_key: 'program_no',        cell_address: 'AA4', description: 'PROGRAM NO value box' },
  { param_key: 'program_name',      cell_address: 'AH4', description: 'labelled PROGRAM REV in the sheet but placeholder reads Program_name — kept literal, see migration header note' },
  { param_key: 'category',          cell_address: 'C5',  description: 'CATEGORY value box' },
  { param_key: 'material_size',     cell_address: 'O5',  description: 'MAT\'L SIZE value box — new field, no automatic source, manual sds_parameter entry only' },
  { param_key: 'material',          cell_address: 'AA5', description: 'MAT\'L TYPE value box' },
  { param_key: 'description_1',     cell_address: 'M9' }, { param_key: 'description_2', cell_address: 'M10' },
  { param_key: 'description_3',     cell_address: 'M11' }, { param_key: 'description_4', cell_address: 'M12' },
  { param_key: 'description_5',     cell_address: 'M13' },
  { param_key: 'remark_1',          cell_address: 'Y9' },  { param_key: 'remark_2',      cell_address: 'Y10' },
  { param_key: 'remark_3',          cell_address: 'Y11' }, { param_key: 'remark_4',       cell_address: 'Y12' },
  { param_key: 'remark_5',          cell_address: 'Y13' },
  { param_key: 'stamp_prepared',    cell_address: 'AK4', description: 'PREPARED stamp box (AK4:AM7)' },
  { param_key: 'stamp_checked',     cell_address: 'AN4', description: 'CHECKED stamp box (AN4:AP7)' },
  { param_key: 'stamp_approved',    cell_address: 'AQ4', description: 'APPROVED stamp box (AQ4:AS7)' },
  // rev_1..5 / ecn_no_1..5 / date_1..5 land on A9-13 / B9-13 / G9-13 in BOTH this
  // template and the shared default — no override needed, so they are not repeated here.
];

// ── Per-tool fields (T01-T12), generated from the repeating block/column pattern ────
// FIELDS: name + row offset from the tool's block start + column at the A-group (col 0).
const FIELDS = [
  { key: 'Tool_Detail',  dRow: 0,  col: 'C' },
  { key: 'Usage',        dRow: 0,  col: 'J' },
  { key: 'VC',           dRow: 1,  col: 'B' },
  { key: 'F',            dRow: 1,  col: 'D' },
  { key: 'AP',           dRow: 1,  col: 'F' },
  { key: 'Nose_R',       dRow: 1,  col: 'J' },
  { key: 'Insert_Info',  dRow: 3,  col: 'C' },
  { key: 'Insert_Maker', dRow: 4,  col: 'C' },
  { key: 'Holder_Info',  dRow: 5,  col: 'C' },
  { key: 'Holder_Maker', dRow: 6,  col: 'C' },
  { key: 'Overhang',     dRow: 7,  col: 'C' },
  { key: 'H_Width',      dRow: 8,  col: 'C' },
  { key: 'Rotation',     dRow: 9,  col: 'C' },
  { key: 'Hand',         dRow: 10, col: 'C' },
];
const BLOCK_ROWS = [15, 27, 39, 51];       // 4 row-blocks per column group
const GROUP_COL_OFFSET = [0, 12, 24];      // A-group / M-group / Y-group, in letters

function buildToolFields() {
  const rows = [];
  for (let n = 1; n <= 12; n++) {
    const group = Math.floor((n - 1) / 4);   // 0=A, 1=M, 2=Y
    const within = (n - 1) % 4;              // which of the 4 row-blocks
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

async function main() {
  if (!MACHINE_NAME) {
    console.error('[error] --machine="<sds_machine_type_code.machine_type_name>" is required (no default — this must be a deliberate choice)');
    process.exitCode = 1;
    return;
  }
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const allFields = [...HEADER_FIELDS, ...buildToolFields()];
  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND param_key = ANY($2)`,
        [MACHINE_NAME, allFields.map((f) => f.param_key)]
      );
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} mapping row(s) for machine_type_name='${MACHINE_NAME}'`);
      await recordRevert({ file: __filename });
      return;
    }

    console.log(`[seed] ${allFields.length} mapping rows for machine_type_name='${MACHINE_NAME}'`);
    if (dryRun) {
      for (const f of allFields) console.log(`  ${f.param_key.padEnd(20)} -> ${f.cell_address}`);
      console.log('\n[seed] --dry-run — no changes written');
      return;
    }

    await client.query('BEGIN');
    const delRes = await client.query(
      `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND param_key = ANY($2)`,
      [MACHINE_NAME, allFields.map((f) => f.param_key)]
    );
    const COLS = 4; // machine_type_name, cell_address, param_key, description
    const placeholders = allFields.map((_, i) =>
      `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3},$${i * COLS + 4})`
    ).join(',');
    const values = allFields.flatMap((f) => [MACHINE_NAME, f.cell_address, f.param_key, f.description || null]);
    await client.query(
      `INSERT INTO ${TABLE} (machine_type_name, cell_address, param_key, description) VALUES ${placeholders}`,
      values
    );
    await client.query('COMMIT');
    console.log(`[seed] replaced ${delRes.rowCount} old row(s) with ${allFields.length} new row(s)`);
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
