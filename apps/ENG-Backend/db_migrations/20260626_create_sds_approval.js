'use strict';
/**
 * Create the SDS approval tables (Prepared/Checked/Approved sign system):
 *   - sds_approval              — ONE ROW PER SHEET, keyed (cn, machine_type, process_code, sds_rev),
 *                                 with per-role columns prepared_* / checked_* / approved_*
 *   - sds_approval_role_config  — configurable: which users may sign each role
 *
 * Wide one-row-per-sheet layout as of 2026-06-27: a fully signed SDS is a single row
 * (not three), sds_rev = the SDS document rev (not the part drawing rev). ensureApprovalTables()
 * self-heals: it DROPs any legacy long-format table (one row per role — detected by a 'role'
 * column) and recreates the wide schema. Re-running this migration is therefore an in-place
 * upgrade; the long format never carried production data so the drop is safe.
 *
 * Schema lives in sdsApprovalController.ensureApprovalTables() (CREATE IF NOT EXISTS,
 * also run lazily on first API hit) so the DDL has a single source of truth. This
 * migration just invokes it for an explicit, ordered deployment, then seeds a
 * conservative default role-config IF the table is empty (admins can always sign
 * regardless; edit/extend in the admin UI).
 *
 * Idempotent: safe to re-run (IF NOT EXISTS + empty-check before seeding).
 * Run: node db_migrations/20260626_create_sds_approval.js
 */
const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const { ensureApprovalTables } = require('../api/engineer/mtc/controllers/sdsApprovalController');

(async () => {
  try {
    await ensureApprovalTables();
    console.log('sds_approval + sds_approval_role_config ready.');

    const TC = TABLES.SDS_APPROVAL_ROLE_CONFIG;
    const { rows } = await engPool.query(`SELECT COUNT(*)::int AS n FROM ${TC}`);
    if (rows[0].n === 0) {
      // Conservative starting point — Engineering dept may Prepare/Check, AD approves.
      // Admins (dept|role 'AD') may sign any role regardless of these rows.
      const seed = [
        ['prepared', 'department', 'Engineering'],
        ['checked',  'department', 'Engineering'],
        ['approved', 'role',       'AD'],
      ];
      for (const [role, mt, mv] of seed) {
        await engPool.query(
          `INSERT INTO ${TC} (role, match_type, match_value, note) VALUES ($1,$2,$3,$4)`,
          [role, mt, mv, 'default seed — edit in admin']
        );
      }
      console.log(`Seeded ${seed.length} default role-config rows.`);
    } else {
      console.log(`role-config already has ${rows[0].n} rows — no seed.`);
    }
    console.log('Done.');
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await engPool.end().catch(() => {});
  }
})();
