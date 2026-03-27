const { engPool } = require('../../../instance/eng_db');
const { pool } = require('../../../instance/instance');
const moment = require('moment');

const activity_log = () => {

}

const ecrCreate = async (req, res) => {
    const data = req.body;

    const sql = `
    INSERT INTO ecnt_document (
        ecr_no, request_by, department, require_date, due_date, 
        status_type, objective, objective_others,
        
        is_drawing, is_tooling, is_program, is_usage,
        
        part_no_drawing, cn_drawing, rev_drawing, 
        drawing_before_change, drawing_after_change,
        upload_drawing_before, upload_drawing_after,
        
        setup_data_sheet_no, part_no_tooling, cn_tooling, cycle_time,
        setup_desc_before, setup_desc_after, 
        upload_setup_before, upload_setup_after,
        
        cutting_desc_before, cutting_desc_after, 
        upload_cutting_before, upload_cutting_after,
        
        current_tooling_no, current_tooling_usage, 
        new_tooling_no, new_tooling_usage,
        
        process_status
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        $9, $10, $11, $12, 
        $13, $14, $15, $16, $17, $18, $19, 
        $20, $21, $22, $23, $24, $25, $26, $27, 
        $28, $29, $30, $31, 
        $32, $33, $34, $35, $36
    ) RETURNING id
`;

    const params = [
        data.ecr_no || `ECR-${moment().format('YYMMDD-HHmmss')}`,
        data.request_by,
        data.department,
        data.require_date || null,
        data.due_date || null,
        data.status || 'Permanent',
        data.objective,
        data.objective_others || null,

        data.is_drawing ? true : false,
        data.is_tooling ? true : false,
        data.is_program ? true : false,
        data.is_usage ? true : false,

        data.part_no_drawing || null,
        data.cn_drawing || null,
        data.rev_drawing || null,
        data.drawing_before_change || null,
        data.drawing_after_change || null,
        data.upload_drawing_before || null,
        data.upload_drawing_after || null,

        data.setup_data_sheet_no || null,
        data.part_no_tooling || null,
        data.cn_tooling || null,
        data.cycle_time || null,
        data.setup_desc_before || null,
        data.setup_desc_after || null,
        data.upload_setup_before || null,
        data.upload_setup_after || null,

        data.cutting_desc_before || null,
        data.cutting_desc_after || null,
        data.upload_cutting_before || null,
        data.upload_cutting_after || null,

        data.current_tooling_no || null,
        data.current_tooling_usage || null,
        data.new_tooling_no || null,
        data.new_tooling_usage || null,

        data.process_status || 'Pending Dept Mgr'
    ];

    try {
        const result = await engPool.query(sql, params);
        res.json({
            message: "Success",
            id: result.rows[0].id
        });
    } catch (err) {
        console.error("ECR Create Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrGetList = async (req, res) => {
    try {
        const sql = `SELECT * FROM ecnt_document ORDER BY created_at DESC`;
        const result = await engPool.query(sql);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("ECR Get List Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrGetById = async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `SELECT * FROM ecnt_document WHERE id = $1`;
        const result = await engPool.query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "ECR Not Found" });
        }

        const logSql = `SELECT * FROM ecnt_approval_log WHERE ecr_id = $1 ORDER BY action_date ASC`;
        const logResult = await engPool.query(logSql, [id]);

        res.json({
            data: result.rows[0],
            logs: logResult.rows
        });
    } catch (err) {
        console.error("ECR Get By ID Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrSubmitApproval = async (req, res) => {
    const { id } = req.params;
    const { step_number, action_by, action_role, action_status, comments, details } = req.body;

    // Step → process_status mapping
    const stepStatusMap = {
        '3.1': 'Impact Assessment',
        '3.2': 'Pending ECN Approval',
        '3.3': 'Top Mgmt Approval',
        '3.4': 'DWG Suspension',
        '3.45': 'ECN Execution',
        '3.5': 'FAI Process',
        '3.6': 'Closed',
        '4.0': 'Closed',
    };

    // If denied, set status to Denied
    const nextStatus = action_status === 'Deny'
        ? 'Denied'
        : (stepStatusMap[step_number] || 'Pending Dept Mgr');

    const sqlLog = `
        INSERT INTO ecnt_approval_log (
            ecr_id, step_number, action_by, action_role, action_status, comments, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;

    const sqlUpdateStatus = `
        UPDATE ecnt_document SET process_status = $1, updated_at = NOW() WHERE id = $2
    `;

    const sqlNotification = `
        INSERT INTO ecnt_notifications (ecr_id, step, action_by, message)
        VALUES ($1, $2, $3, $4)
    `;

    try {
        const result = await engPool.query(sqlLog, [
            id, step_number, action_by, action_role, action_status, comments,
            details ? JSON.stringify(details) : null
        ]);

        // Update the document's process_status
        await engPool.query(sqlUpdateStatus, [nextStatus, id]);

        // Add Notification
        const message = `Step ${step_number} was ${action_status.toLowerCase()} by ${action_by} (${action_role}).`;
        await engPool.query(sqlNotification, [id, step_number, action_by, message]);

        res.json({ message: "Approval submitted successfully", log_id: result.rows[0].id, new_status: nextStatus });
    } catch (err) {
        console.error("ECR Approval Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrSetTasks = async (req, res) => {
    const { id } = req.params;
    const { tasks } = req.body; // Array of { dept_name, task_detail }

    try {
        // Delete old tasks to prevent duplicates if editing
        await engPool.query(`DELETE FROM ecnt_tasks WHERE ecr_id = $1`, [id]);

        if (tasks && tasks.length > 0) {
            for (const t of tasks) {
                await engPool.query(
                    `INSERT INTO ecnt_tasks (ecr_id, dept_name, task_detail) VALUES ($1, $2, $3)`,
                    [id, t.dept_name, t.task_detail]
                );
            }
        }
        res.json({ message: "Tasks assigned successfully" });
    } catch (err) {
        console.error("ECR Set Tasks Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrGetTasks = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`SELECT * FROM ecnt_tasks WHERE ecr_id = $1 ORDER BY created_at ASC`, [id]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("ECR Get Tasks Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrAckTask = async (req, res) => {
    const { taskId } = req.params;
    const { user_name } = req.body;
    try {
        await engPool.query(
            `UPDATE ecnt_tasks SET is_checked = true, checked_by = $1, checked_at = NOW() WHERE id = $2`,
            [user_name, taskId]
        );
        res.json({ message: "Task acknowledged successfully" });
    } catch (err) {
        console.error("ECR Ack Task Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const tumbleGetAllCondition = (req, res) => {
    const query = `SELECT DISTINCT ON (code, process, mc_type_no) * FROM tumble_condition ORDER BY code ASC;`
    pool.query(query, (err, results) => {
        if (err) {
            const errMsg = [":: error getAllmodel :: ", err];
            throw errMsg;
        }
        res.status(200).json(results.rows);
    })
}

const tumbleCreateCondition = async (req, res) => {
    const { code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time, update_user } = req.body;

    const query = `
      INSERT INTO tumble_condition (code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time, create_user, create_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP) RETURNING *`;

    try {
        const results = await pool.query(query, [code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min, inspection_sampling, water_displacement_used, time, rust_protection_used, rust_protection_time, update_user]);
        res.json({ success: true, message: "Added successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error addmodel ::", error);
        res.status(500).json({ success: false, message: "Failed to add data" });
    }
};

const tumbleUpdateCondition = async (req, res) => {
    const { id } = req.params;
    const {
        code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max,
        media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min,
        inspection_sampling, water_displacement_used, time, rust_protection_used,
        rust_protection_time, update_user
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get current data for backup
        const currentData = await client.query('SELECT * FROM tumble_condition WHERE id = $1', [id]);

        if (currentData.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Data not found" });
        }

        const row = currentData.rows[0];

        // 2. Insert current data into history table
        const insertHistoryQuery = `
    INSERT INTO tumble_condition_history (
        code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time, qty_max,
        media_spec, media_qty_kg, ss_100, light_1a, water_qty_l, revolution, time_min,
        inspection_sampling, water_displacement_used, time, rust_protection_used,
        rust_protection_time,
        update_user, update_date
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, CURRENT_TIMESTAMP
    )
    `;

        await client.query(insertHistoryQuery, [
            row.code, row.process, row.mc_type_no, row.cleaning_parts_used, row.cleaning_parts_time, row.qty_max,
            row.media_spec, row.media_qty_kg, row.ss_100, row.light_1a, row.water_qty_l, row.revolution, row.time_min,
            row.inspection_sampling, row.water_displacement_used, row.time, row.rust_protection_used,
            row.rust_protection_time, row.update_user
        ]); // ✅ 24 values



        // 3. Update current record
        const updateQuery = `
        UPDATE tumble_condition
        SET code = $2, process = $3, mc_type_no = $4, cleaning_parts_used = $5, cleaning_parts_time = $6,
            qty_max = $7, media_spec = $8, media_qty_kg = $9, ss_100 = $10, light_1a = $11, water_qty_l = $12,
            revolution = $13, time_min = $14, inspection_sampling = $15, water_displacement_used = $16,
            time = $17, rust_protection_used = $18, rust_protection_time = $19,
             update_user = $20, update_date = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

        const results = await client.query(updateQuery, [
            id, code, process, mc_type_no, cleaning_parts_used, cleaning_parts_time,
            qty_max, media_spec, media_qty_kg, ss_100, light_1a, water_qty_l,
            revolution, time_min, inspection_sampling, water_displacement_used, time,
            rust_protection_used, rust_protection_time, update_user
        ]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Updated successfully", data: results.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(":: error updateTumbleCondition ::", error);
        res.status(500).json({ success: false, message: "Failed to update data" });
    } finally {
        client.release();
    }
};

const tumbleDeleteCondition = async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM tumble_condition WHERE id = $1 RETURNING *";

    try {
        const results = await pool.query(query, [id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        console.error(":: error deletemodel ::", error);
        res.status(500).json({ success: false, message: "Failed to delete data" });
    }
};

const tumbleGetAllModel = (req, res) => {
    const query = `SELECT *
        FROM tumble_condition_part
        ORDER BY code, part_name;
        `
    pool.query(query, (err, results) => {
        if (err) {
            const errMsg = [":: error getAllmodel :: ", err];
            throw errMsg;
        }
        res.status(200).json(results.rows);
    })
}

const tumbleCreateModel = async (req, res) => {
    const { code, part_name, detail, material_part, part_size, process_code,
        update_user } = req.body;

    const query = `
      INSERT INTO tumble_condition_part (code, part_name, detail, material_part, part_size, process_code,
      update_user, create_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING *`;

    try {
        const results = await pool.query(query, [code, part_name, detail, material_part, part_size, process_code,
            update_user]);
        res.json({ success: true, message: "Added successfully", data: results.rows[0] });
    } catch (error) {
        console.error(":: error addmodel ::", error);
        res.status(500).json({ success: false, message: "Failed to add data" });
    }
};

const tumbleUpdateModel = async (req, res) => {
    const { id } = req.params;
    const {
        code, part_name, detail, material_part, part_size, process_code,
        update_user
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // ต้องเริ่ม Transaction ก่อน

        const updateQuery = `
        UPDATE tumble_condition_part
        SET 
          code = $2,
          part_name = $3,
          detail = $4,
          material_part = $5,
          part_size = $6,
          process_code = $7,
          update_user = $8,
          update_date = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

        const results = await client.query(updateQuery, [
            id, code, part_name, detail, material_part, part_size, process_code, update_user
        ]);

        await client.query('COMMIT');
        res.json({ success: true, message: "อัปเดตข้อมูลสำเร็จ", data: results.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(":: error updateTumbleCondition ::", error);
        res.status(500).json({ success: false, message: "ไม่สามารถอัปเดตข้อมูลได้" });
    } finally {
        client.release();
    }
};

const tumbleDeleteModel = async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM tumble_condition_part WHERE id = $1 RETURNING *";

    try {
        const results = await pool.query(query, [id]);
        if (results.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        console.error(":: error deletemodel ::", error);
        res.status(500).json({ success: false, message: "Failed to delete data" });
    }
};

module.exports = {
    ecrCreate,
    ecrGetList,
    ecrGetById,
    ecrSubmitApproval,
    ecrSetTasks,
    ecrGetTasks,
    ecrAckTask,
    tumbleGetAllCondition,
    tumbleUpdateCondition,
    tumbleCreateCondition,
    tumbleDeleteCondition,
    tumbleGetAllModel,
    tumbleCreateModel,
    tumbleUpdateModel,
    tumbleDeleteModel,
};