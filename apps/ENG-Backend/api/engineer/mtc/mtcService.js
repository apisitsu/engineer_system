const moment = require('moment');
const mtcModel = require('./mtcModel');

const getToolingInspectListService = async (query) => {
    const pageNum = Math.max(1, parseInt(query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const search = query.search || '';
    const status = query.status || 'all';
    const startDate = query.startDate;
    const endDate = query.endDate;
    const currentMonthStr = query.currentMonth;

    let baseSql = `FROM ti_list WHERE 1=1`;
    let params = [];
    let paramCount = 1;

    if (search) {
        baseSql += ` AND (po_no ILIKE $${paramCount} OR item_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
    }

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

    if (startDate && endDate) {
        baseSql += ` AND NULLIF(TRIM(receive_date::TEXT), '')::DATE BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startDate, endDate);
        paramCount += 2;
    }

    const result = await mtcModel.getToolingInspectList(baseSql, params, limitNum, offset);
    return {
        data: result.rows,
        pagination: { total: result.total, page: pageNum, limit: limitNum }
    };
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
    getToolDWGRequestService,
};

