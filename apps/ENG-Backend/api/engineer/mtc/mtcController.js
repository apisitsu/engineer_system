const mtcService = require('./mtcService');

// NOTE: the old `generateSdsPdf` (Excel template → LibreOffice/soffice → PDF) has
// been retired. SDS PDF generation is now done entirely by the Chrome grid
// renderer (api/.../sdsV2HeadlessController → /api/sds/v2-headless/pdf-chrome/grid).

const getToolingInspectList = async (req, res) => {
    try {
        const result = await mtcService.getToolingInspectListService(req.query);
        res.json(result);
    } catch (err) {
        console.error('Error in mtcController.getToolingInspectList:', err.message);
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
    getToolingInspectList,
    getToolDWGRequest,
};
