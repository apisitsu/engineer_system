const { engPool } = require('../../../instance/eng_db');
const { pool } = require('../../../instance/instance');
const moment = require('moment');

const activity_log = () => {

}

const ecrCreate = async (req, res) => {
    const data = req.body;
<<<<<<< HEAD

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

=======
    // console.log("Received ECR Create Request:", data);

    const sql = `
    INSERT INTO ecr_request (
        request_no, req_date, requester, department, req_due_date, status, 
        drawing_required, tooling_required, program_required, tool_usage_required,
        
        -- Tooling / Program / Usage Section
        setup_data_sheet_no, part_no_tooling, cn_tooling, process_tooling, 
        program_no, machine_no, cycle_time, title_of_change, 
        reason_of_tooling, tooling_before_change, tooling_after_change,
        
        -- Tool Usage Only
        current_tooling_no, current_tooling_usage, new_tooling_no, new_tooling_usage,
        
        -- Drawing Section
        part_no_drawing, cn_drawing, rev_drawing, reason_of_drawing, 
        drawing_before_change, drawing_after_change,
        
        -- Upload Files
        upload_tooling_before, upload_tooling_after,
        upload_drawing_before, upload_drawing_after
    ) VALUES (
        $1, $2, $3, $4, $5, $6,  -- Header
        $7, $8, $9, $10,        -- Flags
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, -- Tooling
        $22, $23, $24, $25,        -- Usage
        $26, $27, $28, $29, $30, $31,  -- Drawing
        $32, $33, $34, $35         -- Files
    ) RETURNING id
`;

    // เตรียม Array ของค่าที่จะ Insert (เรียงลำดับให้ตรงกับ SQL ข้างบน)
    const params = [
        data.ecr_no, // Maps to request_no
        data.require_date ? moment(data.require_date).format('YYYY-MM-DD HH:mm:ss') : null, // req_date
        data.request_by, // requester
        data.department,
        data.due_date ? moment(data.due_date).format('YYYY-MM-DD HH:mm:ss') : null, // req_due_date
        data.status,

        // Flags (0/1 -> map to boolean internally or keep smallint mapping depending on DB)
        // Assume Postgres accepts boolean for flags if they were converted or integer
>>>>>>> old-work-backup
        data.is_drawing ? true : false,
        data.is_tooling ? true : false,
        data.is_program ? true : false,
        data.is_usage ? true : false,

<<<<<<< HEAD
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
=======
        // Tooling Section
        data.setup_data_sheet_no || '',
        data.part_no_tooling || '',   // ตรงกับ fieldsForToolProUsage
        data.cn_tooling || '',
        data.process || '', // process_tooling
        data.program_no || '',
        data.machine_no || '',
        data.cycle_time || '',
        data.title_of_change || '',
        data.reason_of_tooling || '',
        data.tooling_before_change || '',
        data.tooling_after_change || '',

        // Tool Usage Section
        data.current_tooling_no || '',
        data.current_tooling_usage || null,
        data.new_tooling_no || '',
        data.new_tooling_usage || null,

        // Drawing Section
        data.part_no_drawing || '',   // ตรงกับ fieldsDrawingChange
        data.cn_drawing || '',
        data.rev_drawing || '',       // ฟิลด์ใหม่ที่เพิ่มเข้ามา
        data.reason_of_drawing || '',
        data.drawing_before_change || '',
        data.drawing_after_change || '',

        // Upload Files
        data.upload_tooling_before || '', // รับค่าจากฟิลด์ upload
        data.upload_tooling_after || '',
        data.upload_drawing_before || '', // รับค่าจากฟิลด์ upload
        data.upload_drawing_after || ''
>>>>>>> old-work-backup
    ];

    try {
        const result = await engPool.query(sql, params);
        res.json({
            message: "Success",
<<<<<<< HEAD
            id: result.rows[0].id
        });
    } catch (err) {
        console.error("ECR Create Error:", err.message);
=======
            id: result.rows[0].id // ส่ง ID ที่เพิ่งสร้างกลับไป
        });
    } catch (err) {
        console.error("PG Error:", err.message);
>>>>>>> old-work-backup
        res.status(500).json({ error: err.message });
    }
};

