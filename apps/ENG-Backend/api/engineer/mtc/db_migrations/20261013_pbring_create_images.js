'use strict';

/**
 * PB Ring tooling + grinding-area photos — same visual slot as the real SDS
 * sheet (T01-T20 tool-photo boxes, the "Grinding Area" picture box), own
 * tables, keyed simply per the user's explicit decision (2026-10-08):
 *
 * - `pbring_tooling_image`: keyed by (machine_type_name, tooling_no) —
 *   exact match against `pbring_sds_condition.tooling_no`, no DWG-family
 *   prefix matching like the real `sds_tooling_image` grew into over time.
 * - `pbring_grinding_image`: keyed by (machine_type_name, cn, process_code)
 *   — exact triplet, no specificity-level fallback like the real
 *   `sds_grinding_image` (CN / family / class). Start simple; only add
 *   fallback levels if PB Ring's own data shows a real need for it.
 *
 * Same bytea storage shape as `sds_tooling_image`/`sds_grinding_image`
 * (image_data/mime_type/file_name/description) — no coupling, just the
 * same proven shape. Idempotent; `--revert` drops both tables.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_tooling_image (
  id                 SERIAL PRIMARY KEY,
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  tooling_no         VARCHAR(100) NOT NULL,
  image_data         BYTEA NOT NULL,
  mime_type          VARCHAR(50),
  file_name          VARCHAR(255),
  description        TEXT,
  created_by         VARCHAR(100),
  updated_by         VARCHAR(100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_type_name, tooling_no)
);
CREATE INDEX IF NOT EXISTS pbring_tooling_image_machine_idx ON pbring_tooling_image (machine_type_name);

CREATE TABLE IF NOT EXISTS pbring_grinding_image (
  id                 SERIAL PRIMARY KEY,
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  cn                 VARCHAR(20) NOT NULL,
  process_code       VARCHAR(20) NOT NULL,
  image_data         BYTEA NOT NULL,
  mime_type          VARCHAR(50),
  file_name          VARCHAR(255),
  description        TEXT,
  created_by         VARCHAR(100),
  updated_by         VARCHAR(100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (machine_type_name, cn, process_code)
);
CREATE INDEX IF NOT EXISTS pbring_grinding_image_machine_idx ON pbring_grinding_image (machine_type_name);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_tooling_image');
    await engPool.query('DROP TABLE IF EXISTS pbring_grinding_image');
    console.log('reverted: pbring_tooling_image, pbring_grinding_image dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  console.log('pbring_tooling_image + pbring_grinding_image created');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261013_pbring_create_images.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
