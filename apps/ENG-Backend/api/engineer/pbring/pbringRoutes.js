'use strict';

/**
 * PB Ring tooling routes — mounted at `/api/engineer/pbring` in server.js.
 *
 * `verifyToken` is applied by the global mount, so everything here is already
 * behind a login. Reads need no further guard. `PUT /tooling/:id` is the
 * manual half of the dual cost-input design — it always wins immediately and
 * is attributed `cost_source='manual'` (see `pbringCostService.js`). The
 * maqdb-detect/approve queue and the grid-template admin/PDF routes are later
 * phases and will add their own guards on their own sub-paths.
 */

const express = require('express');
const router = express.Router();

const pbringController = require('./pbringController');
const { isEngineer } = require('../../../middleware/mtcAuth');

router.get('/filters', pbringController.getFilters);
router.get('/search', pbringController.search);
router.get('/summary', pbringController.summary);
router.get('/cn-lookup', pbringController.cnLookup);
router.put('/tooling/:id', isEngineer, pbringController.updateTooling);
router.delete('/tooling/:id', isEngineer, pbringController.deleteTooling);
router.delete('/hw/:partGroup', isEngineer, pbringController.deleteByPartGroup);

// Add new HW, from history — read endpoints open to any authenticated user,
// the actual insert guarded same as the manual edit above.
router.get('/history/process-codes', pbringController.historyProcessCodes);
router.get('/history/machines', pbringController.historyMachines);
router.get('/history/template', pbringController.historyTemplate);
router.post('/tooling/from-history', isEngineer, pbringController.createFromHistory);

// Maqdb cost auto-detect — matches tool_code against lpb.pc_material_purchase
// (see toolCodeMatch.js / pbringCostDetectService.js). Detect + list are read
// concerns gated at isEngineer; approve/reject additionally check membership
// in pbring_approver inside the service itself (a 403 from there, not here).
router.post('/cost/detect', isEngineer, pbringController.detectCost);
router.get('/cost/pending', pbringController.listPendingCost);
router.post('/cost/pending/:id/approve', isEngineer, pbringController.approvePendingCost);
router.post('/cost/pending/:id/reject', isEngineer, pbringController.rejectPendingCost);

module.exports = router;
