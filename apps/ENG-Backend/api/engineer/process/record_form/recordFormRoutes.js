'use strict';

/**
 * Record-for-new-model form — mounted at `/api/engineer/process/record-form`
 * behind verifyToken in server.js. Anyone logged in can fill/print records;
 * changing the form layout (templates) needs isEngineer.
 */
const express = require('express');
const router = express.Router();
const c = require('./recordFormController');
const { isEngineer } = require('../../../../middleware/mtcAuth');

router.get('/lots/search', c.searchLots);
router.get('/lots/detail', c.getLot);

router.get('/templates', c.listTemplates);
router.post('/templates', isEngineer, c.createTemplate);
router.put('/templates/:id', isEngineer, c.updateTemplate);
router.delete('/templates/:id', isEngineer, c.deleteTemplate);

router.get('/records', c.listRecords);
router.post('/records', c.createRecord);
router.get('/records/:id', c.getRecord);
router.put('/records/:id', c.updateRecord);
router.post('/records/:id/printed', c.markPrinted);
router.post('/records/:id/stamp', c.stampRecord); // Process Engineer team only — checked in the service
router.delete('/records/:id', c.deleteRecord);

module.exports = router;
