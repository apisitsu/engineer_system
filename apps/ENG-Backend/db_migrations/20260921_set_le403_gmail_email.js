'use strict';
/**
 * Give LE403 (Chairat Sripratueng) the email the General DWG Request stage
 * permissions are written against.
 *
 * `tr_email_config` lists full addresses (chairat.s@minebea.co.th) and doubles as the
 * list of who may act on a stage, but the JWT carries only u_code (LE403), which never
 * equals an address's local part. His profile had gmail_email = NULL, so both the
 * frontend `canAct` check and the backend 403 check in toolRequestController.js
 * `submitAction()` failed to recognise him on every stage he is listed for.
 *
 * The backend now resolves the email from m_user_profile by the verified empno; this
 * fills the one row that was missing it.
 *
 * Only touches the row while gmail_email IS NULL, so it never overwrites a value
 * someone set later. --revert clears it again only if it still holds this value.
 *
 * NOTE: userInfo is loaded at login — Chairat must log out and back in.
 *
 * Run: node db_migrations/20260921_set_le403_gmail_email.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const U_CODE = 'LE403';
const EMAIL = 'chairat.s@minebea.co.th';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const { rows } = await engPool.query(
    `SELECT u_code, u_name, gmail_email FROM m_user_profile WHERE upper(u_code) = upper($1)`,
    [U_CODE]);
  if (rows.length !== 1) throw new Error(`expected exactly 1 row for ${U_CODE}, found ${rows.length}`);
  console.log('current:', JSON.stringify(rows[0]));

  if (revert) {
    if (dryRun) { console.log('[dry-run] would clear gmail_email if it equals', EMAIL); return; }
    const r = await engPool.query(
      `UPDATE m_user_profile SET gmail_email = NULL, updated_at = NOW()
        WHERE upper(u_code) = upper($1) AND lower(gmail_email) = lower($2)`,
      [U_CODE, EMAIL]);
    console.log(`reverted ${r.rowCount} row(s)`);
    await recordRevert({ file: __filename });
    return;
  }

  if (rows[0].gmail_email) {
    console.log(`gmail_email already set (${rows[0].gmail_email}) — nothing to do`);
    return;
  }

  const clash = await engPool.query(
    `SELECT u_code FROM m_user_profile WHERE lower(gmail_email) = lower($1)`, [EMAIL]);
  if (clash.rowCount > 0) {
    throw new Error(`${EMAIL} is already on ${clash.rows.map(r => r.u_code).join(', ')} — refusing to duplicate`);
  }

  if (dryRun) { console.log(`[dry-run] would set gmail_email = ${EMAIL} on ${U_CODE}`); return; }

  const r = await engPool.query(
    `UPDATE m_user_profile SET gmail_email = $2, updated_at = NOW()
      WHERE upper(u_code) = upper($1) AND gmail_email IS NULL`,
    [U_CODE, EMAIL]);
  console.log(`updated ${r.rowCount} row(s)`);
  await recordRun({ file: __filename });
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ failed:', e.message); process.exit(1); });
