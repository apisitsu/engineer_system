/**
 * usageController.js — HTTP handlers for PDF usage logging endpoints.
 *
 * Validates input, delegates to usageService, formats HTTP responses.
 */
const usageService = require('../services/usageService');

/**
 * POST /usage-log — Record a PDF usage event
 */
async function logUsage(req, res) {
    try {
        const { empno, filename } = req.body;
        if (!empno || !filename) {
            return res.status(400).json({ result: 'false', message: 'empno and filename are required' });
        }

        await usageService.logUsage(req.body);
        res.json({ result: 'true', message: 'Usage log recorded successfully' });
    } catch (err) {
        console.error('pdfHub logUsage error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * GET /usage-history — Fetch recent usage history
 */
async function getUsageHistory(req, res) {
    try {
        const data = await usageService.getUsageHistory();
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub usage-history error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * GET /usage-stats — Aggregate usage statistics for dashboard
 */
async function getUsageStats(req, res) {
    try {
        const { year, month } = req.query;
        const data = await usageService.getUsageStats({ year, month });
        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub usage-stats error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

module.exports = { logUsage, getUsageHistory, getUsageStats };
