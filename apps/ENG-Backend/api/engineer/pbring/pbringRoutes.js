'use strict';

/**
 * PB Ring tooling routes — mounted at `/api/engineer/pbring` in server.js.
 *
 * `verifyToken` is applied by the global mount, so everything here is already
 * behind a login. Reads need no further guard. Every write is gated on
 * `isMtcTeam` (membership in the MTC team, `req.user.group === 'MTC'`) rather
 * than `isEngineer` (an AD/Engineering-department check) — PB Ring tooling is
 * meant to be editable by anyone on the MTC team, not narrowed to that one
 * department. `PUT /tooling/:id` is the manual half of the dual cost-input
 * design — it always wins immediately and is attributed `cost_source='manual'`
 * (see `pbringCostService.js`). The grid-template admin/PDF routes are a later
 * phase and will add their own guard on their own sub-path.
 *
 * `isPbringWriter` layers `WRITE_DENYLIST` on top of `isMtcTeam` — two named
 * people on the MTC team keep every other MTC-gated feature but lose PB Ring
 * write access specifically. Deliberately local to this route file rather than
 * baked into the shared `isMtcTeam`, which other MTC-team-gated features will
 * reuse and must not inherit this exclusion.
 *
 * `+ New HW` (from-history) and `Delete all <HW>` are structural actions — they
 * add or remove a whole part group's rows, not edit one — so the Permissions
 * Config page (2026-10-06) gates them separately on `isPbringAdmin`
 * (`hasFeature('pbring_admin')`: full 'AD', the granted 'pbring_admin' perm, or
 * 'all_mtc') instead of `isPbringWriter`. Routine per-row edits (manual PUT,
 * single-row delete, cost detect/approve/reject) are UNCHANGED — still whole
 * MTC team minus `WRITE_DENYLIST`.
 */

const express = require('express');
const router = express.Router();

const pbringController = require('./pbringController');
const pbringGridController = require('./pbringGridController');
const pbringConditionController = require('./pbringConditionController');
const { isMtcTeam, hasFeature } = require('../../../middleware/mtcAuth');
const { WRITE_DENYLIST } = require('./pbringConstants');

const isPbringWriter = [isMtcTeam, (req, res, next) => {
  if (WRITE_DENYLIST.includes(req.user?.empno)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: your account does not have PB Ring write access.',
    });
  }
  next();
}];

const isPbringAdmin = hasFeature('pbring_admin');

router.get('/filters', pbringController.getFilters);
router.get('/search', pbringController.search);
router.get('/summary', pbringController.summary);
router.get('/cn-lookup', pbringController.cnLookup);
router.put('/tooling/:id', isPbringWriter, pbringController.updateTooling);
router.delete('/tooling/:id', isPbringWriter, pbringController.deleteTooling);
router.delete('/hw/:partGroup', isPbringAdmin, pbringController.deleteByPartGroup);

// Add new HW, from history — read endpoints open to any authenticated user,
// the actual insert requires the 'pbring_admin' grant (see header note).
router.get('/history/process-codes', pbringController.historyProcessCodes);
router.get('/history/machines', pbringController.historyMachines);
router.get('/history/template', pbringController.historyTemplate);
router.post('/tooling/from-history', isPbringAdmin, pbringController.createFromHistory);

// SDS tool-condition data (pbring_sds_condition: T01-T20/T1-T12 VC/F/AP/Insert/
// etc.) — direct CRUD for an existing CN's rows, plus the same "+New HW"
// history-suggestion principle applied to this table (group by tool_number +
// insert_info, suggest what >=50% of this machine+process's CNs used).
// Reads open; every write is a structural change to what prints on the
// official sheet, so gated isPbringAdmin like +New HW's own commit step.
router.get('/condition', pbringConditionController.getRows);
router.put('/condition', isPbringAdmin, pbringConditionController.putRow);
router.delete('/condition/:id', isPbringAdmin, pbringConditionController.deleteRow);
router.get('/condition/history', pbringConditionController.getHistory);
router.post('/condition/from-history', isPbringAdmin, pbringConditionController.postFromHistory);

// Maqdb cost auto-detect — matches tool_code against lpb.pc_material_purchase
// (see toolCodeMatch.js / pbringCostDetectService.js). Detect + list are read
// concerns gated at isPbringWriter; approve/reject additionally check membership
// in pbring_approver inside the service itself (a 403 from there, not here) —
// being on the MTC team is necessary but not sufficient to approve a cost.
router.post('/cost/detect', isPbringWriter, pbringController.detectCost);
router.get('/cost/pending', pbringController.listPendingCost);
router.post('/cost/pending/:id/approve', isPbringWriter, pbringController.approvePendingCost);
router.post('/cost/pending/:id/reject', isPbringWriter, pbringController.rejectPendingCost);

