const { engPool } = require('../../../../instance/eng_db');

const getToolingInspectList = async (baseSql, params, limitNum, offset) => {
    try {
        const countSql = `SELECT COUNT(*) as total ${baseSql}`;
        const countRes = await engPool.query(countSql, params);
        const total = parseInt(countRes.rows[0].total);

        const dataSql = `SELECT * ${baseSql} ORDER BY receive_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const dataRes = await engPool.query(dataSql, [...params, limitNum, offset]);

        return {
            rows: dataRes.rows,
            total: total
        };
    } catch (err) {
        throw new Error(`Database error: ${err.message}`);
    }
};

const getToolingInspectStats = async (baseSql, params) => {
    try {
        const statsSql = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN issue_date IS NOT NULL AND TRIM(issue_date::TEXT) <> '' THEN 1 END) as issued,
                COUNT(CASE WHEN issue_date IS NULL OR TRIM(issue_date::TEXT) = '' THEN 1 END) as received
            ${baseSql}
        `;
        const res = await engPool.query(statsSql, params);
        return res.rows[0];
    } catch (err) {
        throw new Error(`Database error: ${err.message}`);
    }
};

const getToolingInspectById = async (id) => {
    const res = await engPool.query('SELECT * FROM ti_list WHERE id = $1', [id]);
    return res.rows[0];
};

const deleteToolingInspect = async (id, deletedBy) => {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get original data for logging
        const item = await client.query('SELECT * FROM ti_list WHERE id = $1', [id]);
        if (item.rows.length === 0) throw new Error('Item not found');
        const data = item.rows[0];

        // 2. Log deletion
        await client.query(
            `INSERT INTO ti_list_deleted_log (ti_list_id, po_no, receive_date, time, item_name, deleted_by, original_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, data.po_no, data.receive_date, data.time, data.item_name, deletedBy, data]
        );

        // 3. Delete from ti_list
        await client.query('DELETE FROM ti_list WHERE id = $1', [id]);

        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const blacklistToolingInspect = async (id, reason, blacklistedBy) => {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        
        const item = await client.query('SELECT * FROM ti_list WHERE id = $1', [id]);
        if (item.rows.length === 0) throw new Error('Item not found');
        const data = item.rows[0];

        // 1. Add to blacklist
        await client.query(
            `INSERT INTO ti_list_blacklist (po_no, receive_date, time, item_name, reason, blacklisted_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (po_no, receive_date, time, item_name) DO NOTHING`,
            [data.po_no, data.receive_date, data.time, data.item_name, reason, blacklistedBy]
        );

        // 2. Log deletion
        await client.query(
            `INSERT INTO ti_list_deleted_log (ti_list_id, po_no, receive_date, time, item_name, deleted_by, original_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, data.po_no, data.receive_date, data.time, data.item_name, blacklistedBy, data]
        );

        // 3. Delete from ti_list
        await client.query('DELETE FROM ti_list WHERE id = $1', [id]);

        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const getDateActivityStats = async (date) => {
    try {
        const res = await engPool.query(`
            SELECT
                COUNT(CASE WHEN LEFT(NULLIF(receive_date, ''), 10) = $1 THEN 1 END) AS received,
                COUNT(CASE WHEN LEFT(NULLIF(issue_date::TEXT, ''), 10) = $1 THEN 1 END) AS issued
            FROM ti_list
        `, [date]);
        return {
            received: parseInt(res.rows[0].received) || 0,
            issued:   parseInt(res.rows[0].issued)   || 0,
        };
    } catch (err) {
        throw new Error(`Database error: ${err.message}`);
    }
};

const getToolDWGRequest = async () => {
    try {
        return await Promise.all([
            engPool.query(`SELECT * FROM ti_dwg_job ORDER BY date_req DESC`),
            engPool.query(`SELECT COUNT(*) as total FROM ti_dwg_job`),
        ]);
    } catch (err) {
        throw new Error(`Database error: ${err.message}`);
    }
};

const getSetupSheetByParams = async (cn, process_code, machine) => {
    return await engPool.query(
        `SELECT ss.id, ss.cn, ss.process_code, ss.machine, ss.setup_data_sheet_rev
         FROM setup_sheet ss WHERE ss.cn=$1 AND ss.process_code=$2 AND ss.machine=$3`,
        [cn, process_code, machine]
    );
};

const getExcelTemplateBySetupId = async (setupId) => {
    return await engPool.query(
        `SELECT t.excel_file_name FROM setup_sheet ss JOIN template t ON ss.template_id = t.id WHERE ss.id=$1`,
        [setupId]
    );
};

const getTemplateMapping = async (setupId) => {
    return await engPool.query(
        `SELECT m.sheet_name, m.cell_address, m.param_key, COALESCE(v.param_value,'') AS param_value
         FROM template_excel_mapping m
         JOIN setup_sheet ss ON ss.template_id = m.template_id
         LEFT JOIN setup_parameter_value v ON v.param_key = m.param_key AND v.setup_sheet_id = ss.id
         WHERE ss.id=$1 ORDER BY m.id`,
        [setupId]
    );
};

module.exports = {
    getToolingInspectList,
    getToolingInspectStats,
    getToolingInspectById,
    getDateActivityStats,
    deleteToolingInspect,
    blacklistToolingInspect,
    getToolDWGRequest,
    getSetupSheetByParams,
    getExcelTemplateBySetupId,
    getTemplateMapping
};
