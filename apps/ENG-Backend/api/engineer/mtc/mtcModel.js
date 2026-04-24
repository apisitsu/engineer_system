const { engPool } = require('../../../instance/eng_db');

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
    getToolDWGRequest,
    getSetupSheetByParams,
    getExcelTemplateBySetupId,
    getTemplateMapping
};
