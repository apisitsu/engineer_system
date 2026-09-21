'use strict';
/**
 * tr_email_member — who is who, for General DWG Request only.
 *
 * tr_email_config lists ADDRESSES and doubles as the list of people who may act on a
 * stage, but the JWT identifies a person by u_code. The bridge used to be
 * m_user_profile.gmail_email, a column on a table shared with every other module, so
 * making someone actionable meant writing outside mtc. This table owns that bridge
 * inside the module: one row per person, u_code -> the address this system notifies
 * (and matches against tr_email_config). Set from the Email Config page.
 *
 * Seeds from the three addresses 20260921_/20260921b_ had written onto profiles
 * (LE403, T1460, L6121). Run those two migrations with --revert AFTER this one and
 * after the backend restarts on the new code, so nobody is locked out in between.
 *
 * Idempotent (ON CONFLICT DO NOTHING). --revert drops the table.
 * Run: node api/engineer/mtc/db_migrations/20260921e_create_tr_email_member.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { TABLES } = require('../mtcConstants');

const T = TABLES.TR_EMAIL_MEMBER;
const SEED_CODES = ['LE403', 'T1460', 'L6121'];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    if (dryRun) { console.log(`[dry-run] would DROP TABLE IF EXISTS ${T}`); return; }
    await engPool.query(`DROP TABLE IF EXISTS ${T}`);
    console.log(`dropped ${T}`);
    await recordRevert({ file: __filename });
    return;
  }

  const seed = await engPool.query(
    `SELECT u_code, lower(gmail_email) AS email FROM m_user_profile
      WHERE upper(u_code) = ANY($1) AND gmail_email IS NOT NULL`,
    [SEED_CODES]);
  console.log('seed from profile:', JSON.stringify(seed.rows));

  if (dryRun) { console.log(`[dry-run] would create ${T} and insert ${seed.rowCount} row(s)`); return; }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${T} (
        u_code     text PRIMARY KEY,
        email      text NOT NULL,
        updated_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${T}_email_uq ON ${T} (lower(email))`);
    for (const r of seed.rows) {
      const ins = await client.query(
        `INSERT INTO ${T} (u_code, email, updated_by) VALUES ($1, $2, 'migration 20260921e')
         ON CONFLICT DO NOTHING`, [r.u_code, r.email]);
      console.log(`  ${r.u_code} -> ${r.email} (${ins.rowCount ? 'inserted' : 'already present'})`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await recordRun({ file: __filename });
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ failed:', e.message); process.exit(1); });
