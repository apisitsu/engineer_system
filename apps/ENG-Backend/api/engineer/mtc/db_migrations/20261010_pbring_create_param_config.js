'use strict';

/**
 * Create `pbring_sds_param_config` — Phase 6, problem #3 ("PB Ring Parameter
 * Config"). One row per (machine, sort_order): which PB Ring `params` JSONB
 * key shows at that position in the GRIND/DRESS CONDITION list, with what
 * label and unit.
 * ------------------------------------------------------------------------------
 * Mirrors the ROLE of the live SDS "Excel Parameter Config" admin tab (which
 * is itself just free-text `sds_parameter.row_N_A/C/D/E/H/I` rows per
 * machine — confirmed live: zero `sds_excel_mapping` rows and zero grid_json
 * cell text cover this area at all, so there is nothing structural to mirror
 * beyond the row/label/value/unit shape). PB Ring's own table, independent of
 * `sds_parameter` — never written to, never read from, for the CN-collision
 * reason recorded in the Phase 6 plan (PB Ring's CN is a REAL factory CN; a
 * shared machine+process could collide with a real part's data once Innovator
 * registration catches up).
 *
 * `sort_order` is the position in the rendered condition list (what reads as
 * "#01", "#02", ... on the printed sheet) — independent per machine, since
 * each grinding machine's condition list is its own, same as the real system.
 *
 * Idempotent; `--revert` drops the table.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_sds_param_config (
  id                 SERIAL PRIMARY KEY,
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  sort_order         INTEGER NOT NULL,
  label              VARCHAR(200),
  param_key          VARCHAR(128) NOT NULL,
  unit               VARCHAR(32),
  created_by         VARCHAR(50),
  updated_by         VARCHAR(50),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_type_name, sort_order)
);
CREATE INDEX IF NOT EXISTS pbring_sds_param_config_machine_idx ON pbring_sds_param_config (machine_type_name);
`;

const COMMENT = `
COMMENT ON TABLE pbring_sds_param_config IS $c$Per-machine GRIND/DRESS CONDITION row definitions for PB Ring's grid PDF. Independent of sds_parameter (never shared — PB Ring CNs are real factory CNs, see Phase 6 plan). Seeded from the original xlsx import by 20261010b_pbring_import_param_config.js, editable afterward via the PB Ring Parameter Config admin page.$c$;
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_sds_param_config');
    console.log('reverted: pbring_sds_param_config dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  await engPool.query(COMMENT);

  const { rows } = await engPool.query(`SELECT count(*)::int AS n FROM pbring_sds_param_config`);
  console.log(`pbring_sds_param_config: ${rows[0].n} row(s)`);

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261010_pbring_create_param_config.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
