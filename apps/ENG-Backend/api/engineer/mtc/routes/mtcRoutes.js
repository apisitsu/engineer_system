const express = require('express');
const router = express.Router();
const mtcController = require('../controllers/mtcController');

// Define routes for MTC
router.get('/tooling-inspect', mtcController.getToolingInspectList);
router.delete('/tooling-inspect/:id', mtcController.deleteToolingInspect);
router.post('/tooling-inspect/:id/blacklist', mtcController.blacklistToolingInspect);

router.get('/tool-dwg-req', mtcController.getToolDWGRequest);
router.get('/sds/pdf', mtcController.generateSdsPdf);
router.get('/constants', mtcController.getConstants);

module.exports = router;

