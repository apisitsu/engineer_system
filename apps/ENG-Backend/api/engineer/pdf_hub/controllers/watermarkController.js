/**
 * watermarkController.js — HTTP handlers for watermark template endpoints.
 *
 * Validates input, delegates to watermarkService, formats HTTP responses.
 * Enhanced with unified token extraction and role-based permissions.
 */
const jwt = require('jsonwebtoken');
const watermarkService = require('../services/watermarkService');

/**
 * Helper to safely extract user identity & role from request or token
 */
function getRequesterInfo(req) {
    if (req.user) {
        return {
            empno: req.user.empno || req.user.u_code || null,
            role: req.user.role || req.user.u_role || '',
            name: req.user.name || req.user.u_name || ''
        };
    }
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1] || req.query.token;
    if (token) {
        try {
            const decoded = jwt.decode(token);
            return {
                empno: decoded?.empno || decoded?.u_code || null,
                role: decoded?.role || decoded?.u_role || '',
                name: decoded?.name || decoded?.u_name || ''
            };
        } catch {
            return { empno: null, role: '', name: '' };
        }
    }
    return { empno: null, role: '', name: '' };
}

/**
 * GET /watermarks — List all watermarks accessible to the user
 */
async function getWatermarks(req, res) {
    try {
        const { empno, role } = getRequesterInfo(req);
        const data = await watermarkService.getWatermarks(empno, role);
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
        const { empno } = getRequesterInfo(req);
        const owner = empno || req.body.owner_empno || 'GUEST';
        const data = await watermarkService.createWatermark({ ...req.body, owner_empno: owner });
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
        const { empno, role } = getRequesterInfo(req);
        const effectiveEmpno = empno || req.body.owner_empno || req.body.empno;
        if (!effectiveEmpno && role !== 'AD') {
            return res.status(401).json({ result: 'false', message: 'Authentication required to update watermark' });
        }
        
        const data = await watermarkService.updateWatermark(id, { ...req.body, owner_empno: effectiveEmpno }, role);
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
        const { empno, role } = getRequesterInfo(req);
        const effectiveEmpno = empno || req.query.empno;
        if (!effectiveEmpno && role !== 'AD') {
            return res.status(401).json({ result: 'false', message: 'Authentication required to delete watermark' });
        }
        await watermarkService.deleteWatermark(id, effectiveEmpno, role);
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
        const { empno, name } = getRequesterInfo(req);
        const payload = {
            ...req.body,
            empno: req.body.empno || empno || 'GUEST',
            user_name: req.body.user_name || name || 'Guest User',
        };
        await watermarkService.logWatermarkUsage(payload);
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
