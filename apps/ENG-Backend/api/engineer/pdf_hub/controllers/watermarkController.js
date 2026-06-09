/**
 * watermarkController.js — HTTP handlers for watermark template endpoints.
 *
 * Validates input, delegates to watermarkService, formats HTTP responses.
 */
const jwt = require('jsonwebtoken');
const watermarkService = require('../services/watermarkService');

/**
 * GET /watermarks — List all watermarks accessible to the user
 */
async function getWatermarks(req, res) {
    try {
        // Extract empno from JWT token for ownership/sharing filtering
        const token = req.headers.authorization?.split(' ')[1];
        let empno = null;
        if (token) {
            const decoded = jwt.decode(token);
            empno = decoded?.empno;
        }

        const data = await watermarkService.getWatermarks(empno);
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub getWatermarks error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /watermarks — Create new watermark template
 */
async function createWatermark(req, res) {
    try {
        const data = await watermarkService.createWatermark(req.body);
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub createWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * PUT /watermarks/:id — Update existing watermark template
 */
async function updateWatermark(req, res) {
    try {
        const { id } = req.params;
        const data = await watermarkService.updateWatermark(id, req.body);
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub updateWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * DELETE /watermarks/:id — Delete watermark template
 */
async function deleteWatermark(req, res) {
    try {
        const { id } = req.params;
        await watermarkService.deleteWatermark(id);
        res.json({ result: 'true', message: 'Deleted' });
    } catch (err) {
        console.error('pdfHub deleteWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /watermarks/:id/share — Share watermark with another employee
 */
async function shareWatermark(req, res) {
    try {
        const { id } = req.params;
        const { target_empno } = req.body;
        await watermarkService.shareWatermark(id, target_empno);
        res.json({ result: 'true', message: 'Shared' });
    } catch (err) {
        console.error('pdfHub shareWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /watermark-log — Record watermark usage (audit trail)
 */
async function logWatermarkUsage(req, res) {
    try {
        await watermarkService.logWatermarkUsage(req.body);
        res.json({ result: 'true', message: 'Watermark log recorded successfully' });
    } catch (err) {
        console.error('pdfHub watermark-log error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * GET /watermark-history — Fetch watermark audit history
 */
async function getWatermarkHistory(req, res) {
    try {
        const data = await watermarkService.getWatermarkHistory();
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub watermark-history error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

module.exports = {
    getWatermarks,
    createWatermark,
    updateWatermark,
    deleteWatermark,
    shareWatermark,
    logWatermarkUsage,
    getWatermarkHistory,
};
