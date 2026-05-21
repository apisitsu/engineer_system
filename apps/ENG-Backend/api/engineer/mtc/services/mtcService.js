const moment = require('moment');
const mtcModel = require('../models/mtcModel');

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
        if (status === 'all' && options.currentYear) {
            const startOfYear = `${options.currentYear}-01-01`;
            const endOfYear = `${options.currentYear}-12-31`;
            baseSql += ` AND NULLIF(receive_date, '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(startOfYear, endOfYear);
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

module.exports = {
    getToolingInspectListService,
    getToolingInspectStatsService,
    getDateActivityStatsService,
    blacklistToolingInspectService,
    deleteToolingInspectService,
    getToolDWGRequestService,
};

