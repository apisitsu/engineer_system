'use strict';
/**
 * Copy the SDS Excel Parameter Config (machine-config rows, cn IS NULL) from OC-16A to the
 * sibling NISSIN HIGRIND-1-D machines OC-18BR-150 and OC-20BR-200, which share the identical
 * SDS layout. Requested 2026-06-23 after OC-16A's config was authored in the admin UI.
 *
 * Source : sds_parameter WHERE cn IS NULL AND machine_type_name = 'OC-16A' (151 rows, all
 *          row_N_COL / gw_row_N_COL keys → placed by cell address; OC-16A has no own
 *          sds_excel_mapping rows, it uses the SHARED machine_type_name=NULL mapping, so only
 *          sds_parameter needs copying).
 * Targets: OC-18BR-150 (id 11) and OC-20BR-200 (id 414) — both active sds_machine_type_code.
 *
 * sds_parameter has NO unique key (PK on id only), so to make a target IDENTICAL to the source
 * we DELETE the target's existing cn-NULL rows then INSERT copies. cn-specific (per-part) rows
 * are untouched (the WHERE cn IS NULL guard). Idempotent — re-running reproduces the same set.
 *
 * Run: node db_migrations/20260623_copy_oc16a_sds_param_config.js
 */

const { engPool } = require('../instance/eng_db');

const SOURCE = 'OC-16A';
const TARGETS = [
  { name: 'OC-18BR-150', id: 11 },
  { name: 'OC-20BR-200', id: 414 },
];

async function run() {
  const client = await engPool.connect();
  try {
    const src = await client.query(
      `SELECT COUNT(*)::int n FROM sds_parameter WHERE cn IS NULL AND machine_type_name = $1`,
      [SOURCE]);
    const srcN = src.rows[0].n;
    if (!srcN) throw new Error(`source ${SOURCE} has no cn-NULL parameter rows`);
    console.log(`source ${SOURCE}: ${srcN} parameter rows`);

    await client.query('BEGIN');
    for (const t of TARGETS) {
      const del = await client.query(
        `DELETE FROM sds_parameter WHERE cn IS NULL AND machine_type_name = $1`, [t.name]);
      const ins = await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, machine_type_id, param_key, param_value, created_by, updated_by)
         SELECT NULL, $1, $2, param_key, param_value, $3, $3
           FROM sds_parameter WHERE cn IS NULL AND machine_type_name = $4`,
        [t.name, t.id, 'copy:OC-16A', SOURCE]);
      console.log(`  ${t.name}: deleted ${del.rowCount}, inserted ${ins.rowCount}`);
    }
    await client.query('COMMIT');
    console.log('✅ OC-16A SDS parameter config copied to OC-18BR-150 + OC-20BR-200');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ copy failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
