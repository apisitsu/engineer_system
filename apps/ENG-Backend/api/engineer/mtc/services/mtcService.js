const moment = require('moment');
const mtcModel = require('../models/mtcModel');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const buildTiListBaseSql = (options = {}) => {
    const search = options.search || '';
    const status = options.status || 'all';
    const startDate = options.startDate;
    const currentMonthStr = options.currentMonth;

    let baseSql = `FROM ti_list WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (search) {
        baseSql += ` AND (po_no ILIKE $${paramCount} OR item_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

    // กรอง Date — table แสดงเฉพาะ receive_date ตรงกับวันที่เลือก
    if (status === 'date' && startDate) {
        baseSql += ` AND LEFT(NULLIF(receive_date, ''), 10) = $${paramCount}`;
        params.push(startDate);
        paramCount += 1;
    } 
    // กรองโหมดอื่นๆ (all, pending, pending_all)
    else {
        if (status === 'all' && currentMonthStr) {
            const startOfMonth = moment(currentMonthStr, 'MM-YYYY').startOf('month').format('YYYY-MM-DD');
            const endOfMonth = moment(currentMonthStr, 'MM-YYYY').endOf('month').format('YYYY-MM-DD');
            baseSql += ` AND NULLIF(receive_date, '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(startOfMonth, endOfMonth);
            paramCount += 2;
        } else if (status === 'pending' && currentMonthStr) {
            const startOfMonth = moment(currentMonthStr, 'MM-YYYY').startOf('month').format('YYYY-MM-DD');
            const endOfMonth = moment(currentMonthStr, 'MM-YYYY').endOf('month').format('YYYY-MM-DD');
            baseSql += ` AND (issue_date IS NULL OR TRIM(issue_date::TEXT) = '') 
                         AND NULLIF(receive_date, '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(startOfMonth, endOfMonth);
            paramCount += 2;
        } else if (status === 'pending_all' || status === 'pendingAll') {
            baseSql += ` AND (issue_date IS NULL OR TRIM(issue_date::TEXT) = '')`;
        }
    }

    return { baseSql, params };
};

const getToolingInspectListService = async (options = {}) => {
    const pageNum = Math.max(1, parseInt(options.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(options.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const { baseSql, params } = buildTiListBaseSql(options);

    const result = await mtcModel.getToolingInspectList(baseSql, params, limitNum, offset);
    return {
        data: result.rows,
        pagination: { total: result.total, page: pageNum, limit: limitNum }
    };
};

const getToolingInspectStatsService = async (options = {}) => {
    const { baseSql, params } = buildTiListBaseSql(options);
    const stats = await mtcModel.getToolingInspectStats(baseSql, params);
    return stats;
};

const getDateActivityStatsService = async (date) => {
    return await mtcModel.getDateActivityStats(date);
};

const blacklistToolingInspectService = async (id, reason, blacklistedBy) => {
    return await mtcModel.blacklistToolingInspect(id, reason, blacklistedBy);
};

const deleteToolingInspectService = async (id, deletedBy) => {
    return await mtcModel.deleteToolingInspect(id, deletedBy);
};

const getToolDWGRequestService = async () => {
    const [dataRes, countRes] = await mtcModel.getToolDWGRequest();
    return {
        data: dataRes.rows,
        pagination: { total: parseInt(countRes.rows[0].total), page: 1, limit: 1, totalPages: 1 },
    };
};

const processSdsExcel = async (setupId, templatePath) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const mappingResult = await mtcModel.getTemplateMapping(setupId);
    
    mappingResult.rows.forEach(row => {
        const ws = row.sheet_name ? workbook.getWorksheet(row.sheet_name) : workbook.worksheets[0];
        if (ws && row.cell_address && row.param_key) {
            const cell = ws.getCell(row.cell_address);
            const current = cell.value;
            const placeholder = `{{${row.param_key}}}`;
            if (typeof current === 'string' && current.includes(placeholder)) {
                cell.value = current.replace(placeholder, row.param_value);
            } else {
                cell.value = row.param_value;
            }
        }
    });

    return workbook;
};

const generateSdsPdfService = async ({ cn, process_code, machine, templateDir, cacheDir, sofficePath }) => {
    const setupResult = await mtcModel.getSetupSheetByParams(cn, process_code, machine);
    if (setupResult.rows.length === 0) return { type: 'error', status: 404, message: 'Setup sheet not found' };
    const setup = setupResult.rows[0];

    const tplResult = await mtcModel.getExcelTemplateBySetupId(setup.id);
    const excelFileName = tplResult.rows[0]?.excel_file_name;
    if (!excelFileName) return { type: 'error', status: 500, message: 'Excel template not defined' };

    const templatePath = path.join(templateDir, excelFileName);
    if (!fs.existsSync(templatePath)) return { type: 'error', status: 500, message: 'Template file not found' };

    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const pdfPath = path.join(cacheDir, `${setup.id}_${setup.setup_data_sheet_rev}.pdf`);

    if (fs.existsSync(pdfPath)) return { type: 'file', path: pdfPath };

    const workbook = await processSdsExcel(setup.id, templatePath);
    
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const tempExcelPath = path.join(outputDir, `__temp_${Date.now()}_${setup.id}.xlsx`);
    await workbook.xlsx.writeFile(tempExcelPath);

    return new Promise((resolve) => {
        execFile(sofficePath, ['--headless', '--convert-to', 'pdf', tempExcelPath, '--outdir', cacheDir], (error) => {
            if (fs.existsSync(tempExcelPath)) fs.unlinkSync(tempExcelPath);
            if (error) return resolve({ type: 'error', status: 500, message: 'PDF conversion failed' });
            
            const generatedPdfPath = path.join(cacheDir, path.basename(tempExcelPath).replace(/\.xlsx$/, '.pdf'));
            if (!fs.existsSync(generatedPdfPath)) return resolve({ type: 'error', status: 500, message: 'Generated PDF not found' });
            fs.renameSync(generatedPdfPath, pdfPath);
            resolve({ type: 'file', path: pdfPath });
        });
    });
};

module.exports = {
    getToolingInspectListService,
    getToolingInspectStatsService,
    getDateActivityStatsService,
    blacklistToolingInspectService,
    deleteToolingInspectService,
    getToolDWGRequestService,
    processSdsExcel,
    generateSdsPdfService
};

