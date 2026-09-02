'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./lotTrackController');

// GET /api/mtc/lot-track/search?q=
router.get('/search', ctrl.searchLots);

// GET /api/mtc/lot-track/:lotNo?control_no=&source=
router.get('/:lotNo', ctrl.getLot);

module.exports = router;
