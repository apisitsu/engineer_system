'use strict';

/**
 * `sds_excel_mapping` — wires the ONE fixture slot added to "Turning_General"
 * (`20261104d_create_turning_general_grid_template.js`) to the existing
 * T-Select/whitelist-fed param_keys `tool_name_T01` / `tool_dwg_no_T01` /
 * `maker_T01` — the same keys the older "Turning" template's F01-F08 section
 * reuses (see `20260916_seed_turning_excel_mapping_v2.js`'s own comment), so the
 * auto-fill mechanism (factory process plan + `sds_machine_tool` whitelist) just
 * works with no new data source. Image placement is separate — a new
 * `IMAGE_EXTENTS` entry + machine set in `sdsV2HeadlessController.js` (code, not
 * data, added by hand alongside this migration).
 *
 * Idempotent: deletes this machine's rows for the 3 param_keys/addresses first,
 * then re-inserts. `--revert` removes them. `--machine` may be repeated.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104f_seed_turning_general_fixture_mapping.js --machine="QTN200" --machine="LB12" --dry-run
 *   node api/engineer/mtc/db_migrations/20261104f_seed_turning_general_fixture_mapping.js --machine="QTN200" --machine="LB12"
 *   node api/engineer/mtc/db_migrations/20261104f_seed_turning_general_fixture_mapping.js --machine="QTN200" --revert
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

const FIELDS = [
  { param_key: 'tool_name_T01', cell_address: 'AM15', description: 'Turning_General fixture slot — tool name (T-Select/whitelist-driven)' },
  { param_key: 'tool_dwg_no_T01', cell_address: 'AM16', description: 'Turning_General fixture slot — tool drawing number' },
  // No maker_T01 row — dropped at the requester's request (always blank in
  // practice; no data source feeds it for this slot). Removing the mapping
  // row is enough — nothing else references AK18/AL18.
];

async function main() {
  if (!MACHINES.length) {
    console.error('[error] at least one --machine="<sds_machine_type_code.machine_type_name>" is required');
    process.exitCode = 1;
    return;
  }
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const client = await engPool.connect();
  try {
    const ownedKeys = FIELDS.map((f) => f.param_key);
    const ownedAddrs = FIELDS.map((f) => f.cell_address);

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

    if (dryRun) {
      FIELDS.forEach((f) => console.log(`  ${f.param_key.padEnd(20)} -> ${f.cell_address}`));
      console.log('\n[seed] --dry-run — no changes written. machines:', MACHINES.join(', '));
      return;
    }

    await client.query('BEGIN');
    for (const machine of MACHINES) {
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND (param_key = ANY($2) OR cell_address = ANY($3))`,
        [machine, ownedKeys, ownedAddrs]
      );
      const COLS = 4;
      const placeholders = FIELDS.map((_, i) => `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3},$${i * COLS + 4})`).join(',');
      const values = FIELDS.flatMap((f) => [machine, f.cell_address, f.param_key, f.description]);
      await client.query(`INSERT INTO ${TABLE} (machine_type_name, cell_address, param_key, description) VALUES ${placeholders}`, values);
      console.log(`  ${machine}: replaced ${del.rowCount} old row(s) with ${FIELDS.length} new row(s)`);
    }
    await client.query('COMMIT');
    console.log('[seed] done');
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
