'use strict';
/**
 * Grant the 'general_dwg_admin' feature permission — lets a non-AD person use the
 * General DWG Request "Setting" button (Email Config: recipients + stage-actor list)
 * without full 'AD' admin. Checked by hasFeature('general_dwg_admin') in server.js,
 * same mechanism as 'tooling_admin'/'sds_admin' from 20260622_add_feature_perms_and_grant.js.
 *
 * Grant (per request 2026-09-22):
 *   LE403 (Chairat Sripratueng)   → + general_dwg_admin
 *   T1460 (Pattanapong Promyai)   → + general_dwg_admin
 *   LB371 (Teerapol Kantapoom)    → + general_dwg_admin
 *
 * LE403 and T1460 already carry ['tooling_admin','sds_admin'] — this APPENDS rather
 * than overwriting (the 20260622 migration used a literal SET and would have erased
 * them had it been re-run for this). LB371 currently has none.
 *
 * NOTE: perms live in the JWT — all three must RE-LOGIN to pick this up.
 *
 * Idempotent (dedupes via array(SELECT DISTINCT ...)). --revert removes just this one
 * key from each of the three, leaving any other feature_perms they hold untouched.
 * Run: node db_migrations/20260922_grant_general_dwg_admin.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const FEATURE = 'general_dwg_admin';
const CODES = ['LE403', 'T1460', 'LB371'];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const { rows } = await engPool.query(
    `SELECT u_code, u_name, feature_perms FROM m_user_profile WHERE u_code = ANY($1) ORDER BY u_code`,
    [CODES]);
  if (rows.length !== CODES.length) {
    throw new Error(`expected ${CODES.length} users, found ${rows.length}: ${rows.map(r => r.u_code).join(', ')}`);
  }
  rows.forEach(r => console.log('current:', JSON.stringify(r)));

  if (dryRun) {
    rows.forEach(r => {
      const has = (r.feature_perms || []).includes(FEATURE);
      console.log(`[dry-run] ${r.u_code}: ${revert ? (has ? 'would remove' : 'not present, no-op') : (has ? 'already present, no-op' : `would add ${FEATURE}`)}`);
    });
    return;
  }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    if (revert) {
      const r = await client.query(
        `UPDATE m_user_profile SET feature_perms = array_remove(feature_perms, $2), updated_at = NOW()
           WHERE u_code = ANY($1)`,
        [CODES, FEATURE]);
      console.log(`removed '${FEATURE}' from ${r.rowCount} row(s)`);
    } else {
      const r = await client.query(
        `UPDATE m_user_profile
            SET feature_perms = ARRAY(SELECT DISTINCT unnest(COALESCE(feature_perms, '{}'::text[]) || ARRAY[$2::text])),
                updated_at = NOW()
          WHERE u_code = ANY($1)`,
        [CODES, FEATURE]);
      console.log(`granted '${FEATURE}' to ${r.rowCount} row(s)`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (revert) await recordRevert({ file: __filename });
  else await recordRun({ file: __filename });
  console.log('✅ done. Affected users must RE-LOGIN to refresh their JWT perms.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ failed:', e.message); process.exit(1); });
