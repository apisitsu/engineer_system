'use strict';
/**
 * Granular per-feature admin permissions for Tooling Select + SDS.
 *
 * Background: admin was all-or-nothing — `isAdmin` (department/role === 'AD')
 * guards EVERY admin surface. To let specific MTC engineers administer ONLY
 * Tooling Select and/or Setup Data Sheet (SDS) without blanket 'AD' admin, a
 * `feature_perms text[]` column is added to m_user_profile. The login flow puts
 * it into the JWT (`perms`), and the new `hasFeature(feature)` middleware passes
 * when the user is full 'AD' admin OR holds the named feature permission.
 *
 * Feature keys:
 *   'tooling_admin' → Tooling Select admin (tsv2Routes + specController)
 *   'sds_admin'     → SDS admin (sdsV2AdminController + coverage-report config)
 *
 * Grant (per request 2026-06-22):
 *   T1460 (Pattanapong Promya, MTC Head)         → tooling_admin + sds_admin
 *   LE403 (Chairat Sripratueng, Tooling&Machine) → tooling_admin + sds_admin
 *
 * NOTE: perms live in the JWT, so the two users must RE-LOGIN to pick up the
 * new permissions (existing tokens predate the grant).
 *
 * Idempotent. Run: node db_migrations/20260622_add_feature_perms_and_grant.js
 */
const { engPool } = require('../instance/eng_db');

const GRANTS = [
  ['T1460', ['tooling_admin', 'sds_admin']],
  ['LE403', ['tooling_admin', 'sds_admin']],
];

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Column (idempotent)
    await client.query(
      `ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS feature_perms text[] DEFAULT '{}'::text[]`
    );

    // 2. Grants — case-insensitive match on u_code; overwrite to the exact set
    for (const [code, perms] of GRANTS) {
      const r = await client.query(
        `UPDATE m_user_profile SET feature_perms = $2, updated_at = NOW()
           WHERE upper(u_code) = upper($1)`,
        [code, perms]
      );
      if (r.rowCount === 0) {
        throw new Error(`user ${code} not found in m_user_profile`);
      }
      console.log(`✓ ${code} → {${perms.join(', ')}}`);
    }

    await client.query('COMMIT');
    console.log('✅ done. Users must RE-LOGIN to refresh their JWT perms.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
