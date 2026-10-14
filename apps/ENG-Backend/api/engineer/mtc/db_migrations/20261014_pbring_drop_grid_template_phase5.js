'use strict';

/**
 * Drops `pbring_grid_template` and `pbring_excel_mapping`, and
 * `pbring_machine_type.grid_template_id` — the whole Phase 5 PDF-render
 * pipeline (xlsx-imported `{{param}}`-literal templates, cell-address
 * mapping, the machine<->template assignment it needed). Superseded
 * 2026-10-07 by Phase 6 (`pbringGridService.loadStandardGridLive` /
 * `buildStandardGridForMachine`), which renders every PB Ring machine
 * through the real, live `sds_grid_template` "Standard" layout instead —
 * read-only, no CN involved, never touches real production data.
 *
 * Confirmed live before writing this migration (2026-10-14): neither table
 * is referenced by any live code path.
 *   - `pbring_excel_mapping` (2,135 rows): zero references anywhere in
 *     apps/ENG-Backend outside this migration family and a doc comment —
 *     not even the Phase 5 functions themselves ever queried it; value
 *     resolution was always done by `classifyParam`'s pure name-based logic.
 *   - `pbring_grid_template` (18 rows): queried only by the Phase 5 CRUD
 *     functions (`loadGridForMachine`, `listTemplates`, `createTemplate`,
 *     etc.), which were themselves called only by routes that had exactly
 *     one UI caller — `PbRingGridTemplateEditor.jsx`/`PbRingTemplateConfigPage.jsx`
 *     — already deleted (no sidebar entry, orphaned route) earlier the same
 *     day this migration was written.
 * The 18/2,135 rows are therefore a one-time xlsx-import artifact, not
 * anything an admin ever hand-edited through the (now-removed) editor —
 * safe to drop outright rather than archive.
 *
 * `pbring_machine_type` itself (the FK's other side) is untouched — only
 * its now-meaningless `grid_template_id` column goes. `is_active` and
 * `source_sheet_name` (import provenance, still informative) stay.
 *
 * Idempotent; `--revert` recreates both tables (empty — the DDL, not the
 * data, since the dropped rows were artifacts not edits) and re-adds the
 * column.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const REVERT_DDL = `
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

ALTER TABLE pbring_machine_type ADD COLUMN IF NOT EXISTS grid_template_id
  INTEGER REFERENCES pbring_grid_template(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS pbring_excel_mapping (
  id                  SERIAL PRIMARY KEY,
  machine_type_name   VARCHAR(64),
  cell_address        VARCHAR(16) NOT NULL,
  param_key           VARCHAR(128) NOT NULL,
  source              VARCHAR(16) NOT NULL CHECK (source IN ('param','condition')),
  tool_number         VARCHAR(16),
  condition_field     VARCHAR(32),
  UNIQUE (machine_type_name, cell_address, param_key)
);
CREATE INDEX IF NOT EXISTS pbring_excel_mapping_machine_idx ON pbring_excel_mapping (machine_type_name);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(REVERT_DDL);
    console.log('reverted: pbring_grid_template + pbring_excel_mapping recreated (empty), pbring_machine_type.grid_template_id re-added');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query('ALTER TABLE pbring_machine_type DROP COLUMN IF EXISTS grid_template_id');
  await engPool.query('DROP TABLE IF EXISTS pbring_excel_mapping');
  await engPool.query('DROP TABLE IF EXISTS pbring_grid_template');
  console.log('dropped: pbring_excel_mapping, pbring_grid_template; pbring_machine_type.grid_template_id column dropped');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261014_pbring_drop_grid_template_phase5.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
