// ============================================================
// Engineer Record Model — PostgreSQL Queries
// ============================================================
const { engPool } = require('../../../instance/eng_db');
const { pool: rodpcPool } = require('../../../instance/instance');
const { TABLE, ALLOWED_FILTER_COLUMNS, ALLOWED_SORT_COLUMNS, ALLOWED_OPS } = require('./engRecordConstants');

// ─── CRUD ────────────────────────────────────────────────

const getRecordById = async (id) => {
    const result = await engPool.query(
        `SELECT *, 
            CASE WHEN finish_date IS NULL THEN CURRENT_DATE - request_date ELSE NULL END AS waiting_time_days,
            CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END AS finished_time_days,
            CASE WHEN finish_date IS NOT NULL AND plan_start_date IS NOT NULL 
                 THEN finish_date - plan_start_date ELSE NULL END AS overtime_from_plan
         FROM ${TABLE.RECORD} WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
};

const createRecord = async (data) => {
    const {
        record_no, request_date, request_by, lot_no, cn, pn, plant,
        case_type, spec_problem, judge_revise, reason, judgment_by,
        finish_date, plan_start_date, remark, responsible, confirm_codi,
        comment, ts_flag, created_by
    } = data;

    const result = await engPool.query(
        `INSERT INTO ${TABLE.RECORD} 
            (record_no, request_date, request_by, lot_no, cn, pn, plant,
             case_type, spec_problem, judge_revise, reason, judgment_by,
             finish_date, plan_start_date, remark, responsible, confirm_codi,
             comment, ts_flag, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)
         RETURNING *`,
        [record_no, request_date, request_by, lot_no, cn, pn, plant,
         case_type, spec_problem, judge_revise, reason, judgment_by,
         finish_date, plan_start_date, remark, responsible, confirm_codi,
         comment, ts_flag, created_by]
    );
    return result.rows[0];
};

const updateRecord = async (id, data) => {
    const fields = [];
    const values = [];
    let idx = 1;

    const updatableFields = [
        'request_date', 'request_by', 'lot_no', 'cn', 'pn', 'plant',
        'case_type', 'spec_problem', 'judge_revise', 'reason', 'judgment_by',
        'finish_date', 'plan_start_date', 'remark', 'responsible', 'confirm_codi',
        'comment', 'ts_flag', 'updated_by'
    ];

    for (const field of updatableFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = $${idx}`);
            values.push(data[field]);
            idx++;
        }
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await engPool.query(
        `UPDATE ${TABLE.RECORD} SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const deleteRecord = async (id) => {
    const result = await engPool.query(
        `DELETE FROM ${TABLE.RECORD} WHERE id = $1 RETURNING id`,
        [id]
    );
    return result.rowCount > 0;
};

// ─── PAGINATED LISTING WITH DYNAMIC FILTERS ────────────────

const getRecords = async ({ filters = {}, sorter, page = 1, pageSize = 50 }) => {
    const { where, params } = buildFilterQuery(filters);
    let paramIdx = params.length + 1;

    // Sort
    let orderClause = 'ORDER BY record_no DESC';
    if (sorter && sorter.field && ALLOWED_SORT_COLUMNS[sorter.field]) {
        const dir = sorter.order === 'ascend' ? 'ASC' : 'DESC';
        orderClause = `ORDER BY ${ALLOWED_SORT_COLUMNS[sorter.field]} ${dir}`;
    }

    // Pagination
    const offset = (page - 1) * pageSize;

    const countQuery = `SELECT COUNT(*) FROM ${TABLE.RECORD} ${where ? 'WHERE ' + where : ''}`;
    const dataQuery = `
        SELECT *, 
            CASE WHEN finish_date IS NULL THEN CURRENT_DATE - request_date ELSE NULL END AS waiting_time_days,
            CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END AS finished_time_days,
            CASE WHEN finish_date IS NOT NULL AND plan_start_date IS NOT NULL 
                 THEN finish_date - plan_start_date ELSE NULL END AS overtime_from_plan
        FROM ${TABLE.RECORD} 
        ${where ? 'WHERE ' + where : ''} 
        ${orderClause} 
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

    const [countResult, dataResult] = await Promise.all([
        engPool.query(countQuery, params),
        engPool.query(dataQuery, [...params, pageSize, offset]),
    ]);

    return {
        data: dataResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        pageSize,
    };
};

