'use strict';

/**
 * Create `pbring_machine_tool` — a PB Ring-only analog of the real SDS
 * system's `sds_machine_tool` (user decision, 2026-10-19, after discussing
 * why BLADE's DWG number differed between the Tooling List and the SDS
 * source file for the same CN).
 *
 * The real `sds_machine_tool` is keyed by (machine_type, process_code) only
 * — never by CN — and says "T1 on this machine+process is whatever tool_dwg_no
 * starts with this family"; the actual per-CN value is read live from the
 * factory's own process plan and matched through that whitelist. This table
 * mirrors that shape exactly: (machine_type_name, process_code, tool_number)
 * -> family. The per-CN VALUE then comes from `pbring_tooling` (the actively
 * maintained Tooling List this session has been syncing), matched by family,
 * instead of being frozen inside `pbring_sds_condition` — which was a
 * one-time 2026-10-02 import from a separate, now-unmaintained SDS source
 * file and has drifted from the Tooling List since (confirmed live: HIGRIND1D
 * BLADE shows differently in the two tables for several CNs).
 *
 * `pbring_sds_condition` is NOT replaced — it still supplies which tool
 * numbers exist at all for a (cn, machine, process), and every condition
 * field this whitelist doesn't cover (vc/f/ap/nose_r/insert_info/holder_info,
 * the Turning-only fields, GW/RW). Only tooling_no/maker on a WHITELISTED
 * numbered T-slot get resolved from pbring_tooling instead — see
 * 20261019d_pbring_wire_machine_tool_whitelist.js (and the matching code
 * change in buildPbRingValueMap) for how the override is applied, with a
 * fail-open fallback to the condition table's own value when pbring_tooling
 * has no matching row for that CN.
 *
 * `--revert` drops the table.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(`DROP TABLE IF EXISTS pbring_machine_tool`);
    console.log('reverted: dropped pbring_machine_tool');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`
    CREATE TABLE IF NOT EXISTS pbring_machine_tool (
      id                 SERIAL PRIMARY KEY,
      machine_type_name  VARCHAR(64) NOT NULL,
      process_code       VARCHAR(32) NOT NULL,
      tool_number        VARCHAR(16) NOT NULL,
      family             VARCHAR(128) NOT NULL,
      created_by         VARCHAR(50),
      updated_by         VARCHAR(50),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (machine_type_name, process_code, tool_number)
    )
  `);
  console.log('created: pbring_machine_tool');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261019c_pbring_create_machine_tool_whitelist.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
