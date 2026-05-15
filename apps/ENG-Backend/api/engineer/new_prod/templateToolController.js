/**
 * Template Tool Controller
 * CRUD for APQP forms: Control Plan, PFD, PFMEA, PID, PDR
 * Plus: Audit trail, User stamps, Calculator logging
 */
const { engPool } = require('../../../instance/eng_db');

// ============================================================================
// Helper: Write audit trail entries
// ============================================================================
async function writeAudit(client, formHeaderId, tableName, rowId, changes, changedBy) {
    for (const change of changes) {
        await client.query(
            `INSERT INTO tt_form_audit_trail (form_header_id, table_name, row_id, column_name, old_value, new_value, changed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [formHeaderId, tableName, rowId, change.column, change.oldVal, change.newVal, changedBy]
        );
    }
}

// ============================================================================
// FORM HEADERS - List / Create / Delete
// ============================================================================
const listForms = async (req, res) => {
    try {
        const { form_type, status, search } = req.query;
        let where = ['deleted_at IS NULL'];
        let params = [];
        let idx = 1;

        if (form_type) { where.push(`form_type = $${idx++}`); params.push(form_type); }
        if (status) { where.push(`status = $${idx++}`); params.push(status); }
        if (search) {
            where.push(`(pid_number ILIKE $${idx} OR customer_pn ILIKE $${idx} OR nmb_pn ILIKE $${idx} OR form_number ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }

        const sql = `SELECT * FROM tt_form_headers WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`;
        const result = await engPool.query(sql, params);
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        console.error('listForms error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
};

const createForm = async (req, res) => {
    try {
        const { form_type } = req.body;
        const created_by = req.user?.empno || req.body.created_by || null;
        const result = await engPool.query(
            `INSERT INTO tt_form_headers (form_type, created_by) VALUES ($1, $2) RETURNING *`,
            [form_type, created_by]
        );
        res.json({ result: 'true', data: result.rows[0] });
    } catch (err) {
        console.error('createForm error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
};

const deleteForm = async (req, res) => {
    try {
        const { id } = req.params;
        await engPool.query(`UPDATE tt_form_headers SET deleted_at = NOW() WHERE id = $1`, [id]);
        res.json({ result: 'true', message: 'Form soft-deleted' });
    } catch (err) {
        console.error('deleteForm error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
};

// ============================================================================
// GENERIC: Get form header + rows by type
// ============================================================================
const ROW_TABLE_MAP = {
    control_plan: 'tt_control_plan_rows',
    pfd: 'tt_pfd_rows',
    pfmea: 'tt_pfmea_rows',
    pdr: 'tt_pdr_rows',
};

const ROW_COLUMNS = {
    control_plan: ['operation','process_function','machine_device','char_dwg_no','char_product','char_process','special_class','method_requirements','method_evaluation','sample_size','sample_freq','control_method','reaction_plan'],
    pfd: ['process_no','process_name','sequence_number','operation_desc','product_char','process_char','kc_check','sp_check','manufacturing_site'],
    pfmea: ['operation','process_function','requirements','potential_failure_mode','potential_effects','severity_1','potential_causes','occurrence_1','prevention_controls','detection_controls','detection_1','rpn_1','recommended_action','responsibility','actions_taken','severity_2','occurrence_2','detection_2','rpn_2'],
    pdr: ['priority','document_no','revision','title','applied','approval','register','remark'],
};

const HEADER_COLUMNS = ['pid_number','customer_pn','nmb_pn','form_number','revision','prepare_by','check_by','date_initiated','target_date','customer_name','nhbb_pn','category','phase_checks'];

const getFormData = async (req, res) => {
    try {
        const { formType, id } = req.params;
        const headerResult = await engPool.query(`SELECT * FROM tt_form_headers WHERE id = $1 AND deleted_at IS NULL`, [id]);
        if (headerResult.rows.length === 0) return res.status(404).json({ result: 'false', message: 'Form not found' });

        const header = headerResult.rows[0];
        let rows = [];

        if (formType === 'pid') {
            const pidResult = await engPool.query(`SELECT * FROM tt_pid_form_data WHERE form_header_id = $1`, [id]);
            rows = pidResult.rows[0] || {};
        } else {
            const table = ROW_TABLE_MAP[formType];
            if (table) {
                const rowResult = await engPool.query(`SELECT * FROM ${table} WHERE form_header_id = $1 ORDER BY sort_order`, [id]);
                rows = rowResult.rows;
            }
        }

        res.json({ result: 'true', data: { header, rows } });
    } catch (err) {
        console.error('getFormData error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
};

const saveFormData = async (req, res) => {
    const client = await engPool.connect();
    try {
        const { formType, id } = req.params;
        const { header, rows, deletedRowIds } = req.body;
        const changedBy = req.user?.empno || req.body.changed_by || null;

        await client.query('BEGIN');

        // 1. Update header
        if (header) {
            const sets = []; const vals = []; let idx = 1;
            for (const col of HEADER_COLUMNS) {
                if (header[col] !== undefined) {
                    sets.push(`${col} = $${idx++}`);
                    let val = header[col];
                    if (col === 'phase_checks') {
                        val = JSON.stringify(val);
                    } else if ((col === 'date_initiated' || col === 'target_date') && val === '') {
                        val = null;
                    }
                    vals.push(val);
                }
            }
            if (sets.length > 0) {
                vals.push(id);
                await client.query(`UPDATE tt_form_headers SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
            }
        }

        // 2. Upsert rows (for table-based forms)
        if (formType !== 'pid' && rows && ROW_TABLE_MAP[formType]) {
            const table = ROW_TABLE_MAP[formType];
            const cols = ROW_COLUMNS[formType];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const colValues = cols.map(c => row[c] !== undefined ? row[c] : null);

                if (row.id && row.id > 0) {
                    // Update existing
                    const sets = cols.map((c, j) => `${c} = $${j + 1}`).join(', ');
                    await client.query(
                        `UPDATE ${table} SET ${sets}, sort_order = $${cols.length + 1} WHERE id = $${cols.length + 2}`,
                        [...colValues, i, row.id]
                    );
                } else {
                    // Insert new
                    const placeholders = cols.map((_, j) => `$${j + 1}`).join(', ');
                    const insertRes = await client.query(
                        `INSERT INTO ${table} (form_header_id, ${cols.join(', ')}, sort_order) VALUES ($${cols.length + 1}, ${placeholders}, $${cols.length + 2}) RETURNING id`,
                        [...colValues, id, i]
                    );
                    row.id = insertRes.rows[0].id;
                }
            }

            // 3. Delete removed rows
            if (deletedRowIds && deletedRowIds.length > 0) {
                await client.query(`DELETE FROM ${table} WHERE id = ANY($1::int[]) AND form_header_id = $2`, [deletedRowIds, id]);
            }
        }

        // PID special handling
        if (formType === 'pid' && rows) {
            const { category, phase_checks } = rows;
            await client.query(
                `INSERT INTO tt_pid_form_data (form_header_id, category, phase_checks)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (form_header_id) DO UPDATE SET category = $2, phase_checks = $3, updated_at = NOW()`,
                [id, category, JSON.stringify(phase_checks)]
            );
        }

        await client.query('COMMIT');
        res.json({ result: 'true', message: 'Saved successfully', data: { rows } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('saveFormData error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    } finally {
        client.release();
    }
};

const updateFormStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await engPool.query(`UPDATE tt_form_headers SET status = $1 WHERE id = $2`, [status, id]);
        res.json({ result: 'true', message: `Status updated to ${status}` });
    } catch (err) {
        console.error('updateFormStatus error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
};

// ============================================================================
// AUDIT TRAIL
// ============================================================================
const getAuditTrail = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await engPool.query(
            `SELECT * FROM tt_form_audit_trail WHERE form_header_id = $1 ORDER BY changed_at DESC LIMIT 200`, [id]
        );
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        res.status(500).json({ result: 'false', message: err.message });
    }
};

// ============================================================================
// USER STAMPS
// ============================================================================
const getStamp = async (req, res) => {
    try {
        const { em_id } = req.params;
        const result = await engPool.query(`SELECT * FROM tt_user_stamps WHERE em_id = $1`, [em_id]);
        if (result.rows.length === 0) return res.status(404).json({ result: 'false', message: 'No stamp found' });
        const stamp = result.rows[0];
        if (stamp.stamp_image) stamp.stamp_image = stamp.stamp_image.toString('base64');
        if (stamp.signature_image) stamp.signature_image = stamp.signature_image.toString('base64');
        res.json({ result: 'true', data: stamp });
    } catch (err) {
        res.status(500).json({ result: 'false', message: err.message });
    }
};

const upsertStamp = async (req, res) => {
    try {
        const { em_id, first_name, last_name, department } = req.body;
        let stampBuf = null, sigBuf = null;
        if (req.body.stamp_image) stampBuf = Buffer.from(req.body.stamp_image, 'base64');
        if (req.body.signature_image) sigBuf = Buffer.from(req.body.signature_image, 'base64');

        await engPool.query(
            `INSERT INTO tt_user_stamps (em_id, first_name, last_name, department, stamp_image, signature_image)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (em_id) DO UPDATE SET first_name=$2, last_name=$3, department=$4, stamp_image=COALESCE($5, tt_user_stamps.stamp_image), signature_image=COALESCE($6, tt_user_stamps.signature_image), updated_at=NOW()`,
            [em_id, first_name, last_name, department, stampBuf, sigBuf]
        );
        res.json({ result: 'true', message: 'Stamp saved' });
    } catch (err) {
        res.status(500).json({ result: 'false', message: err.message });
    }
};

// ============================================================================
// CALCULATOR LOG
// ============================================================================
const logCalcUsage = async (req, res) => {
    try {
        const { calc_type, input_params, results } = req.body;
        const used_by = req.user?.empno || req.body.used_by || null;
        await engPool.query(
            `INSERT INTO tt_calc_usage_log (calc_type, used_by, input_params, results) VALUES ($1, $2, $3, $4)`,
            [calc_type, used_by, JSON.stringify(input_params), JSON.stringify(results)]
        );
        res.json({ result: 'true', message: 'Logged' });
    } catch (err) {
        res.status(500).json({ result: 'false', message: err.message });
    }
};

module.exports = {
    listForms, createForm, deleteForm,
    getFormData, saveFormData, updateFormStatus,
    getAuditTrail,
    getStamp, upsertStamp,
    logCalcUsage,
};
