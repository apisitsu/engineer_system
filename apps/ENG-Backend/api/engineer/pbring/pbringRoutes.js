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

// Grid-template admin (Phase 5.6) — machine<->template assignment, default,
// and re-run the xlsx import. Gated on isPbringAdmin like the other
// structural actions above (+New HW, Delete HW).
router.get('/grid/admin/templates', isPbringAdmin, pbringGridController.getTemplates);
router.get('/grid/admin/machine-types', isPbringAdmin, pbringGridController.getMachineTypes);
router.put('/grid/admin/machine-types/:id', isPbringAdmin, pbringGridController.putMachineTemplate);
router.put('/grid/admin/templates/:id/default', isPbringAdmin, pbringGridController.putTemplateDefault);
router.post('/grid/admin/reimport', isPbringAdmin, pbringGridController.postReimport);

// Full template CRUD + xlsx upload — PbRingGridTemplateEditor.jsx, a
// duplicate of SdsBlankTemplateGrid.jsx's editing surface (own route
// namespace, own tables — zero coupling with sds_grid_template/sds_excel_mapping).
router.get('/grid/admin/templates/:id', isPbringAdmin, pbringGridController.getTemplate);
router.post('/grid/admin/templates', isPbringAdmin, pbringGridController.postTemplate);
router.put('/grid/admin/templates/:id', isPbringAdmin, pbringGridController.putTemplate);
router.delete('/grid/admin/templates/:id', isPbringAdmin, pbringGridController.deleteTemplate);
router.post('/grid/admin/templates/from-xlsx-upload/sheets', isPbringAdmin, pbringGridController.postXlsxUploadSheets);
router.post('/grid/admin/templates/from-xlsx-upload', isPbringAdmin, pbringGridController.postXlsxUpload);
router.get('/grid/admin/templates/:id/pdf-blank', isPbringAdmin, pbringGridController.getTemplateBlankPdf);

module.exports = router;