// ─── DYNAMIC FILTER QUERY BUILDER ──────────────────────────

function buildFilterQuery(filters) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    for (const [col, filter] of Object.entries(filters)) {
        const safeCol = ALLOWED_FILTER_COLUMNS[col];
        if (!safeCol) continue;

        switch (filter.type) {
            case 'multiselect':
                if (filter.values && filter.values.length > 0) {
                    const hasEmpty = filter.values.includes('(Empty)');
                    const realValues = filter.values.filter(v => v !== '(Empty)');
                    
                    let cond = '';
                    if (realValues.length > 0) {
                        cond = `${safeCol} = ANY($${paramIndex})`;
                        params.push(realValues);
                        paramIndex++;
                    }
                    if (hasEmpty) {
                        const emptyCond = `(${safeCol} IS NULL OR ${safeCol} = '' OR ${safeCol} = '---')`;
                        cond = cond ? `(${cond} OR ${emptyCond})` : emptyCond;
                    }
                    if (cond) conditions.push(cond);
                }
                break;

            case 'daterange':
                if (filter.dateRange && filter.dateRange.length === 2) {
                    conditions.push(`${safeCol} >= $${paramIndex} AND ${safeCol} <= $${paramIndex + 1}`);
                    params.push(filter.dateRange[0], filter.dateRange[1]);
                    paramIndex += 2;
                }
                break;

            case 'text':
                if (filter.text) {
                    conditions.push(`${safeCol} ILIKE $${paramIndex}`);
                    params.push(`%${filter.text}%`);
                    paramIndex++;
                }
                break;

            case 'conditional':
                if (filter.operator && ALLOWED_OPS[filter.operator]) {
                    if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
                        conditions.push(`${safeCol} ${ALLOWED_OPS[filter.operator]}`);
                    } else if (filter.value !== undefined) {
                        if (filter.operator === 'between' && filter.valueTo !== undefined) {
                            conditions.push(`${safeCol} >= $${paramIndex} AND ${safeCol} <= $${paramIndex + 1}`);
                            params.push(filter.value, filter.valueTo);
                            paramIndex += 2;
                        } else {
                            conditions.push(`${safeCol} ${ALLOWED_OPS[filter.operator]} $${paramIndex}`);
                            params.push(filter.value);
                            paramIndex++;
                        }
                    }
                }
                break;

            default:
                break;
        }
    }

    return { where: conditions.join(' AND '), params };
}

// ─── DASHBOARD AGGREGATION ─────────────────────────────────

const getDashboardStats = async (year) => {
    const targetYear = year || new Date().getFullYear();

    const result = await engPool.query(`
        SELECT
            COUNT(*) AS total_records,
            COUNT(*) FILTER (WHERE finish_date IS NULL) AS waiting_count,
            COUNT(*) FILTER (WHERE finish_date IS NOT NULL) AS finished_count,
            COUNT(*) FILTER (WHERE case_type = 'Request Drawing') AS case_request_drawing,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec') AS case_judgment_spec,
            COUNT(*) FILTER (WHERE case_type = 'Request change DWG/Traveler') AS case_change_dwg,
            COUNT(*) FILTER (WHERE case_type = 'DWG/Traveler Problem') AS case_dwg_problem,
            COUNT(*) FILTER (WHERE case_type = 'Special') AS case_special,
            ROUND(AVG(CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END)::NUMERIC, 1) AS avg_finish_days,
            MAX(CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END) AS max_finish_days,
            MAX(CASE WHEN finish_date IS NULL THEN CURRENT_DATE - request_date ELSE NULL END) AS max_waiting_days,
            COUNT(*) FILTER (WHERE finish_date IS NULL AND plan_start_date IS NOT NULL AND plan_start_date < CURRENT_DATE) AS already_pass_due,
            COUNT(*) FILTER (WHERE finish_date IS NULL AND plan_start_date IS NOT NULL AND plan_start_date >= CURRENT_DATE) AS waiting_on_due,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec' AND finish_date IS NOT NULL AND (finish_date - request_date) <= 1) AS blue_tag_0_1_day,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec' AND finish_date IS NOT NULL AND (finish_date - request_date) <= 7) AS blue_tag_lt_1_week
        FROM ${TABLE.RECORD}
        WHERE EXTRACT(YEAR FROM request_date) = $1
    `, [targetYear]);

    return result.rows[0];
};

