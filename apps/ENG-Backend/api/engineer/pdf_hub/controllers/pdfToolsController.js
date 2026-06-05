/**
 * pdfToolsController.js — HTTP handlers for PDF manipulation tools.
 *
 * Handles file upload via multer, delegates to pdfToolsService,
 * and sends back processed PDF data.
 */
const pdfToolsService = require('../services/pdfToolsService');

/**
 * POST /unlock — Unlock an encrypted PDF
 * Expects multipart form with 'pdf' field.
 */
async function unlockPdf(req, res) {
    if (!req.file) {
        return res.status(400).json({ result: 'false', message: 'No PDF file uploaded' });
    }

    try {
        const data = await pdfToolsService.unlockPdf(req.file.path);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(data);
    } catch (err) {
        console.error('PDF Unlock Error:', err.stderr || err.error?.message || err.message);
        res.status(500).json({ result: 'false', message: 'Failed to unlock PDF' });
    }
}

/**
 * POST /repair — Rebuild and clean a PDF
 * Expects multipart form with 'pdf' field.
 */
async function repairPdf(req, res) {
    if (!req.file) {
        return res.status(400).json({ result: 'false', message: 'No PDF file uploaded' });
    }

    try {
        const data = await pdfToolsService.repairPdf(req.file.path);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(data);
    } catch (err) {
        console.error('PDF Repair Error:', err.stderr || err.error?.message || err.message);
        res.status(500).json({ result: 'false', message: 'Failed to repair PDF' });
    }
}

module.exports = { unlockPdf, repairPdf };
