'use strict';

/**
 * `sds_excel_mapping` — machine-specific mapping for the "Turning_PB" grid template
 * (`sds_grid_template` id=9, name "Turning_PB"). First real SDS machine to use it —
 * built for PB Ring but never assigned to any `sds_machine_type_code` row until now
 * (CN314110, process 0081 -> LB12).
 *
 * Addresses are NOT guessed. `api/engineer/pbring/pbringGridService.js` already
 * renders this exact template (id=9) for PB Ring's own 2 turning machines via a
 * bespoke code path (`loadTurningGridLive`/`turningPbSlotAddresses`/
 * `TURNING_PB_HEADER_ADDR`), with its own addresses "derived from the reference
 * workbook ... Verified: extracting all 216 {{}} placeholders ... reproduces every
 * one of them exactly". Every one of those addresses was re-verified here directly
 * against the LIVE `sds_grid_template` id=9 `grid_json` (dumping cell text/styling,
 * not re-reading the old xlsx) before being reused — they match exactly. This
 * migration ports that address scheme into the generic `sds_excel_mapping` /
 * `sds_parameter` pipeline (used by every non-PB-Ring SDS machine) rather than
 * reusing PB Ring's bespoke renderer, which is wired to `pbring_sds_condition`
 * and has no notion of `sds_machine_type_code`/CN314110 at all.
 *
 * Layout: 64 rows x 45 cols. Header fields at row 3-5 (value box = 2nd cell after
 * each label, bold red #ff0000, "Excel spill" convention — one cell holds the
 * value, following empty cells just give it room to spill). 12 cutting-tool slots
 * (not 8 like the older "Turning" id=8), 3 column-blocks (A/M/Y-based, 12 cols
 * apart) x 4 row-blocks (rowBase 15/27/39/51, 12-row cycle). No separate fixture
 * (F0N / Tooling No / Maker) slots exist on this layout at all -- confirmed
 * directly (only Tool_Name/Tool_Detail/Usage/VC/F/AP/Nose_R/Insert.../Holder...
 * /Overhang/H.Width/Rotation/Hand per slot) -- so no tool_dwg_no_T0N/maker_T0N
 * rows are seeded here, matching pbringGridService.js's own note that this layout
 * has nowhere to print a drawing number.
 *
 * None of these fields (VC/F/AP/Nose_R/Insert_.../Holder_.../Overhang/H_Width/
 * Rotation/Hand/Usage/Tool_Detail/Tool_Name) have an automatic factory data
 * source in the generic pipeline -- same as "material_size" on every other
 * template -- so they render blank until filled by hand via SDS Admin
 * (machine-default or per-CN `sds_parameter` rows).
 *
 * description_1-5 / remark_1-5 are machine-specific here (M9-13 / Y9-13) because
 * this template's own revision-log table uses different columns than the
 * Standard-template shared mapping assumes (J9-13 / AH9-13) -- confirmed via the
 * live grid's own "DESCRIPTION"/"REMARK" header labels at M8/Y8. rev_1-5/ecn_no_1-5
 * /date_1-5 (A9-13/B9-13/G9-13) are NOT re-seeded here -- the shared rows are
 * correct for this template too (same columns, verified against the live grid),
 * and the companion suppression migration explicitly keeps them.
 *
 * Idempotent: deletes this machine's rows for every param_key/cell_address this
 * seed owns, then re-inserts. `--revert` removes them. `--machine` may be
 * repeated to seed several machines in one run.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104b_seed_turning_pb_excel_mapping.js --machine="LB12" --dry-run
 *   node api/engineer/mtc/db_migrations/20261104b_seed_turning_pb_excel_mapping.js --machine="LB12"
 *   node api/engineer/mtc/db_migrations/20261104b_seed_turning_pb_excel_mapping.js --machine="LB12" --revert
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

const HEADER_FIELDS = [
  { param_key: 'machine_type_name', cell_address: 'C3', description: 'MACHINE NO. value box' },
  { param_key: 'parts_no',          cell_address: 'O3', description: 'PART NO value box' },
  { param_key: 'dwg_rev',           cell_address: 'U3', description: 'REV value box' },
  { param_key: 'process_code_name', cell_address: 'AA3', description: 'PROCESS value box — combined "<code> <name>"' },
  { param_key: 'sds_rev',           cell_address: 'AH3', description: 'SETUP DATA SHEET REV. value box' },
  { param_key: 'ct',                cell_address: 'C4', description: 'CYCLE TIME value box' },
  { param_key: 'cn',                cell_address: 'O4', description: 'C/N value box' },
  { param_key: 'program_no',        cell_address: 'AA4', description: 'PROGRAM NO value box' },
  { param_key: 'program_name',      cell_address: 'AH4', description: 'labelled PROGRAM REV — token kept literal' },
  { param_key: 'category',          cell_address: 'C5', description: 'CATEGORY value box' },
  { param_key: 'material_size',     cell_address: 'O5', description: "MAT'L SIZE value box — no automatic source, manual sds_parameter entry only" },
  { param_key: 'material',          cell_address: 'AA5', description: "MAT'L TYPE value box" },
  { param_key: 'description_1', cell_address: 'M9' },  { param_key: 'description_2', cell_address: 'M10' },
  { param_key: 'description_3', cell_address: 'M11' }, { param_key: 'description_4', cell_address: 'M12' },
  { param_key: 'description_5', cell_address: 'M13' },
  { param_key: 'remark_1', cell_address: 'Y9' },  { param_key: 'remark_2', cell_address: 'Y10' },
  { param_key: 'remark_3', cell_address: 'Y11' }, { param_key: 'remark_4', cell_address: 'Y12' },
  { param_key: 'remark_5', cell_address: 'Y13' },
  // rev_1..5 / ecn_no_1..5 / date_1..5 land on A9-13 / B9-13 / G9-13 — same
  // columns as the shared default on this template too, confirmed live. No
  // override needed; the companion suppression migration keeps them shared.
];

// Column letters per 4-slot block — block 0 = slots 1-4 (A-based), block 1 =
// slots 5-8 (M-based), block 2 = slots 9-12 (Y-based), each block's columns
// exactly 12 letters past the previous one. Verified directly against the live
// grid_json (not just ported from pbringGridService.js's own derivation).
const BLOCK_COLS = [
  { info: 'C', tname: 'B', detail: 'C', usageNoseR: 'J', vc: 'B', f: 'D', ap: 'F' },
  { info: 'O', tname: 'N', detail: 'O', usageNoseR: 'V', vc: 'N', f: 'P', ap: 'R' },
  { info: 'AA', tname: 'Z', detail: 'AA', usageNoseR: 'AH', vc: 'Z', f: 'AB', ap: 'AD' },
];
const BLOCK_ROWS = [15, 27, 39, 51]; // rowBase per slotInBlock (0-3), 12-row cycle

function buildToolFields() {
  const rows = [];
  for (let n = 1; n <= 12; n++) {
    const block = Math.floor((n - 1) / 4);
    const within = (n - 1) % 4;
    const rowBase = BLOCK_ROWS[within];
    const c = BLOCK_COLS[block];
    rows.push({ param_key: `Tool_Name_${n}`, cell_address: `${c.tname}${rowBase}` });
    rows.push({ param_key: `Tool_Detail_${n}`, cell_address: `${c.detail}${rowBase}` });
    rows.push({ param_key: `Usage_${n}`, cell_address: `${c.usageNoseR}${rowBase}` });
    rows.push({ param_key: `VC_${n}`, cell_address: `${c.vc}${rowBase + 1}` });
    rows.push({ param_key: `F_${n}`, cell_address: `${c.f}${rowBase + 1}` });
    rows.push({ param_key: `AP_${n}`, cell_address: `${c.ap}${rowBase + 1}` });
    rows.push({ param_key: `Nose_R_${n}`, cell_address: `${c.usageNoseR}${rowBase + 1}` });
    rows.push({ param_key: `Insert_Info_${n}`, cell_address: `${c.info}${rowBase + 3}` });
    rows.push({ param_key: `Insert_Maker_${n}`, cell_address: `${c.info}${rowBase + 4}` });
    rows.push({ param_key: `Holder_Info_${n}`, cell_address: `${c.info}${rowBase + 5}` });
    rows.push({ param_key: `Holder_Maker_${n}`, cell_address: `${c.info}${rowBase + 6}` });
    rows.push({ param_key: `Overhang_${n}`, cell_address: `${c.info}${rowBase + 7}` });
    rows.push({ param_key: `H_Width_${n}`, cell_address: `${c.info}${rowBase + 8}` });
    rows.push({ param_key: `Rotation_${n}`, cell_address: `${c.info}${rowBase + 9}` });
    rows.push({ param_key: `Hand_${n}`, cell_address: `${c.info}${rowBase + 10}` });
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

  const allFields = [...HEADER_FIELDS, ...buildToolFields()];
  const client = await engPool.connect();
  try {
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
