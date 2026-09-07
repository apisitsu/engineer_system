'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./lotTrackController');

// GET /api/mtc/lot-track/search?q=
router.get('/search', ctrl.searchLots);

// Saved tracks (per user) — must be registered before the /:lotNo catch-all
router.get('/saved', ctrl.listSaved);
router.post('/saved', ctrl.createSaved);
router.put('/saved/:id', ctrl.updateSaved);
router.delete('/saved/:id', ctrl.deleteSaved);

// GET /api/mtc/lot-track/:lotNo?control_no=&source=
router.get('/:lotNo', ctrl.getLot);

module.exports = router;
