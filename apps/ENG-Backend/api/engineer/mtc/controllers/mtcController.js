const mtcService = require('../services/mtcService');
const mtcModel = require('../models/mtcModel');
const mtcConstants = require('../mtcConstants');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const TEMPLATE_DIR = path.resolve(process.env.SDS_TEMPLATE_DIR || path.join(__dirname, '../templates'));
const CACHE_DIR = path.resolve('./output/pdf-cache');
const SOFFICE = path.resolve('./tools/LibreOfficePortable/App/libreoffice/program/soffice.exe');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { if (fs.existsSync(p)) fs.unlinkSync(p); }

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
        const { page, limit, search, status, startDate, endDate, currentMonth } = req.query;
        const result = await mtcService.getToolingInspectListService({
            page: parseInt(page),
            limit: parseInt(limit),
            search,
            status,
            startDate,
            endDate,
            currentMonth
        });
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

const generateSdsPdf = async (req, res) => {
    const { cn, process_code, machine } = req.query;
    if (!cn || !process_code || !machine) {
        return res.status(400).json({ error: 'cn, process_code and machine are required' });
    }

    try {
        const result = await mtcService.generateSdsPdfService({ cn, process_code, machine, templateDir: TEMPLATE_DIR, cacheDir: CACHE_DIR, sofficePath: SOFFICE });
        
        if (result.type === 'file') {
            return res.sendFile(result.path);
        } else if (result.type === 'error') {
            return res.status(result.status || 500).json({ error: result.message });
        }
    } catch (err) {
        console.error('Error in mtcController.generateSdsPdf:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getConstants,
    getToolingInspectList,
    getToolDWGRequest,
    generateSdsPdf
};