const getMonthlyBreakdown = async (year) => {
    const targetYear = year || new Date().getFullYear();

    const result = await engPool.query(`
        SELECT
            EXTRACT(MONTH FROM request_date)::INT AS month_num,
            TO_CHAR(request_date, 'Mon') AS month_name,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE case_type = 'Request Drawing') AS request_drawing,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec') AS judgment_spec,
            COUNT(*) FILTER (WHERE case_type = 'Request change DWG/Traveler') AS change_dwg,
            COUNT(*) FILTER (WHERE case_type = 'DWG/Traveler Problem') AS dwg_problem,
            COUNT(*) FILTER (WHERE case_type = 'Special') AS special,
            COUNT(*) FILTER (WHERE finish_date IS NULL) AS waiting,
            COUNT(*) FILTER (WHERE finish_date IS NOT NULL) AS finished,
            ROUND(AVG(CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END)::NUMERIC, 1) AS avg_finish_days,
            MAX(CASE WHEN finish_date IS NOT NULL THEN finish_date - request_date ELSE NULL END) AS max_finish_days,
            MAX(CASE WHEN finish_date IS NULL THEN CURRENT_DATE - request_date ELSE NULL END) AS max_waiting_days,
            COUNT(*) FILTER (WHERE finish_date IS NULL AND plan_start_date IS NOT NULL AND plan_start_date >= CURRENT_DATE) AS waiting_on_due,
            COUNT(*) FILTER (WHERE finish_date IS NULL AND plan_start_date IS NOT NULL AND plan_start_date < CURRENT_DATE) AS waiting_pass_due,
            COUNT(*) FILTER (WHERE finish_date IS NOT NULL AND plan_start_date IS NOT NULL AND finish_date > plan_start_date) AS already_pass_due,
            COUNT(*) FILTER (WHERE finish_date IS NOT NULL AND (plan_start_date IS NULL OR finish_date <= plan_start_date)) AS finish_on_due,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec' AND finish_date IS NOT NULL AND (finish_date - request_date) <= 1) AS blue_tag_0_1_day,
            COUNT(*) FILTER (WHERE case_type = 'Judgment Spec' AND finish_date IS NOT NULL AND (finish_date - request_date) <= 7) AS blue_tag_lt_1_week
        FROM ${TABLE.RECORD}
        WHERE EXTRACT(YEAR FROM request_date) = $1
        GROUP BY EXTRACT(MONTH FROM request_date), TO_CHAR(request_date, 'Mon')
        ORDER BY month_num
    `, [targetYear]);

    return result.rows;
};

const getAvailableYears = async () => {
    const result = await engPool.query(`
        SELECT DISTINCT EXTRACT(YEAR FROM request_date)::INT AS year
        FROM ${TABLE.RECORD}
        ORDER BY year DESC
    `);
    return result.rows.map(r => r.year);
};

// ─── FILTER OPTIONS (for multi-select dropdowns) ───────────

const getFilterOptions = async (column) => {
    const safeCol = ALLOWED_FILTER_COLUMNS[column];
    if (!safeCol) return [];

    const result = await engPool.query(`
        SELECT DISTINCT COALESCE(NULLIF(TRIM(${safeCol}), ''), '(Empty)') AS value
        FROM ${TABLE.RECORD}
        ORDER BY value
    `);
    
    // Process results: count is not strictly needed for the dropdown list, 
    // we just need unique values.
    const options = result.rows
        .map(r => r.value === '---' ? '(Empty)' : r.value)
        .filter((val, index, self) => self.indexOf(val) === index) // Unique
        .map(val => ({ value: val, text: val }));

    return options;
};

// ─── SYNC LOG ──────────────────────────────────────────────

