'use strict';
/**
 * Remaps `feature_perms` for everyone currently holding 'tooling_admin' or
 * 'sds_admin' onto the finer-grained MTC permission keys introduced alongside
 * the Permissions Config page (2026-10-06): the old two keys each guarded
 * several unrelated admin surfaces at once (Tooling Select Setting AND Part
 * Management under 'tooling_admin'; Setup Data Sheet Setting AND SDS Report
 * Scope AND CN Enable under 'sds_admin'), and those are now granted
 * independently so an admin can hand out just one surface at a time.
 *
 * New keys and what each now guards (see hasFeature() call sites):
 *   tooling_select_admin  — tsv2Routes.js (machines/limits/formulas/rules/
 *                            inventory/partno-map/board-config)
 *   master_data_admin     — specController.js (Part Management) +
 *                            sdsV2AdminController.js GET /audit/data-integrity
 *                            (CN Enable)
 *   sds_setting_admin     — sdsV2AdminController.js (everything else) +
 *                            sdsV2ImageController.js
 *   sds_report_admin      — sdsV2ReportController.js (SDS Report "Scope")
 *   general_dwg_admin     — unchanged
 *   pbring_admin          — new; nobody is granted it by this migration
 *   tooling_inspect_admin — new; nobody is granted it by this migration
 *   all_mtc               — new; nobody is granted it by this migration
 *
 * This migration ONLY remaps what each affected person already effectively
 * had — it grants no new capability. 'pbring_admin' and 'tooling_inspect_admin'
 * are brand new gates (PB Ring's +HW/Delete-all-HW previously relied on
 * isMtcTeam; Tooling Inspection's writes previously had no admin guard at
 * all) and nobody held an equivalent before, so nobody is granted them here —
 * grant by hand via the Permissions Config page if/when needed.
 *
 * Mapping applied (additive — existing unrelated feature_perms are kept):
 *   had 'tooling_admin' → gains tooling_select_admin, master_data_admin
 *   had 'sds_admin'     → gains sds_setting_admin, sds_report_admin, master_data_admin
 * The old 'tooling_admin'/'sds_admin' keys are then REMOVED (nothing checks
 * them any more after this deploy — see the renamed hasFeature(...) call
 * sites above).
 *
 * Idempotent (checked against current state each run) and reversible — see
 * `--revert`, which restores exactly 'tooling_admin'/'sds_admin' for anyone
 * this migration touched (recorded in the migration's own console output;
 * revert recomputes from the NEW keys, so run forward then revert nets zero
 * change).
 * Run: node db_migrations/20261006_split_mtc_feature_perms_granular.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  // Forward selects whoever still holds an OLD key; revert selects whoever holds
  // one of the NEW keys this migration hands out (forward removes the old keys
  // entirely, so re-querying on them after a forward run would find nobody).
  const scanKeys = revert
    ? ['tooling_select_admin', 'sds_setting_admin', 'sds_report_admin']
    : ['tooling_admin', 'sds_admin'];
  const { rows } = await engPool.query(
    `SELECT u_code, u_name, feature_perms FROM m_user_profile
      WHERE feature_perms && $1::text[]
      ORDER BY u_code`,
    [scanKeys]
  );
  rows.forEach(r => console.log('current:', JSON.stringify(r)));

  if (!rows.length) {
    console.log(revert ? 'Nothing to revert.' : 'Nothing to remap.');
    if (!dryRun) { if (revert) await recordRevert({ file: __filename }); else await recordRun({ file: __filename }); }
    return;
  }

  const plan = rows.map(r => {
    const had = new Set(r.feature_perms || []);
    if (!revert) {
      const next = new Set(had);
      next.delete('tooling_admin');
      next.delete('sds_admin');
      if (had.has('tooling_admin')) { next.add('tooling_select_admin'); next.add('master_data_admin'); }
      if (had.has('sds_admin')) { next.add('sds_setting_admin'); next.add('sds_report_admin'); next.add('master_data_admin'); }
      return { u_code: r.u_code, next: [...next] };
    } else {
      const next = new Set(had);
      next.delete('tooling_select_admin');
      next.delete('sds_setting_admin');
      next.delete('sds_report_admin');
      // master_data_admin is only removed if it came from one of the two old
      // keys — leave it if someone was granted it directly after this shipped.
      next.delete('master_data_admin');
      if (had.has('tooling_select_admin')) next.add('tooling_admin');
      if (had.has('sds_setting_admin') || had.has('sds_report_admin')) next.add('sds_admin');
      return { u_code: r.u_code, next: [...next] };
    }
  });

  if (dryRun) {
    plan.forEach(p => console.log(`[dry-run] ${p.u_code}: -> ${JSON.stringify(p.next)}`));
    return;
  }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const p of plan) {
      await client.query(
        `UPDATE m_user_profile SET feature_perms = $2, updated_at = NOW() WHERE u_code = $1`,
        [p.u_code, p.next]
      );
    }
    await client.query('COMMIT');
    console.log(`${revert ? 'reverted' : 'remapped'} ${plan.length} row(s)`);
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
