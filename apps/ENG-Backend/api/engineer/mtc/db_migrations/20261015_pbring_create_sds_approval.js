'use strict';

/**
 * PB Ring sheet approval — Prepared / Checked / Approved, same 3-step shape
 * and sequencing as the real `sds_approval` (sdsApprovalController.js), but
 * a SEPARATE table and a simpler permission model (user decision,
 * 2026-10-11: "3 steps like the real one", own gate not the real
 * sds_approval_role_config). Why separate: several PB Ring machine codes
 * share their real display name with an already-registered SDS machine
 * (e.g. KVD-300CRII) — signing into the shared `sds_approval` table under
 * that name would write into the SAME row a real engineer's approval for
 * the REAL production sheet lives in. PB Ring never writes to any sds_*
 * table (see CLAUDE.md "why strict separation matters"); this is that rule
 * applied to approval the same way it was already applied to every other
 * PB Ring table.
 *
 * Wide, one-row-per-sheet shape (mirrors sds_approval): each role has its
 * own em_id/name/at columns, so a fully-signed sheet is one row. No sds_rev
 * in the key — PB Ring's own SdsRev concept (pbring_sds_param.rev, default
 * 'NC') rarely changes and versioning approvals by it was judged
 * unnecessary complexity for this first version; add it later if a real
 * PB Ring sheet revision ever needs to invalidate a prior approval.
 *
 * No role-config table, no backfill route, no Kanban board intake — every
 * sign/revoke is gated by the SAME `isPbringAdmin` (hasFeature('pbring_admin'))
 * already used for every other structural PB Ring action (+New HW, Delete HW,
 * cost approve/reject). See pbringGridService.js / pbringGridController.js
 * for the sign/revoke logic, pbringRoutes.js for the routes.
 *
 * Idempotent; `--revert` drops the table.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_sds_approval (
  id                 SERIAL PRIMARY KEY,
  cn                 VARCHAR(20) NOT NULL,
  machine_type_name  VARCHAR(64) NOT NULL REFERENCES pbring_machine_type(machine_type_name) ON DELETE CASCADE,
  process_code       VARCHAR(20) NOT NULL,
  prepared_em_id     TEXT, prepared_name TEXT, prepared_at TIMESTAMPTZ,
  checked_em_id      TEXT, checked_name  TEXT, checked_at  TIMESTAMPTZ,
  approved_em_id     TEXT, approved_name TEXT, approved_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cn, machine_type_name, process_code)
);
CREATE INDEX IF NOT EXISTS pbring_sds_approval_lookup_idx
  ON pbring_sds_approval (cn, machine_type_name, process_code);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_sds_approval');
    console.log('reverted: pbring_sds_approval dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  console.log('pbring_sds_approval created');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015_pbring_create_sds_approval.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
