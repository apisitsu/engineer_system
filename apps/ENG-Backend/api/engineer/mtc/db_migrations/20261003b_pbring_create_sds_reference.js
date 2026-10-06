'use strict';

/**
 * Create `pbring_sds_param` and `pbring_sds_condition` — the read-mostly Setup
 * Data Sheet cross-reference for PB Ring parts (ported from the prototype's
 * `setup_params.csv` / `setup_conditions.csv`, themselves built from
 * `Setup_Data_SheetV3.4.2.xlsx`'s per-machine sheets).
 *
 * These feed both the search page (section 2/3 of the original prototype) and,
 * later, the PB Ring grid-template PDF. Independent of every `sds_*` table —
 * see 20261003_pbring_create_core.js for why that separation is load-bearing.
 *
 * Idempotent; `--revert` drops both tables.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_sds_param (
  id            BIGSERIAL PRIMARY KEY,
  cn            VARCHAR(64),
  pn            VARCHAR(64),
  process_code  VARCHAR(32),
  process_name  VARCHAR(128),
  machine       VARCHAR(64),
  mc_key        VARCHAR(64),
  ct            VARCHAR(32),
  rev           VARCHAR(32),
  approved      VARCHAR(32),
  params        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS pbring_sds_param_cn_idx      ON pbring_sds_param (cn);
CREATE INDEX IF NOT EXISTS pbring_sds_param_pc_idx      ON pbring_sds_param (process_code);
CREATE INDEX IF NOT EXISTS pbring_sds_param_mc_key_idx  ON pbring_sds_param (mc_key);

CREATE TABLE IF NOT EXISTS pbring_sds_condition (
  id                BIGSERIAL PRIMARY KEY,
  cn                VARCHAR(64),
  pn                VARCHAR(64),
  process_code      VARCHAR(32),
  machine           VARCHAR(64),
  mc_key            VARCHAR(64),
  kind              VARCHAR(32),
  sds_rev           VARCHAR(32),
  tool_number       VARCHAR(32),
  tooling_no        VARCHAR(128),
  maker             VARCHAR(64),
  tool_detail       VARCHAR(255),
  insert_info       VARCHAR(255),
  holder_info       VARCHAR(255),
  holder_maker      VARCHAR(64),
  overhang          VARCHAR(64),
  vc                VARCHAR(32),
  f                 VARCHAR(32),
  ap                VARCHAR(32),
  nose_r            VARCHAR(32),
  in_tooling_list   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS pbring_sds_condition_cn_idx      ON pbring_sds_condition (cn);
CREATE INDEX IF NOT EXISTS pbring_sds_condition_pc_idx      ON pbring_sds_condition (process_code);
CREATE INDEX IF NOT EXISTS pbring_sds_condition_mc_key_idx  ON pbring_sds_condition (mc_key);
`;

const COMMENTS = `
COMMENT ON TABLE pbring_sds_param IS $c$PB Ring Setup Data Sheet parameters (long-format params grouped into one JSONB map per cn+process_code+machine). Ported from the prototype's setup_params.csv. Independent of sds_parameter.$c$;
COMMENT ON TABLE pbring_sds_condition IS $c$PB Ring tool/wheel/insert conditions per cn+process_code+machine. Ported from the prototype's setup_conditions.csv. Independent of sds_machine_tool.$c$;
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_sds_condition');
    await engPool.query('DROP TABLE IF EXISTS pbring_sds_param');
    console.log('reverted: pbring_sds_condition, pbring_sds_param dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  await engPool.query(COMMENTS);

  for (const t of ['pbring_sds_param', 'pbring_sds_condition']) {
    const { rows } = await engPool.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${rows[0].n} row(s)`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261003b_pbring_create_sds_reference.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
