// ============================================================
// Engineer Record Routes
// ============================================================
const express = require('express');
const router = express.Router();
const ctrl = require('./engRecordController');

// Dashboard & Summary (read-only, all authenticated users)
router.get('/dashboard', ctrl.getDashboard);
router.get('/monthly-summary', ctrl.getMonthlySummary);
router.get('/permissions', ctrl.getPermissions);
router.get('/filter-options/:column', ctrl.getFilterOptions);
router.get('/templates', ctrl.getTemplates);
router.get('/mrp/:lot_no', ctrl.getMrpInfo);
router.post('/compute-cutoff', ctrl.computeCutoff);

// Sync (engineer/admin only — enforced in controller)
router.post('/sync', ctrl.syncFromExcel);
router.get('/sync/status', ctrl.getSyncStatus);

// CRUD
router.get('/', ctrl.getRecords);
router.get('/:id', ctrl.getRecordById);
router.post('/', ctrl.createRecord);
router.put('/:id', ctrl.updateRecord);
router.put('/:id/finish', ctrl.finishRecord);
router.delete('/:id', ctrl.deleteRecord);

module.exports = router;
