const express = require('express');
const router = express.Router();
const mtcController = require('./mtcController');

// Define routes for MTC
router.get('/tooling-inspect', mtcController.getToolingInspectList);
router.get('/tool-dwg-request', mtcController.getToolDWGRequest);

module.exports = router;

