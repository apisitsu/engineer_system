const mtcService = require('./mtcService');
const mtcModel = require('./mtcModel');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const TEMPLATE_DIR = path.resolve(process.env.SDS_TEMPLATE_DIR || path.join(__dirname, 'templates'));
const CACHE_DIR = path.resolve('./output/pdf-cache');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { if (fs.existsSync(p)) fs.unlinkSync(p); }

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

const generateSdsPdf = async (req, res) => {
    const { cn, process_code, machine } = req.query;
    if (!cn || !process_code || !machine) {
        return res.status(400).json({ error: 'cn, process_code and machine are required' });
    }

    try {
        const setupResult = await mtcModel.getSetupSheetByParams(cn, process_code, machine);
        if (setupResult.rows.length === 0) return res.status(404).json({ error: 'Setup sheet not found' });
        const setup = setupResult.rows[0];

        const tplResult = await mtcModel.getExcelTemplateBySetupId(setup.id);
        const excelFileName = tplResult.rows[0]?.excel_file_name;
        if (!excelFileName) return res.status(500).json({ error: 'Excel template not defined' });

        const templatePath = path.join(TEMPLATE_DIR, excelFileName);
        if (!fs.existsSync(templatePath)) return res.status(500).json({ error: 'Template file not found' });

        ensureDir(CACHE_DIR);
        // Note: buildPdfCacheKey is omitted or needs to be shared, assuming basic logic here
        const pdfPath = path.join(CACHE_DIR, `${setup.id}_${setup.setup_data_sheet_rev}.pdf`);

        if (fs.existsSync(pdfPath)) return res.sendFile(pdfPath);

        const workbook = await mtcService.processSdsExcel(setup.id, templatePath);
        
        ensureDir('./output');
        const tempExcelPath = path.join('./output', `__temp_${Date.now()}_${setup.id}.xlsx`);
        await workbook.xlsx.writeFile(tempExcelPath);

        const SOFFICE = path.resolve('./tools/LibreOfficePortable/App/libreoffice/program/soffice.exe');
        execFile(SOFFICE, ['--headless', '--convert-to', 'pdf', tempExcelPath, '--outdir', CACHE_DIR], (error) => {
            safeUnlink(tempExcelPath);
            if (error) return res.status(500).json({ error: 'PDF conversion failed' });
            
            const generatedPdfPath = path.join(CACHE_DIR, path.basename(tempExcelPath).replace(/\.xlsx$/, '.pdf'));
            if (!fs.existsSync(generatedPdfPath)) return res.status(500).json({ error: 'Generated PDF not found' });
            fs.renameSync(generatedPdfPath, pdfPath);
            return res.sendFile(pdfPath);
        });
    } catch (err) {
        console.error('Error in mtcController.generateSdsPdf:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getToolingInspectList,
    getToolDWGRequest,
    generateSdsPdf
};

