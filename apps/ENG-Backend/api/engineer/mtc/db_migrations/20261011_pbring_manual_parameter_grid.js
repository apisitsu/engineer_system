'use strict';

/**
 * Supersedes `pbring_sds_param_config` (20261010/b/c/d) with
 * `pbring_sds_parameter` — a direct PB Ring mirror of the real SDS
 * `sds_parameter` table (same `row_N_COL` / `row_N_is_header` /
 * `row_N_COL_type` / `gw_row_N_COL` key convention, same
 * machine-default-vs-CN-override shape).
 *
 * Why the reversal: the auto-resolved `pbring_sds_param_config` (sort_order +
 * source='param'|'condition') was built to spare an admin from retyping data
 * PB Ring already has in `pbring_sds_param`/`pbring_sds_condition`. The user
 * asked instead for the PB Ring "Parameter Config"/"Grinding Wheel Config"
 * admin page to be an exact replica of the real SDS "Excel Parameter Config"
 * tab — including that every value is admin-typed free text, no automatic
 * resolution, with machine-default + CN-override (optionally process-scoped)
 * the same way `sds_parameter` works. That is a different data shape, not an
 * extra column on the old one, hence the new table.
 *
 * `pbring_sds_param`/`pbring_sds_condition` are untouched — they still drive
 * the header fields and T01-T20 tool slots, which stay auto-resolved (the
 * real system's own "Excel Parameter Config"/"Excel Grinding Wheel Config"
 * tabs don't cover those either; they come from a different live subsystem
 * there — T-Select — which PB Ring has no equivalent of).
 *
 * Idempotent; `--revert` drops `pbring_sds_parameter` and recreates
 * `pbring_sds_param_config`'s final schema (data is not restored — same
 * tradeoff any DROP TABLE revert has).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_sds_parameter (
  id                 SERIAL PRIMARY KEY,
  cn                 VARCHAR(20),
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  param_key          VARCHAR(64) NOT NULL,
  param_value        TEXT,
  process_code       VARCHAR(20),
  updated_by         VARCHAR(50),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pbring_sds_parameter_key
  ON pbring_sds_parameter (
    COALESCE(cn, '__machine_config__'),
    machine_type_name,
    param_key,
    COALESCE(process_code, '__all__')
  );
CREATE INDEX IF NOT EXISTS pbring_sds_parameter_machine_idx ON pbring_sds_parameter (machine_type_name);
`;

const COMMENT = `
COMMENT ON TABLE pbring_sds_parameter IS $c$Hand-typed PB Ring GRIND/DRESS CONDITION + Grinding Wheel Config values, mirroring sds_parameter's row_N_COL / gw_row_N_COL key convention. cn IS NULL = machine default; cn set = CN override, optionally scoped to one process_code. Never shared with sds_parameter (PB Ring CNs are real factory CNs — see Phase 6 plan). Supersedes pbring_sds_param_config (dropped by this migration).$c$;
`;

const REVERT_RECREATE_PARAM_CONFIG = `
CREATE TABLE IF NOT EXISTS pbring_sds_param_config (
  id                 SERIAL PRIMARY KEY,
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  sort_order         INTEGER NOT NULL,
  label              VARCHAR(200),
  param_key          VARCHAR(128) NOT NULL,
  unit               VARCHAR(32),
  source             VARCHAR(16) NOT NULL DEFAULT 'param' CHECK (source IN ('param','condition')),
  tool_number        VARCHAR(16),
  condition_field    VARCHAR(32),
  created_by         VARCHAR(50),
  updated_by         VARCHAR(50),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_type_name, sort_order)
);
CREATE INDEX IF NOT EXISTS pbring_sds_param_config_machine_idx ON pbring_sds_param_config (machine_type_name);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_sds_parameter');
    await engPool.query(REVERT_RECREATE_PARAM_CONFIG);
    console.log('reverted: pbring_sds_parameter dropped, pbring_sds_param_config recreated (empty)');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  await engPool.query(COMMENT);
  await engPool.query('DROP TABLE IF EXISTS pbring_sds_param_config');

  console.log('pbring_sds_parameter created; pbring_sds_param_config dropped');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261011_pbring_manual_parameter_grid.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
