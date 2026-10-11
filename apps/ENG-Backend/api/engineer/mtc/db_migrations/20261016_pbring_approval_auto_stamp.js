'use strict';

/**
 * Adds Auto Stamp to PB Ring's own approval table (pbring_sds_approval,
 * 20261015_) — mirrors the real sds_auto_stamp_config (20260904_) in shape,
 * but stays entirely within PB Ring's own tables, same separation
 * principle as pbring_sds_approval itself: several PB Ring machine codes
 * share their real display name with an already-registered SDS machine,
 * so an auto-signer writing into the shared sds_approval would risk
 * stamping a REAL production sheet with no one having reviewed its real
 * (Tooling-Select-driven) data.
 *
 * `*_source` columns (prepared_source/checked_source/approved_source) let
 * a signed role be told apart as 'live' (someone pressed Sign) vs 'auto'
 * (the configured responsible person, via pbringAutoStamp.js) — same
 * governance rationale as the real system: the seal carries a real
 * person's name even when they did not press Sign, so the distinction
 * matters for anyone auditing later.
 *
 * `pbring_auto_stamp_config` is a single row (id=1), disabled by default.
 * No role-config fallback (unlike the real sds_auto_stamp_config, which
 * falls back to sds_approval_role_config) — PB Ring has no equivalent
 * configurable permission matrix; the explicit em_id per role IS the only
 * source, consistent with PB Ring's one-tier isPbringAdmin gate everywhere
 * else.
 *
 * Idempotent; `--revert` drops the config table and the three columns.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
ALTER TABLE pbring_sds_approval ADD COLUMN IF NOT EXISTS prepared_source TEXT;
ALTER TABLE pbring_sds_approval ADD COLUMN IF NOT EXISTS checked_source  TEXT;
ALTER TABLE pbring_sds_approval ADD COLUMN IF NOT EXISTS approved_source TEXT;

CREATE TABLE IF NOT EXISTS pbring_auto_stamp_config (
  id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled        BOOLEAN NOT NULL DEFAULT false,
  prepared_em_id TEXT, prepared_name TEXT,
  checked_em_id  TEXT, checked_name  TEXT,
  approved_em_id TEXT, approved_name TEXT,
  max_per_run    INT NOT NULL DEFAULT 200,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO pbring_auto_stamp_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_auto_stamp_config');
    await engPool.query('ALTER TABLE pbring_sds_approval DROP COLUMN IF EXISTS prepared_source');
    await engPool.query('ALTER TABLE pbring_sds_approval DROP COLUMN IF EXISTS checked_source');
    await engPool.query('ALTER TABLE pbring_sds_approval DROP COLUMN IF EXISTS approved_source');
    console.log('reverted: pbring_auto_stamp_config dropped, *_source columns removed');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  console.log('pbring_auto_stamp_config created; pbring_sds_approval got *_source columns');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261016_pbring_approval_auto_stamp.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
