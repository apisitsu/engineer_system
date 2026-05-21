const mtcService = require('../services/mtcService');
const mtcConstants = require('../mtcConstants');

const getConstants = (req, res) => {
    try {
        const { WORKFLOW_STATUS, REQUEST_TYPES, CATEGORIES } = mtcConstants;
        res.json({ WORKFLOW_STATUS, REQUEST_TYPES, CATEGORIES });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getToolingInspectList = async (req, res) => {
    try {
        const { page, limit, search, status, startDate, endDate, currentMonth, currentYear } = req.query;

        const fetchList = mtcService.getToolingInspectListService({
            page: parseInt(page), limit: parseInt(limit),
            search, status, startDate, endDate, currentMonth, currentYear,
        });
        const fetchStats = mtcService.getToolingInspectStatsService({ search, status, startDate, endDate, currentMonth, currentYear });
        const fetchActivity = (status === 'date' && startDate)
            ? mtcService.getDateActivityStatsService(startDate)
            : Promise.resolve(null);

        const [result, stats, dateActivity] = await Promise.all([fetchList, fetchStats, fetchActivity]);

        res.json({ ...result, stats, dateActivity });
    } catch (err) {
        console.error('Error in mtcController.getToolingInspectList:', err.message);
        res.status(500).json({ error: err.message });
    }
};

const deleteToolingInspect = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBy = req.user?.empno || req.user?.name || 'system';
        await mtcService.deleteToolingInspectService(id, deletedBy);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const blacklistToolingInspect = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const blacklistedBy = req.user?.empno || req.user?.name || 'system';
        await mtcService.blacklistToolingInspectService(id, reason, blacklistedBy);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getToolDWGRequest = async (req, res) => {
    try {
        const result = await mtcService.getToolDWGRequestService();
        res.json(result);
    } catch (err) {
        console.error('Error in mtcController.getToolDWGRequest:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getConstants,
    getToolingInspectList,
    deleteToolingInspect,
    blacklistToolingInspect,
    getToolDWGRequest,
};