const ecrGetList = async (req, res) => {
    try {
<<<<<<< HEAD
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

    // Helper to map robust UI steps to backend status strings
    const getStatusForStep = (step) => {
        switch (step?.toString()) {
            case '3.1': return 'Pending Dept Mgr';
            case '3.2': return 'Impact Assessment';
            case '3.3': return 'Pending ECN Approval';
            case '3.4': return 'Top Mgmt Approval';
            case '3.45': return 'DWG Suspension';
            case '3.5': return 'ECN Execution';
            case '3.6': return 'FAI Process';
            case '4.0': return 'Closed';
            default: return null;
        }
    };

    // Fallback step status map for backwards compatibility if next_step isn't passed
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

    let nextStatus;
    if (action_status === 'Deny') {
        nextStatus = 'Denied';
    } else if (action_status === 'Request More Detail') {
        nextStatus = 'Require More Detail';
    } else {
        nextStatus = stepStatusMap[step_number] || 'Pending Dept Mgr';
    }

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

        // If Approve at step 3.1 and assigned_to is provided, save it
        if (step_number === '3.1' && action_status === 'Approve' && details?.assigned_to) {
            await engPool.query(
                `UPDATE ecnt_document SET assigned_to = $1 WHERE id = $2`,
                [details.assigned_to, id]
            );
        }

        // Add Notification
        const message = `Step ${step_number} was ${action_status.toLowerCase()} by ${action_by} (${action_role}).`;
        await engPool.query(sqlNotification, [id, step_number, action_by, message]);

        // Phase 8: If Step 3.5 provides a target_ecn_close_date, update the document's due_date
        if (details?.target_ecn_close_date) {
            await engPool.query(
                `UPDATE ecnt_document SET due_date = $1 WHERE id = $2`,
                [details.target_ecn_close_date, id]
            );
        }

        res.json({ message: "Approval submitted successfully", log_id: result.rows[0].id, new_status: nextStatus });
    } catch (err) {
        console.error("ECR Approval Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrGetUsersByDept = async (req, res) => {
    const { dept } = req.params;
    try {
        const result = await engPool.query(
            `SELECT u_code, u_name, u_nickname, u_department, role, position
             FROM m_user_profile
             WHERE UPPER(u_department) = UPPER($1)
             ORDER BY u_name NULLS LAST`,
            [dept]
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error("ECR Get Users By Dept Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const ecrResubmit = async (req, res) => {
    const { id } = req.params;
    const { action_by, action_role, comments, details } = req.body;

    const sqlLog = `
        INSERT INTO ecnt_approval_log (
            ecr_id, step_number, action_by, action_role, action_status, comments, details
        ) VALUES ($1, 'resubmit', $2, $3, 'Resubmit', $4, $5) RETURNING id
    `;

    const sqlUpdateStatus = `
        UPDATE ecnt_document SET process_status = 'Pending Dept Mgr', updated_at = NOW() WHERE id = $1
    `;

    const sqlNotification = `
        INSERT INTO ecnt_notifications (ecr_id, step, action_by, message)
        VALUES ($1, 'resubmit', $2, $3)
    `;

    try {
        const result = await engPool.query(sqlLog, [
            id, action_by, action_role, comments,
            details ? JSON.stringify(details) : null
        ]);

        await engPool.query(sqlUpdateStatus, [id]);

        const message = `ECR was resubmitted with additional details by ${action_by} (${action_role}).`;
        await engPool.query(sqlNotification, [id, action_by, message]);

        res.json({ message: "ECR resubmitted successfully", log_id: result.rows[0].id, new_status: 'Pending Dept Mgr' });
    } catch (err) {
        console.error("ECR Resubmit Error:", err.message);
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
=======
        const sql = `
            SELECT * FROM ecr_request
        `;
        const result = await engPool.query(sql);
        res.json({
            data: result.rows
        });
    } catch (err) {
        console.error(err.message);
>>>>>>> old-work-backup
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

<<<<<<< HEAD
const axios = require('axios');

const getJobCheck = async (req, res) => {
    try {
        const apiKey = process.env.EXTERNAL_JOB_CHECK_API_KEY;
        const response = await axios.get(`http://pkv0198.kz.minebea.local:5002/api/job_check?key_gui=${apiKey}`, {
            proxy: false
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error proxying job_check:', error.message);
        res.status(500).json({ error: 'Failed to fetch from external API' });
    }
};

module.exports = {
    ecrCreate,
    ecrGetList,
    ecrGetById,
    ecrSubmitApproval,
    ecrGetUsersByDept,
    ecrResubmit,
    ecrSetTasks,
    ecrGetTasks,
    ecrAckTask,
=======
module.exports = {
    ecrCreate,
    ecrGetList,
>>>>>>> old-work-backup
    tumbleGetAllCondition,
    tumbleUpdateCondition,
    tumbleCreateCondition,
    tumbleDeleteCondition,
    tumbleGetAllModel,
    tumbleCreateModel,
    tumbleUpdateModel,
    tumbleDeleteModel,
<<<<<<< HEAD
    getJobCheck,
=======
>>>>>>> old-work-backup
};