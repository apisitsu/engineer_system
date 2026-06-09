/**
 * pdfHubRoutes.js — Thin router for all PDF Hub endpoints.
 *
 * Registers route → controller mappings. All business logic
 * lives in controllers/ and services/.
 *
 * Mounted at: /api/engineer/pdf-hub
 */
const express = require('express');
const multer = require('multer');
const os = require('os');

const stampCtrl = require('./controllers/stampController');
const usageCtrl = require('./controllers/usageController');
const watermarkCtrl = require('./controllers/watermarkController');
const pdfToolsCtrl = require('./controllers/pdfToolsController');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// ── Stamp & Signature ──
router.get('/stamps', stampCtrl.listStamps);
router.get('/stamps/:em_id', stampCtrl.getStamp);
router.post('/stamps', stampCtrl.upsertStamp);

// ── Usage Logging ──
router.post('/usage-log', usageCtrl.logUsage);
router.get('/usage-history', usageCtrl.getUsageHistory);
router.get('/usage-stats', usageCtrl.getUsageStats);

// ── Watermarks ──
router.get('/watermarks', watermarkCtrl.getWatermarks);
router.post('/watermarks', watermarkCtrl.createWatermark);
router.put('/watermarks/:id', watermarkCtrl.updateWatermark);
router.delete('/watermarks/:id', watermarkCtrl.deleteWatermark);
router.post('/watermarks/:id/share', watermarkCtrl.shareWatermark);
router.post('/watermark-log', watermarkCtrl.logWatermarkUsage);
router.get('/watermark-history', watermarkCtrl.getWatermarkHistory);

// ── PDF Tools (unlock, repair) ──
router.post('/unlock', upload.single('pdf'), pdfToolsCtrl.unlockPdf);
router.post('/repair', upload.single('pdf'), pdfToolsCtrl.repairPdf);

// ── PDF-to-Image Converter ──
// Now integrated under the same router; mounted at /api/engineer/pdf-hub/pdf-to-image
const pdfConverterCtrl = require('./controllers/pdfConverterController');
router.post('/pdf-to-image', pdfConverterCtrl.uploadMiddleware, pdfConverterCtrl.convertPdfToImage);

module.exports = router;
