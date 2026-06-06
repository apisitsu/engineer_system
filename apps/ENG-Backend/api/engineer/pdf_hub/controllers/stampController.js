/**
 * stampController.js — HTTP handlers for stamp & signature endpoints.
 *
 * Validates input, delegates to stampService, formats HTTP responses.
 */
const stampService = require('../services/stampService');

/**
 * GET /stamps/:em_id — Fetch a user's stamp & signature
 */
async function getStamp(req, res) {
    try {
        const { em_id } = req.params;
        const stamp = await stampService.getStampByEmId(em_id);

        if (!stamp) {
            return res.json({ result: 'true', data: null });
        }

        res.json({ result: 'true', data: stamp });
    } catch (err) {
        console.error('pdfHub getStamp error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /stamps — Upsert stamp/signature with physical dimensions
 */
async function upsertStamp(req, res) {
    try {
        const { em_id } = req.body;
        if (!em_id) {
            return res.status(400).json({ result: 'false', message: 'em_id is required' });
        }

        await stampService.upsertStamp(req.body);
        res.json({ result: 'true', message: 'Stamp saved successfully' });
    } catch (err) {
        console.error('pdfHub upsertStamp error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * GET /stamps — List all user stamps (admin overview)
 */
async function listStamps(req, res) {
    try {
        const data = await stampService.listAllStamps();
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub listStamps error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

module.exports = { getStamp, upsertStamp, listStamps };
