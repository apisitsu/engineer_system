'use strict';

/**
 * Lets a tightly-scoped set of people manage who holds which granular
 * `feature_perms` flag (tooling_admin / sds_admin / general_dwg_admin) —
 * previously only ever doable by hand-running a one-off DB migration
 * (db_migrations/20260622_add_feature_perms_and_grant.js,
 * 20260922_grant_general_dwg_admin.js).
 *
 * Granting someone else a feature_perms entry is itself a privilege-escalation
 * path, so this is gated TIGHTER than plain isAdminUser (department/role==='AD'):
 * an explicit empno allowlist is checked in addition. LE485 currently also
 * passes via department='AD', but that department is expected to be revoked
 * (per request 2026-10-06) — the allowlist entry is what keeps access after
 * that happens, so it is listed explicitly rather than relying on isAdminUser.
 */

const express = require('express');
const router = express.Router();
const { engPool } = require('../../../../instance/eng_db');
const { isAdminUser } = require('../../../../middleware/mtcAuth');

const PERMISSION_ADMIN_ALLOWLIST = ['LE485'];

const isPermissionAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'User context missing. Authentication required.' });
  }
  if (isAdminUser(req.user) || PERMISSION_ADMIN_ALLOWLIST.includes(req.user.empno)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Access denied: permission management is restricted.' });
};

// Keep in sync with every hasFeature(...) call site. One key per MTC sidebar
// item (2026-10-06 redesign — see db_migrations/20261006_split_mtc_feature_perms_granular.js
// for how the prior 'tooling_admin'/'sds_admin' split into these).
// 'all_mtc' is always listed LAST — it is a superset shortcut, not a sidebar
// item of its own, and the Permissions Config UI keeps it visually last to
// match (see FEATURE_OPTIONS in PermissionsConfigPage.jsx).
//   pbring_admin          pbringRoutes.js          — PB Ring "+ New HW" / "Delete all HW"
//   general_dwg_admin     server.js                — General DWG Request "Setting"
//   tooling_inspect_admin server.js                — Tooling Inspection Add Return/Request,
//                                                     Update Data, row Update
//   tooling_select_admin  tsv2Routes.js             — Tooling Select "Setting"
//   sds_setting_admin     sdsV2AdminController.js   — Setup Data Sheet "Setting" (machine-types/
//                                                     mappings/parameters/machine-tools/
//                                                     machine-codes/visible-machines/audit)
//   sds_excel_image_admin sdsV2AdminController.js,  — SDS Excel Config (template-config/grid)
//                          sdsV2ImageController.js    + tooling/grinding Images — split out of
//                                                      sds_setting_admin (2026-10-06) so it can
//                                                      be granted narrowly, e.g. to a Leader
//   sds_report_admin      sdsV2ReportController.js  — SDS Coverage Report "Scope"
//   master_data_admin     specController.js,        — Master Data (Part Management +
//                          sdsV2AdminController.js     CN Enable)
//   all_mtc               mtcAuth.js hasFeature()   — passes every key above (not a
//                                                     real route guard of its own)
const FEATURE_KEYS = [
  'pbring_admin',
  'general_dwg_admin',
  'tooling_inspect_admin',
  'tooling_select_admin',
  'sds_setting_admin',
  'sds_excel_image_admin',
  'sds_report_admin',
  'master_data_admin',
  'all_mtc',
];

router.get('/users', isPermissionAdmin, async (req, res) => {
  try {
    const { rows } = await engPool.query(`
      SELECT u_code, u_name, u_department, user_group, role, u_status, feature_perms
      FROM m_user_profile
      ORDER BY u_code
    `);
    res.json({ success: true, data: rows, featureKeys: FEATURE_KEYS });
  } catch (e) {
    console.error('[permissionsConfig] getUsers failed:', e.message);
    res.status(500).json({ success: false, error: 'Failed to load users.' });
  }
});

router.put('/users/:u_code', isPermissionAdmin, async (req, res) => {
  const { u_code } = req.params;
  const incoming = Array.isArray(req.body.feature_perms) ? req.body.feature_perms : null;
  if (!incoming) {
    return res.status(400).json({ success: false, error: 'feature_perms must be an array.' });
  }
  // Drop retired/unknown keys rather than rejecting the whole save — a row's
  // `value` round-trips whatever is currently stored (e.g. 'tooling_admin',
  // 'sds_admin' from before the 2026-10-06 key split), so hard-failing here
  // would make a row with any stale key permanently un-editable through the
  // UI until a migration cleans it up. This can only narrow what gets saved,
  // never grant something that wasn't already requested.
  const next = incoming.filter(k => FEATURE_KEYS.includes(k));
  const dropped = incoming.filter(k => !FEATURE_KEYS.includes(k));
  if (dropped.length) {
    console.warn(`[permissionsConfig] ${u_code}: dropping retired key(s) ${dropped.join(', ')}`);
  }
  try {
    const { rows } = await engPool.query(
      `UPDATE m_user_profile SET feature_perms = $2, updated_at = NOW()
         WHERE u_code = $1
         RETURNING u_code, u_name, feature_perms`,
      [u_code, next]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: `User ${u_code} not found.` });
    }
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('[permissionsConfig] updateUser failed:', e.message);
    res.status(500).json({ success: false, error: 'Failed to update permissions.' });
  }
});

module.exports = router;
