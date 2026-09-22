/**
 * DMS Routes
 * Express router for Document Management System.
 */
const express = require('express');
const router = express.Router();
const controller = require('./documentController');
const { verifyToken } = require('../../../../middleware/auth');

// Optional or required authentication helper
// GET endpoints allow global access or token
router.get('/documents', controller.getDocuments);
router.get('/documents/stats', controller.getStats);
router.get('/documents/:id', controller.getDocument);
router.get('/document-types', controller.getDocumentTypes);
router.get('/document-types/:typeId/preview', controller.previewNextDocNumber);

// Mutating endpoints require authentication
router.post('/documents/issue', verifyToken, controller.issueNewDocument);
router.put('/documents/:id', verifyToken, controller.updateDocument);
router.delete('/documents/:id', verifyToken, controller.deleteDocument);

router.post('/document-types', verifyToken, controller.createDocumentType);
router.put('/document-types/:id', verifyToken, controller.updateDocumentType);

module.exports = router;
