const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');

/**
 * GET /api/engineer/mtc/tool-requests
 * List all tool requests with optional filtering
 */
const getToolRequests = async (req, res) => {
    const { status, search, startDate, endDate } = req.query;

    let sql = `SELECT * FROM tr_request WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
        sql += ` AND status = $${paramIndex++}`;
        params.push(status);
    }

    if (search) {
        sql += ` AND (request_item ILIKE $${paramIndex++} OR title ILIKE $${paramIndex++} OR requester ILIKE $${paramIndex++})`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (startDate) {
        sql += ` AND DATE(created_at) >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        sql += ` AND DATE(created_at) <= $${paramIndex++}`;
        params.push(endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
        const result = await engPool.query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching tool requests:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/engineer/mtc/tool-requests/:id
 * Get single tool request with workflow details
 */
const getToolRequestById = async (req, res) => {
    const { id } = req.params;

    try {
        // First get the main request
        const requestRes = await engPool.query('SELECT * FROM tr_request WHERE id = $1', [id]);
        const request = requestRes.rows[0];

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Then get workflow history
        const workflowRes = await engPool.query('SELECT * FROM tr_workflow WHERE req_id = $1 ORDER BY created_at ASC', [id]);

        res.json({
            data: {
                ...request,
                workflow: workflowRes.rows || []
            }
        });
    } catch (err) {
        console.error('Error fetching tool request details:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/engineer/mtc/tool-requests
 * Create new tool request
 */
const createToolRequest = async (req, res) => {
    try {
        const {
            department,
            work_center,
            work_center_name,
            requester,
            requester_email,
            type_of_request,
            category,
            drawing_required,
            type_of_drawing,
            title,
            detail,
            machine_no,
            machine_name
        } = req.body;

        // Validation
        if (!department || !work_center || !requester || !type_of_request || !category || !title || !detail) {
            return res.status(400).json({
                result: 'false',
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Department, Work Center, Requester, Type, Category, Title, Detail)'
            });
        }

        // Generate request_item: ITEM-YYYYMMDD-XXX
        const now = moment();
        const dateStr = now.format('YYYYMMDD');

        // Get count for today to generate sequence
        const countRes = await engPool.query(`SELECT COUNT(*) as count FROM tr_request WHERE request_item LIKE $1`, [`ITEM-${dateStr}-%`]);
        const count = parseInt(countRes.rows[0].count);

        const seq = String((count || 0) + 1).padStart(3, '0');
        const request_item = `ITEM-${dateStr}-${seq}`;

        // Calculate due date (default 14 days)
        const req_due_date = now.add(14, 'days').format('YYYY-MM-DD HH:mm:ss');

        const sql = `
            INSERT INTO tr_request (
                request_item, department, work_center, work_center_name,
                requester, requester_email, type_of_request, category,
                drawing_required, type_of_drawing, title, detail,
                machine_no, machine_name, req_due_date, req_no
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id
        `;

        // Setting req_no = request_item mapping from older codebase since req_no replaces request_no
        const params = [
            request_item, department, work_center, work_center_name,
            requester, requester_email, type_of_request, category,
            drawing_required, type_of_drawing, title, detail,
            machine_no, machine_name, req_due_date, request_item
        ];

        const insertRes = await engPool.query(sql, params);
        const newId = insertRes.rows[0].id;

        console.log(`✅ Created tool request: ${request_item} (ID: ${newId})`);

        res.json({
            result: 'true',
            message: 'บันทึกคำขอเรียบร้อยแล้ว',
            data: {
                id: newId,
                request_item
            }
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            result: 'false',
            message: 'Server Error'
        });
    }
};

/**
 * PUT /api/engineer/mtc/tool-requests/:id
 * Update tool request
 */
const updateToolRequest = async (req, res) => {
    const { id } = req.params;
    const {
        department,
        work_center,
        work_center_name,
        type_of_request,
        category,
        drawing_required,
        type_of_drawing,
        title,
        detail,
        machine_no,
        machine_name,
        status,
        current_stage,
        request_no // Note: old code sends request_no, we map to req_no below
    } = req.body;

    const sql = `
        UPDATE tr_request SET
            department = COALESCE($1, department),
            work_center = COALESCE($2, work_center),
            work_center_name = COALESCE($3, work_center_name),
            type_of_request = COALESCE($4, type_of_request),
            category = COALESCE($5, category),
            drawing_required = COALESCE($6, drawing_required),
            type_of_drawing = COALESCE($7, type_of_drawing),
            title = COALESCE($8, title),
            detail = COALESCE($9, detail),
            machine_no = $10,
            machine_name = $11,
            status = COALESCE($12, status),
            current_stage = COALESCE($13, current_stage),
            req_no = COALESCE($14, req_no),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $15
    `;

    const params = [
        department, work_center, work_center_name,
        type_of_request, category, drawing_required, type_of_drawing,
        title, detail, machine_no, machine_name,
        status, current_stage, request_no, id
    ];

    try {
        const result = await engPool.query(sql, params);

        if (result.rowCount === 0) {
            return res.status(404).json({
                result: 'false',
                message: 'ไม่พบข้อมูลที่ต้องการแก้ไข'
            });
        }

        res.json({
            result: 'true',
            message: 'อัพเดทข้อมูลเรียบร้อยแล้ว',
            changes: result.rowCount
        });
    } catch (err) {
        console.error('Error updating tool request:', err.message);
        return res.status(500).json({
            result: 'false',
            message: err.message
        });
    }
};

/**
 * DELETE /api/engineer/mtc/tool-requests/:id
 * Delete tool request
 */
const deleteToolRequest = async (req, res) => {
    const { id } = req.params;

    const client = await engPool.connect();

    try {
        await client.query('BEGIN');

        // Delete workflow records first (if any)
        await client.query('DELETE FROM tr_workflow WHERE req_id = $1', [id]);

        // Then delete the main request
        const delRes = await client.query('DELETE FROM tr_request WHERE id = $1', [id]);

        if (delRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                result: 'false',
                message: 'ไม่พบข้อมูลที่ต้องการลบ'
            });
        }

        await client.query('COMMIT');

        res.json({
            result: 'true',
            message: 'ลบข้อมูลเรียบร้อยแล้ว'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting tool request:', err.message);
        return res.status(500).json({
            result: 'false',
            message: err.message
        });
    } finally {
        client.release();
    }
};

/**
 * GET /api/engineer/mtc/tool-requests/dashboard
 * Get dashboard statistics
 */
const getToolRequestDashboard = async (req, res) => {
    const stats = {};

    try {
        // Get total counts by status
        const statusCountsRes = await engPool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM tr_request
            GROUP BY status
        `);

        stats.byStatus = statusCountsRes.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});

        // Get total count
        const totalRes = await engPool.query('SELECT COUNT(*) as total FROM tr_request');
        stats.total = parseInt(totalRes.rows[0].total);

        // Get requests created in last 30 days
        const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');
        const recentRes = await engPool.query('SELECT COUNT(*) as recent FROM tr_request WHERE DATE(created_at) >= $1', [thirtyDaysAgo]);
        stats.last30Days = parseInt(recentRes.rows[0].recent);

        // Get overdue count
        const today = moment().format('YYYY-MM-DD');
        const overdueRes = await engPool.query(`
             SELECT COUNT(*) as overdue FROM tr_request 
             WHERE status != 'Complete' AND status != 'Denied' 
             AND DATE(req_due_date) < $1
        `, [today]);
        stats.overdue = parseInt(overdueRes.rows[0].overdue);

        res.json({ data: stats });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getToolRequests,
    getToolRequestById,
    createToolRequest,
    updateToolRequest,
    deleteToolRequest,
    getToolRequestDashboard
};