// Grid-template PDF (Phase 5) — own machine registry/grid/mapping tables,
// own warm-Puppeteer renderer (pdfRender.js), zero coupling with sds_*/
// tooling_*. Both read-only; verifyToken from the global mount is enough.
router.get('/grid/pdf', pbringGridController.getPdf);
router.get('/grid/has-data', pbringGridController.getHasData);

// Sheet approval (Prepared/Checked/Approved) — own table (pbring_sds_approval),
// never the real sds_approval (see pbringGridService.js's comment above the
// functions). Read open to any authenticated user, same as the PDF route.
// Sign/revoke are no longer gated isPbringAdmin at the route level (changed
// 2026-10-12) — the handler now checks pbring_approval_role_config, mirroring
// the real sign route's userCanSign; an admin can still always sign/revoke,
// and an empty config table (the default) still means "admin only", so this
// is a behaviour-preserving change until an admin actually adds a rule.
router.get('/grid/approval', pbringGridController.getApproval);
router.post('/grid/approval', pbringGridController.postApproval);
router.delete('/grid/approval', pbringGridController.deleteApproval);

// Who may sign each role — own table (pbring_approval_role_config), never
// sds_approval_role_config. Mirrors /api/sds/v2/approval/role-config so
// ApprovalRoleConfig.jsx is reusable as-is once pointed at this base URL.
router.get('/grid/approval/role-config', pbringGridController.getApprovalRoleConfig);
router.post('/grid/approval/role-config', isPbringAdmin, pbringGridController.postApprovalRoleConfig);
router.put('/grid/approval/role-config/:id', isPbringAdmin, pbringGridController.putApprovalRoleConfig);
router.delete('/grid/approval/role-config/:id', isPbringAdmin, pbringGridController.deleteApprovalRoleConfig);

// Auto Stamp config — own table (pbring_auto_stamp_config), own gate.
// Disabled by default; see pbringAutoStamp.js.
router.get('/grid/auto-stamp/config', pbringGridController.getAutoStampConfig);
router.put('/grid/auto-stamp/config', isPbringAdmin, pbringGridController.putAutoStampConfig);
// Manual trigger — mirrors POST /api/sds/v2/report/auto-stamp (?dryRun=1),
// so the real AutoStampSection.jsx's "Dry-run"/"Run now" buttons work
// unmodified against PB Ring once pointed at this URL (see
// pbringGridController.postAutoStampRun for the response-shape note).
router.post('/grid/auto-stamp/run', isPbringAdmin, pbringGridController.postAutoStampRun);

// Active machine list — used by the Approval Roles / Auto Stamp / Parameter
// Config tabs' machine picker. The Phase 5 grid-template admin routes that
// used to sit here (template CRUD, machine<->template assignment, xlsx
// upload, blank-preview PDF) were removed 2026-10-14 along with
// pbring_grid_template/pbring_excel_mapping — see pbringGridService.js's
// header and migration 20261014_pbring_drop_grid_template_phase5.js.
router.get('/grid/admin/machine-types', isPbringAdmin, pbringGridController.getMachineTypes);

// Parameter Config (Phase 6, problem #3) — per-machine GRIND/DRESS CONDITION
// row definitions (label/param_key/unit), seeded from the xlsx import,
// editable here. Independent of sds_parameter — see pbringGridService.js's
// Phase 6 header note for why (PB Ring's CN is a real factory CN).
router.get('/grid/admin/parameters', isPbringAdmin, pbringGridController.getManualParams);
router.put('/grid/admin/parameters/bulk', isPbringAdmin, pbringGridController.putManualParams);

// Tooling + Grinding Area photos — own tables (pbring_tooling_image/
// pbring_grinding_image), simple exact-match keys (machine+tooling_no;
// machine+cn+process_code). Reads open to any authenticated user (the PDF
// route needs them with no admin check); uploads/deletes gated isPbringAdmin.
router.get('/grid/tooling-image', pbringGridController.getToolingImage);
router.get('/grid/admin/tooling-images', isPbringAdmin, pbringGridController.getToolingImages);
router.get('/grid/admin/tooling-families', isPbringAdmin, pbringGridController.getToolingFamilies);
router.post('/grid/admin/tooling-image', isPbringAdmin, pbringGridController.postToolingImage);
router.delete('/grid/admin/tooling-image', isPbringAdmin, pbringGridController.deleteToolingImage);

router.get('/grid/grinding-image', pbringGridController.getGrindingImage);
router.get('/grid/admin/grinding-images', isPbringAdmin, pbringGridController.getGrindingImages);
router.post('/grid/admin/grinding-image', isPbringAdmin, pbringGridController.postGrindingImage);
router.delete('/grid/admin/grinding-image', isPbringAdmin, pbringGridController.deleteGrindingImage);

module.exports = router;
