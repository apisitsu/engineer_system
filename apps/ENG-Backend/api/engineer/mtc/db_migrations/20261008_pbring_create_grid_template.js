'use strict';

/**
 * Create the PB Ring grid-template/PDF tables — `pbring_grid_template`,
 * `pbring_machine_type`, `pbring_excel_mapping` — plus four columns
 * `pbring_sds_condition` is missing that the PB Ring template workbook
 * references (`rotation`, `hand`, `usaged`, `h_width`).
 * ------------------------------------------------------------------------------
 * Independent of every `sds_*` table (`sds_grid_template`, `sds_machine_type_code`,
 * `sds_excel_mapping`) — same shape, same purpose, zero shared rows or code. See
 * the "Phase 5" section of the pbring plan for the full design.
 *
 * Deliberately NO `pbring_machine_tool` table (the `sds_machine_tool` T01-T20
 * whitelist this would have mirrored). The PB Ring template workbook doesn't
 * address tool slots that way — every per-tool placeholder (`Tooling_No_3`,
 * `VC_3`, `F_DW_Maker`, ...) resolves directly against `pbring_sds_condition
 * .tool_number` (which already holds string keys like 'T3'/'F_DW' live), via
 * the `tool_number`/`condition_field` columns on `pbring_excel_mapping` below.
 *
 * Idempotent; `--revert` drops the three new tables (child-to-parent) and the
 * four added `pbring_sds_condition` columns.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_grid_template (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL UNIQUE,
  grid_json   TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  VARCHAR(50),
  updated_by  VARCHAR(50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pbring_grid_template_one_default
  ON pbring_grid_template (is_default) WHERE is_default;

CREATE TABLE IF NOT EXISTS pbring_machine_type (
  id                 SERIAL PRIMARY KEY,
  machine_type_name  VARCHAR(64) NOT NULL UNIQUE,
  source_sheet_name  VARCHAR(64),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  grid_template_id   INTEGER REFERENCES pbring_grid_template(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pbring_excel_mapping (
  id                  SERIAL PRIMARY KEY,
  machine_type_name   VARCHAR(64),
  cell_address        VARCHAR(16) NOT NULL,
  param_key           VARCHAR(128) NOT NULL,
  source              VARCHAR(16) NOT NULL CHECK (source IN ('param','condition')),
  tool_number         VARCHAR(16),
  condition_field     VARCHAR(32),
  -- A cell can hold more than one {{param}} placeholder in its text (e.g.
  -- "PROCESS : {{Process_Code}} - {{Process}}"), so the key includes
  -- param_key, not just (machine_type_name, cell_address).
  UNIQUE (machine_type_name, cell_address, param_key)
);
CREATE INDEX IF NOT EXISTS pbring_excel_mapping_machine_idx ON pbring_excel_mapping (machine_type_name);

ALTER TABLE pbring_sds_condition ADD COLUMN IF NOT EXISTS rotation TEXT;
ALTER TABLE pbring_sds_condition ADD COLUMN IF NOT EXISTS hand TEXT;
ALTER TABLE pbring_sds_condition ADD COLUMN IF NOT EXISTS usaged TEXT;
ALTER TABLE pbring_sds_condition ADD COLUMN IF NOT EXISTS h_width TEXT;
`;

const COMMENTS = `
COMMENT ON TABLE pbring_grid_template IS $c$PB Ring's own grid-template store, independent of sds_grid_template. grid_json shape mirrors it (rows/cols/colW/rowH/borders/fills/cells/merges, 0-based "r,c" keys) for code reuse only, never joined with it. See 20261008_pbring_create_grid_template.js.$c$;
COMMENT ON TABLE pbring_machine_type IS $c$PB Ring's own machine registry, independent of sds_machine_type_code. machine_type_name = pbring_tooling.mc_key spelling (e.g. 'KVD300'); source_sheet_name is the xlsx tab it was imported from, for provenance only.$c$;
COMMENT ON TABLE pbring_excel_mapping IS $c$Cell-address -> param_key mapping per machine, independent of sds_excel_mapping. source='param' resolves from pbring_sds_param.params; source='condition' resolves from pbring_sds_condition via (tool_number, condition_field).$c$;
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_excel_mapping');
    await engPool.query('DROP TABLE IF EXISTS pbring_machine_type');
    await engPool.query('DROP TABLE IF EXISTS pbring_grid_template');
    await engPool.query('ALTER TABLE pbring_sds_condition DROP COLUMN IF EXISTS rotation');
    await engPool.query('ALTER TABLE pbring_sds_condition DROP COLUMN IF EXISTS hand');
    await engPool.query('ALTER TABLE pbring_sds_condition DROP COLUMN IF EXISTS usaged');
    await engPool.query('ALTER TABLE pbring_sds_condition DROP COLUMN IF EXISTS h_width');
    console.log('reverted: pbring_excel_mapping, pbring_machine_type, pbring_grid_template dropped; 4 pbring_sds_condition columns dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  await engPool.query(COMMENTS);

  for (const t of ['pbring_grid_template', 'pbring_machine_type', 'pbring_excel_mapping']) {
    const { rows } = await engPool.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${rows[0].n} row(s)`);
  }
  const cols = await engPool.query(`
    SELECT column_name FROM information_schema.columns
     WHERE table_name = 'pbring_sds_condition' AND column_name IN ('rotation','hand','usaged','h_width')
     ORDER BY column_name
  `);
  console.log('pbring_sds_condition new columns:', cols.rows.map((r) => r.column_name).join(', '));

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261008_pbring_create_grid_template.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
