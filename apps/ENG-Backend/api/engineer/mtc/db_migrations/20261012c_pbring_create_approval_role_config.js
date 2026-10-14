'use strict';

/**
 * `pbring_approval_role_config` — who may sign each PB Ring approval role,
 * same shape and semantics as the real `sds_approval_role_config` (CLAUDE.md
 * "SDS Approval → Kanban board" / sdsApprovalController.js's `userCanSign`).
 * User request (2026-10-12): reuse the real ApprovalRoleConfig.jsx UI for PB
 * Ring rather than build a second one — this table is what it needs to exist
 * for PB Ring's own backend to have.
 *
 * Deliberately a SEPARATE table from `sds_approval_role_config`, same reason
 * `pbring_sds_approval` is separate from `sds_approval`: this only ever gates
 * signing on `pbring_sds_approval`, never the real production approval.
 *
 * `pbring_sds_approval`'s own route (`POST/DELETE /grid/approval`) is no
 * longer gated `isPbringAdmin` at the router level once this lands — the
 * permission check moves inside the handler (admin override, or a matching
 * enabled rule here), same as the real sign route. Until an admin adds a
 * rule, the table is empty and only an admin (department/role 'AD', or the
 * `pbring_admin`/`all_mtc` permission) can sign — identical behaviour to
 * today, just enforced in code instead of by the route guard.
 *
 * Idempotent; `--revert` drops the table.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_approval_role_config (
  id          SERIAL PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('prepared','checked','approved')),
  match_type  TEXT NOT NULL CHECK (match_type IN ('any','department','role','feature_perm','em_id')),
  match_value TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_approval_role_config');
    console.log('reverted: pbring_approval_role_config dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  console.log('pbring_approval_role_config created');

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261012c_pbring_create_approval_role_config.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