const createSyncLog = async (data) => {
    const result = await engPool.query(
        `INSERT INTO ${TABLE.SYNC_LOG} (batch_id, file_name, file_hash, status)
         VALUES ($1, $2, $3, 'running') RETURNING *`,
        [data.batch_id, data.file_name, data.file_hash]
    );
    return result.rows[0];
};

const updateSyncLog = async (batchId, data) => {
    const result = await engPool.query(
        `UPDATE ${TABLE.SYNC_LOG} 
         SET records_total = $2, records_created = $3, records_updated = $4, 
             records_skipped = $5, status = $6, error_message = $7, completed_at = NOW()
         WHERE batch_id = $1 RETURNING *`,
        [batchId, data.records_total, data.records_created, data.records_updated,
         data.records_skipped, data.status, data.error_message]
    );
    return result.rows[0];
};

const getSyncLogs = async (limit = 20) => {
    const result = await engPool.query(
        `SELECT * FROM ${TABLE.SYNC_LOG} ORDER BY started_at DESC LIMIT $1`,
        [limit]
    );
    return result.rows;
};

// ─── UPSERT (for sync) ────────────────────────────────────

const upsertRecord = async (data) => {
    const result = await engPool.query(`
        INSERT INTO ${TABLE.RECORD} 
            (record_no, request_date, request_by, lot_no, cn, pn, plant,
             case_type, spec_problem, judge_revise, reason, judgment_by,
             finish_date, plan_start_date, remark, responsible, confirm_codi,
             comment, ts_flag, source_hash, sync_batch_id, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)
        ON CONFLICT (record_no) DO UPDATE SET
            request_date = EXCLUDED.request_date,
            request_by = EXCLUDED.request_by,
            lot_no = EXCLUDED.lot_no,
            cn = EXCLUDED.cn,
            pn = EXCLUDED.pn,
            plant = EXCLUDED.plant,
            case_type = EXCLUDED.case_type,
            spec_problem = EXCLUDED.spec_problem,
            judge_revise = EXCLUDED.judge_revise,
            reason = EXCLUDED.reason,
            judgment_by = EXCLUDED.judgment_by,
            finish_date = EXCLUDED.finish_date,
            plan_start_date = EXCLUDED.plan_start_date,
            remark = EXCLUDED.remark,
            responsible = EXCLUDED.responsible,
            confirm_codi = EXCLUDED.confirm_codi,
            comment = EXCLUDED.comment,
            ts_flag = EXCLUDED.ts_flag,
            source_hash = EXCLUDED.source_hash,
            sync_batch_id = EXCLUDED.sync_batch_id,
            updated_by = EXCLUDED.updated_by
        WHERE ${TABLE.RECORD}.source_hash IS DISTINCT FROM EXCLUDED.source_hash
        RETURNING *, (xmax = 0) AS is_insert
    `, [
        data.record_no, data.request_date, data.request_by, data.lot_no,
        data.cn, data.pn, data.plant, data.case_type, data.spec_problem,
        data.judge_revise, data.reason, data.judgment_by, data.finish_date,
        data.plan_start_date, data.remark, data.responsible, data.confirm_codi,
        data.comment, data.ts_flag, data.source_hash, data.sync_batch_id,
        data.created_by
    ]);

    return result.rows[0] || null;
};

// ─── NEXT RECORD NUMBER ────────────────────────────────────

const getNextRecordNo = async () => {
    const result = await engPool.query(
        `SELECT COALESCE(MAX(record_no), 0) + 1 AS next_no FROM ${TABLE.RECORD}`
    );
    return result.rows[0].next_no;
};

// ─── MRP INFO ──────────────────────────────────────────────

const getMrpInfo = async (lotNo) => {
    const result = await rodpcPool.query(
        `SELECT mrp_itemno AS cn, mrp_spec AS pn, mrp_plan AS plan FROM pc_mrp WHERE mrp_mono = $1 LIMIT 1`,
        [lotNo]
    );
    return result.rows[0] || null;
};

module.exports = {
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord,
    getRecords,
    getDashboardStats,
    getMonthlyBreakdown,
    getAvailableYears,
    getFilterOptions,
    createSyncLog,
    updateSyncLog,
    getSyncLogs,
    upsertRecord,
    getNextRecordNo,
    getMrpInfo,
};
