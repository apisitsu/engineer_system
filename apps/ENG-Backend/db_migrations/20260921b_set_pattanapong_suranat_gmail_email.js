'use strict';
/**
 * Same gap as 20260921_set_le403_gmail_email.js, for the other two people listed in
 * tr_email_config: their profiles have gmail_email = NULL, so the u_code-vs-email-local-part
 * comparison in toolRequestController.js submitAction() (and the frontend canAct) never
 * recognises them. Pattanapong is the only person on ENG_APPROVE and Suranat the only one
 * on DRAFTMAN, so neither stage could be acted on by them.
 *
 * Pairs confirmed by the requester 2026-09-21:
 *   T1460 (Pattanapong Promyai) <-> pattanapong.p@minebea.co.th
 *   L6121 (Suranat Naka)        <-> suranat.n@minebea.co.th
 *
 * Each row is only touched while gmail_email IS NULL, and an address already held by
 * another u_code aborts the run. --revert clears a row only if it still holds the value
 * set here. Users must log out and back in to reload userInfo.
 *
 * Run: node db_migrations/20260921b_set_pattanapong_suranat_gmail_email.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const PAIRS = [
  ['T1460', 'pattanapong.p@minebea.co.th'],
  ['L6121', 'suranat.n@minebea.co.th'],
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    for (const [uCode, email] of PAIRS) {
      const { rows } = await client.query(
        `SELECT u_code, u_name, gmail_email FROM m_user_profile WHERE upper(u_code) = upper($1)`,
        [uCode]);
      if (rows.length !== 1) throw new Error(`expected exactly 1 row for ${uCode}, found ${rows.length}`);
      console.log(`${uCode} current:`, JSON.stringify(rows[0]));

      if (revert) {
        const r = dryRun ? { rowCount: 0 } : await client.query(
          `UPDATE m_user_profile SET gmail_email = NULL, updated_at = NOW()
            WHERE upper(u_code) = upper($1) AND lower(gmail_email) = lower($2)`,
          [uCode, email]);
        console.log(dryRun ? `[dry-run] would clear ${email}` : `  reverted ${r.rowCount} row(s)`);
        continue;
      }

      if (rows[0].gmail_email) { console.log(`  already set (${rows[0].gmail_email}) — skipped`); continue; }

      const clash = await client.query(
        `SELECT u_code FROM m_user_profile WHERE lower(gmail_email) = lower($1)`, [email]);
      if (clash.rowCount > 0) {
        throw new Error(`${email} is already on ${clash.rows.map(r => r.u_code).join(', ')} — refusing to duplicate`);
      }

      if (dryRun) { console.log(`  [dry-run] would set gmail_email = ${email}`); continue; }

      const r = await client.query(
        `UPDATE m_user_profile SET gmail_email = $2, updated_at = NOW()
          WHERE upper(u_code) = upper($1) AND gmail_email IS NULL`,
        [uCode, email]);
      console.log(`  updated ${r.rowCount} row(s)`);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (dryRun) return;
  if (revert) await recordRevert({ file: __filename });
  else await recordRun({ file: __filename });
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ failed:', e.message); process.exit(1); });
