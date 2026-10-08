'use strict';

/**
 * Seeds the 8 GRINDING/DRESSING WHEEL condition-list rows for KVD300 and
 * KVD350 — the only two machines (verified live) that store this data as
 * `pbring_sds_condition` rows keyed by tool_number (Upper_GW/Lower_GW/F_DW/
 * R_DW) rather than as plain `params` keys. Appended after each machine's
 * existing numbered condition list (sort_order continues from the current
 * max), `source='condition'` so the renderer resolves them from
 * `pbring_sds_condition` instead of `pbring_sds_param.params`.
 * ------------------------------------------------------------------------------
 * Companion to 20261010c (adds the source/tool_number/condition_field
 * columns this relies on) and to the NAMED_TOOL_ORDER removal in
 * pbringGridService.js that stops these 4 being auto-assigned to T03-T06.
 *
 * Idempotent: deletes any existing `source='condition'` rows for these two
 * machines before inserting (safe to re-run). `--revert` removes the same.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const MACHINES = ['KVD300', 'KVD350'];

const ROWS = [
  { tool_number: 'Upper_GW', field: 'tooling_no', label: 'GRINDING WHEEL SPEC : UPPER' },
  { tool_number: 'Upper_GW', field: 'maker', label: 'GRINDING WHEEL MAKER : UPPER' },
  { tool_number: 'Lower_GW', field: 'tooling_no', label: 'GRINDING WHEEL SPEC : LOWER' },
  { tool_number: 'Lower_GW', field: 'maker', label: 'GRINDING WHEEL MAKER : LOWER' },
  { tool_number: 'F_DW', field: 'tooling_no', label: 'DRESSING WHEEL SPEC : FRONT' },
  { tool_number: 'F_DW', field: 'maker', label: 'DRESSING WHEEL MAKER : FRONT' },
  { tool_number: 'R_DW', field: 'tooling_no', label: 'DRESSING WHEEL SPEC : REAR' },
  { tool_number: 'R_DW', field: 'maker', label: 'DRESSING WHEEL MAKER : REAR' },
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(`DELETE FROM pbring_sds_param_config WHERE machine_type_name = ANY($1) AND source = 'condition'`, [MACHINES]);
    console.log('Reverted: condition-sourced GW/DW rows removed for', MACHINES.join(', '));
    await recordRevert({ file: __filename });
    return;
  }

  for (const machine of MACHINES) {
    await engPool.query(`DELETE FROM pbring_sds_param_config WHERE machine_type_name = $1 AND source = 'condition'`, [machine]);
    const { rows: maxRows } = await engPool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM pbring_sds_param_config WHERE machine_type_name = $1`,
      [machine]
    );
    let order = maxRows[0].max_order;

    const cols = ['machine_type_name', 'sort_order', 'label', 'param_key', 'source', 'tool_number', 'condition_field', 'created_by'];
    const c = cols.length;
    const values = [];
    const placeholders = ROWS.map((row, ri) => {
      order += 1;
      const paramKey = `${row.tool_number}_${row.field}`; // synthetic, unique per row — not resolved via params map when source='condition'
      values.push(machine, order, row.label, paramKey, 'condition', row.tool_number, row.field, 'migration:20261010d');
      return `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`;
    }).join(',');

    await engPool.query(`INSERT INTO pbring_sds_param_config (${cols.join(',')}) VALUES ${placeholders}`, values);
    console.log(`${machine}: inserted ${ROWS.length} condition-sourced row(s), sort_order ${maxRows[0].max_order + 1}-${order}`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261010d_pbring_seed_kvd_gw_dw_condition_rows.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
