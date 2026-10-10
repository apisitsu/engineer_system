'use strict';

/**
 * Extends `pbring_sds_param_config` to resolve a row's value from either
 * `pbring_sds_param.params` (the default, `source='param'`) OR
 * `pbring_sds_condition` by (tool_number, condition_field)
 * (`source='condition'`) — same two-source shape `pbring_excel_mapping`
 * already uses, for the same reason: not every value lives in the flat
 * params JSONB.
 * ------------------------------------------------------------------------------
 * Found live 2026-10-08: KVD300/KVD350 ("hsg_" family — verified the ONLY two
 * machines, by a direct query against pbring_sds_condition) store their
 * grinding-wheel / dressing-wheel data as `pbring_sds_condition` rows keyed
 * by tool_number ('Upper_GW','Lower_GW','F_DW','R_DW'), not as plain
 * `params` keys the way every other grinding machine's GW/RW spec+maker
 * fields do (cgm_* family: `GW_Spec`/`GW_Maker`/`RW_Spec`/`RW_Maker`, already
 * correctly seeded as plain param-config rows). The render code had been
 * assigning these 4 to generic T03-T06 tool slots — wrong: there is no
 * "GRINDING WHEEL DETAIL" section in the live Standard layout either (same
 * live-verified fact as the condition list itself — it's just more rows of
 * the same free-form list), so they belong in the condition list, resolved
 * from the condition table instead of the param map.
 *
 * Idempotent; `--revert` drops the three added columns (rows seeded by
 * 20261010d_pbring_seed_kvd_gw_dw_condition_rows.js are removed by that
 * migration's own revert, not this one).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
ALTER TABLE pbring_sds_param_config ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'param' CHECK (source IN ('param','condition'));
ALTER TABLE pbring_sds_param_config ADD COLUMN IF NOT EXISTS tool_number VARCHAR(16);
ALTER TABLE pbring_sds_param_config ADD COLUMN IF NOT EXISTS condition_field VARCHAR(32);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('ALTER TABLE pbring_sds_param_config DROP COLUMN IF EXISTS source');
    await engPool.query('ALTER TABLE pbring_sds_param_config DROP COLUMN IF EXISTS tool_number');
    await engPool.query('ALTER TABLE pbring_sds_param_config DROP COLUMN IF EXISTS condition_field');
    console.log('reverted: source/tool_number/condition_field columns dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  const cols = await engPool.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'pbring_sds_param_config' AND column_name IN ('source','tool_number','condition_field')
     ORDER BY column_name
  `);
  console.log('pbring_sds_param_config new columns:', cols.rows.map((r) => r.column_name).join(', '));

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261010c_pbring_param_config_condition_source.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
