const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');
<<<<<<< HEAD
=======
const { sendEmailWithFallback } = require('../../system/emailService');
const path = require('path');

// Load email renderer from templates folder (at ENG-Backend root)
const emailRendererPath = path.join(__dirname, '../../../templates/email/emailRenderer');
const { renderEmail, generateSubject } = require(emailRendererPath);

const {
  WORKFLOW_STAGES,
  WORKFLOW_STATUS,
  STAGE_LABELS,
  DUE_DATE_CONFIG,
  REQUEST_TYPES,
} = require('./constants/workflow');
const { verifyToken, optionalAuth, checkStagePermission } = require('./middleware/toolRequestAuth');
const { validateFileUpload, sanitizeFilename } = require('./middleware/fileUpload');
const fs = require('fs');

// ── Logger utility ───────────────────────────────────────────────────────────
const logger = {
  info: (msg, data = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
  warn: (msg, data = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
  error: (msg, data = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
};

// ── Email recipient config — อ่านจาก environment variables ──────────────────
const splitEmails = (key) =>
  (process.env[key] || '').split(',').map(e => e.trim()).filter(Boolean);

const EMAIL_CONFIG = {
  [WORKFLOW_STAGES.ENG_CHECK]: splitEmails('EMAIL_MTC_ENG_CHECK'),
  [WORKFLOW_STAGES.DRAFT_MAN]: splitEmails('EMAIL_MTC_DRAFTMAN'),
  [WORKFLOW_STAGES.DWG_CHECK]: splitEmails('EMAIL_MTC_DWG_CHECK'),
  [WORKFLOW_STAGES.ENG_REVIEW]: splitEmails('EMAIL_MTC_ENG_REVIEW'),
  [WORKFLOW_STAGES.ENG_APPROVE]: splitEmails('EMAIL_MTC_ENG_APPROVE'),
  [WORKFLOW_STAGES.ENG_INFORM]: splitEmails('EMAIL_MTC_ENG_INFORM'),
};

// ── Due date by request type ──────────────────────────────────────────────────
function calcDueDate(typeOfRequest) {
  const days = DUE_DATE_CONFIG[typeOfRequest] || DUE_DATE_CONFIG.DEFAULT;
  let due = moment();
  let added = 0;
  while (added < days) {
    due.add(1, 'days');
    if (due.day() !== 0 && due.day() !== 6) added++;
  }
  return due.format('YYYY-MM-DD HH:mm:ss');
}

// ── Stage → allowed emails (ใช้ EMAIL_CONFIG เดิม) ───────────────────────────
const STAGE_ALLOWED = EMAIL_CONFIG;

/**
 * GET /api/engineer/mtc/tool-requests/permissions
 * คืน allowed emails ของแต่ละ stage
 */
const getStagePermissions = (req, res) => {
  res.json({ data: STAGE_ALLOWED });
};

// ── Workflow stage map ────────────────────────────────────────────────────────
const STAGE_MAP = {
  [WORKFLOW_STAGES.ENG_CHECK]:  { stepNo: 1, approveStatus: WORKFLOW_STATUS.PENDING_DRAFT_MAN,   approveStage: 'Draft Man',   denyStatus: WORKFLOW_STATUS.DENIED,             denyStage: 'Denied',   emailApprove: WORKFLOW_STAGES.DRAFT_MAN,    emailDeny: null },
  [WORKFLOW_STAGES.DRAFT_MAN]:  { stepNo: 2, approveStatus: WORKFLOW_STATUS.PENDING_DWG_CHECK,   approveStage: 'DWG Check',                                                             emailApprove: WORKFLOW_STAGES.DWG_CHECK },
  [WORKFLOW_STAGES.DWG_CHECK]:  { stepNo: 3, approveStatus: WORKFLOW_STATUS.PENDING_ENG_REVIEW,  approveStage: 'Eng Review',  denyStatus: WORKFLOW_STATUS.PENDING_DRAFT_MAN,  denyStage: 'Draft Man',  emailApprove: WORKFLOW_STAGES.ENG_REVIEW,  emailDeny: WORKFLOW_STAGES.DRAFT_MAN },
  [WORKFLOW_STAGES.ENG_REVIEW]: { stepNo: 4, approveStatus: WORKFLOW_STATUS.PENDING_ENG_APPROVE, approveStage: 'Eng Approve',                                                            emailApprove: WORKFLOW_STAGES.ENG_APPROVE },
  [WORKFLOW_STAGES.ENG_APPROVE]:{ stepNo: 5, approveStatus: WORKFLOW_STATUS.PENDING_ENG_INFORM,  approveStage: 'Eng Inform',  denyStatus: WORKFLOW_STATUS.DENIED_BY_APPROVE,  denyStage: 'Denied',    emailApprove: WORKFLOW_STAGES.ENG_INFORM,  emailDeny: null },
  [WORKFLOW_STAGES.ENG_INFORM]: { stepNo: 6, approveStatus: WORKFLOW_STATUS.COMPLETED_INFORMED,  approveStage: 'Completed',                                                              emailApprove: null },
};
>>>>>>> old-work-backup

/**
 * GET /api/engineer/mtc/tool-requests
 * List all tool requests with optional filtering
 */
const getToolRequests = async (req, res) => {
<<<<<<< HEAD
    const { status, search, startDate, endDate } = req.query;

    let sql = `SELECT * FROM tr_request WHERE 1=1`;
=======
    const { status, search, startDate, endDate, page, limit } = req.query;

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset   = (pageNum - 1) * limitNum;

    let baseWhere = `WHERE deleted_at IS NULL`;
>>>>>>> old-work-backup
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
<<<<<<< HEAD
        sql += ` AND status = $${paramIndex++}`;
=======
        baseWhere += ` AND status = $${paramIndex++}`;
>>>>>>> old-work-backup
        params.push(status);
    }

    if (search) {
<<<<<<< HEAD
        sql += ` AND (request_item ILIKE $${paramIndex++} OR title ILIKE $${paramIndex++} OR requester ILIKE $${paramIndex++})`;
=======
        baseWhere += ` AND (request_item ILIKE $${paramIndex++} OR title ILIKE $${paramIndex++} OR requester ILIKE $${paramIndex++})`;
>>>>>>> old-work-backup
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (startDate) {
<<<<<<< HEAD
        sql += ` AND DATE(created_at) >= $${paramIndex++}`;
=======
        baseWhere += ` AND DATE(created_at) >= $${paramIndex++}`;
>>>>>>> old-work-backup
        params.push(startDate);
    }

    if (endDate) {
<<<<<<< HEAD
        sql += ` AND DATE(created_at) <= $${paramIndex++}`;
        params.push(endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    try {
        const result = await engPool.query(sql, params);
        res.json({ data: result.rows });
=======
        baseWhere += ` AND DATE(created_at) <= $${paramIndex++}`;
        params.push(endDate);
    }

    try {
        const [dataRes, countRes] = await Promise.all([
            engPool.query(
                `SELECT * FROM tr_request ${baseWhere} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, limitNum, offset]
            ),
            engPool.query(`SELECT COUNT(*) as total FROM tr_request ${baseWhere}`, params),
        ]);

        const total = parseInt(countRes.rows[0].total);
        res.json({
            data: dataRes.rows,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
>>>>>>> old-work-backup
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
<<<<<<< HEAD
        const requestRes = await engPool.query('SELECT * FROM tr_request WHERE id = $1', [id]);
=======
        const requestRes = await engPool.query('SELECT * FROM tr_request WHERE id = $1 AND deleted_at IS NULL', [id]);
>>>>>>> old-work-backup
        const request = requestRes.rows[0];

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Then get workflow history
<<<<<<< HEAD
=======
        // Use created_at for ordering as it is the standard in the new migration
>>>>>>> old-work-backup
        const workflowRes = await engPool.query('SELECT * FROM tr_workflow WHERE req_id = $1 ORDER BY created_at ASC', [id]);

        res.json({
            data: {
                ...request,
                workflow: workflowRes.rows || []
            }
        });
    } catch (err) {
<<<<<<< HEAD
        console.error('Error fetching tool request details:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/engineer/mtc/tool-requests
 * Create new tool request
 */
=======
        console.error(`❌ Error fetching tool request details (ID: ${id}):`, err.message);
        return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
    }
};

>>>>>>> old-work-backup
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
<<<<<<< HEAD
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน (Department, Work Center, Requester, Type, Category, Title, Detail)'
            });
        }

=======
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
            });
        }

        // Handle File Upload with sanitized filename
        let file_path = null;
        if (req.files && req.files.attachment) {
            const file = req.files.attachment;
            const sanitizedFileName = sanitizeFilename(file.name, 'attachment');
            const uploadDir = path.join(__dirname, '../../../files/tool_requests');
            
            // Ensure directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const uploadPath = path.join(uploadDir, sanitizedFileName);

            // Move file to directory
            await file.mv(uploadPath);
            file_path = `/tool_requests/${sanitizedFileName}`;
            logger.info('File uploaded successfully', { originalName: file.name, savedPath: file_path });
        }

>>>>>>> old-work-backup
        // Generate request_item: ITEM-YYYYMMDD-XXX
        const now = moment();
        const dateStr = now.format('YYYYMMDD');

<<<<<<< HEAD
        // Get count for today to generate sequence
        const countRes = await engPool.query(`SELECT COUNT(*) as count FROM tr_request WHERE request_item LIKE $1`, [`ITEM-${dateStr}-%`]);
        const count = parseInt(countRes.rows[0].count);

        const seq = String((count || 0) + 1).padStart(3, '0');
        const request_item = `ITEM-${dateStr}-${seq}`;

        // Calculate due date (default 14 days)
        const req_due_date = now.add(14, 'days').format('YYYY-MM-DD HH:mm:ss');
=======
        const countRes = await engPool.query(`SELECT COUNT(*) as count FROM tr_request WHERE request_item LIKE $1`, [`ITEM-${dateStr}-%`]);
        const count = parseInt(countRes.rows[0].count);
        const seq = String((count || 0) + 1).padStart(3, '0');
        const request_item = `ITEM-${dateStr}-${seq}`;

        const req_due_date = calcDueDate(type_of_request);
>>>>>>> old-work-backup

        const sql = `
            INSERT INTO tr_request (
                request_item, department, work_center, work_center_name,
                requester, requester_email, type_of_request, category,
                drawing_required, type_of_drawing, title, detail,
<<<<<<< HEAD
                machine_no, machine_name, req_due_date, req_no
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id
        `;

        // Setting req_no = request_item mapping from older codebase since req_no replaces request_no
=======
                machine_no, machine_name, req_due_date, req_no,
                status, current_stage, file_path, req_by, req_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $5, NOW()) RETURNING id
        `;

>>>>>>> old-work-backup
        const params = [
            request_item, department, work_center, work_center_name,
            requester, requester_email, type_of_request, category,
            drawing_required, type_of_drawing, title, detail,
<<<<<<< HEAD
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
=======
            machine_no, machine_name, req_due_date, request_item,
            WORKFLOW_STATUS.PENDING_ENG_CHECK, 'Eng Check', file_path
        ];

        try {
            const insertRes = await engPool.query(sql, params);
            logger.info('Tool request created successfully', { id: insertRes.rows[0].id, request_item });
            res.json({ result: 'true', message: 'บันทึกคำขอเรียบร้อยแล้ว', id: insertRes.rows[0].id });
        } catch (dbErr) {
            logger.error('Database Insert Error', { error: dbErr.message });
            res.status(500).json({ result: 'false', message: dbErr.message });
        }
    } catch (error) {
        logger.error('Server Error', { error: error.message });
        res.status(500).json({ result: 'false', message: 'Server Error' });
>>>>>>> old-work-backup
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
<<<<<<< HEAD
 * Delete tool request
=======
 * Soft-delete tool request (ตั้ง deleted_at แทนการลบจริง เพื่อรักษา audit trail)
>>>>>>> old-work-backup
 */
const deleteToolRequest = async (req, res) => {
    const { id } = req.params;

<<<<<<< HEAD
    const client = await engPool.connect();

    try {
        await client.query('BEGIN');

        // Delete workflow records first (if any)
        await client.query('DELETE FROM tr_workflow WHERE req_id = $1', [id]);

        // Then delete the main request
        const delRes = await client.query('DELETE FROM tr_request WHERE id = $1', [id]);

        if (delRes.rowCount === 0) {
            await client.query('ROLLBACK');
=======
    try {
        const result = await engPool.query(
            `UPDATE tr_request SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (result.rowCount === 0) {
>>>>>>> old-work-backup
            return res.status(404).json({
                result: 'false',
                message: 'ไม่พบข้อมูลที่ต้องการลบ'
            });
        }

<<<<<<< HEAD
        await client.query('COMMIT');

=======
>>>>>>> old-work-backup
        res.json({
            result: 'true',
            message: 'ลบข้อมูลเรียบร้อยแล้ว'
        });
    } catch (err) {
<<<<<<< HEAD
        await client.query('ROLLBACK');
=======
>>>>>>> old-work-backup
        console.error('Error deleting tool request:', err.message);
        return res.status(500).json({
            result: 'false',
            message: err.message
        });
<<<<<<< HEAD
    } finally {
        client.release();
=======
>>>>>>> old-work-backup
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
<<<<<<< HEAD
            SELECT 
                status,
                COUNT(*) as count
            FROM tr_request
=======
            SELECT
                status,
                COUNT(*) as count
            FROM tr_request
            WHERE deleted_at IS NULL
>>>>>>> old-work-backup
            GROUP BY status
        `);

        stats.byStatus = statusCountsRes.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});

        // Get total count
<<<<<<< HEAD
        const totalRes = await engPool.query('SELECT COUNT(*) as total FROM tr_request');
=======
        const totalRes = await engPool.query('SELECT COUNT(*) as total FROM tr_request WHERE deleted_at IS NULL');
>>>>>>> old-work-backup
        stats.total = parseInt(totalRes.rows[0].total);

        // Get requests created in last 30 days
        const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');
<<<<<<< HEAD
        const recentRes = await engPool.query('SELECT COUNT(*) as recent FROM tr_request WHERE DATE(created_at) >= $1', [thirtyDaysAgo]);
=======
        const recentRes = await engPool.query('SELECT COUNT(*) as recent FROM tr_request WHERE deleted_at IS NULL AND DATE(created_at) >= $1', [thirtyDaysAgo]);
>>>>>>> old-work-backup
        stats.last30Days = parseInt(recentRes.rows[0].recent);

        // Get overdue count
        const today = moment().format('YYYY-MM-DD');
        const overdueRes = await engPool.query(`
<<<<<<< HEAD
             SELECT COUNT(*) as overdue FROM tr_request 
             WHERE status != 'Complete' AND status != 'Denied' 
=======
             SELECT COUNT(*) as overdue FROM tr_request
             WHERE deleted_at IS NULL
             AND status NOT IN ('Completed & Informed', 'Denied', 'Denied by Approve')
>>>>>>> old-work-backup
             AND DATE(req_due_date) < $1
        `, [today]);
        stats.overdue = parseInt(overdueRes.rows[0].overdue);

        res.json({ data: stats });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

<<<<<<< HEAD
=======
/**
 * POST /api/engineer/mtc/tool-requests/:id/action
 * Submit a workflow stage action (approve/deny/submit)
 */
const submitAction = async (req, res) => {
    const { id } = req.params;
    const { stage, decision, comment, action_by } = req.body;

    // extra อาจมาเป็น JSON string (กรณี FormData) หรือ object (กรณี JSON)
    let extra = req.body.extra;
    if (typeof extra === 'string') {
        try { extra = JSON.parse(extra); } catch { extra = {}; }
    }
    extra = extra || {};

    // จัดการไฟล์แนบ (Draft Man → dwg_files, Eng Review → review_files)
    const uploadDir = path.join(__dirname, '../../../files/tool_requests');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const saveFiles = async (fieldName, pathKey, nameKey) => {
        if (!req.files?.[fieldName]) return;
        const fileList = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
        const savedPaths = [], savedNames = [];
        for (const file of fileList) {
            const sanitizedFileName = sanitizeFilename(file.name, `${id}_${fieldName}`);
            await file.mv(path.join(uploadDir, sanitizedFileName));
            savedPaths.push(`/tool_requests/${sanitizedFileName}`);
            savedNames.push(file.name);
        }
        extra[pathKey] = savedPaths;
        extra[nameKey] = savedNames;
        logger.info('Files saved for workflow action', { fieldName, count: savedPaths.length });
    };

    await saveFiles('dwg_files',    'dwg_file_paths',    'dwg_file_names');
    await saveFiles('review_files', 'review_file_paths', 'review_file_names');

    if (!stage || !decision) {
        return res.status(400).json({ error: 'stage and decision are required' });
    }

    // ── ตรวจสิทธิ์ — AD department bypass, เช็ค u_code หรือ email ─────────────
    const allowedEmails = STAGE_ALLOWED[stage] || [];
    const userDept = (req.body.user_department || '').toUpperCase();
    if (allowedEmails.length > 0 && userDept !== 'AD') {
        const allowedCodes = allowedEmails.map(e => e.split('@')[0].toLowerCase());
        const userCode = (req.body.user_code || '').toLowerCase();
        const userEmailVal = (req.body.action_by_email || '').toLowerCase();
        const isAllowed = allowedCodes.includes(userCode)
            || allowedEmails.map(e => e.toLowerCase()).includes(userEmailVal);
        if (!isAllowed) {
            logger.warn('Permission denied', { stage, userDept, userCode });
            return res.status(403).json({ error: `คุณไม่มีสิทธิ์ดำเนินการในขั้นตอน ${stage}` });
        }
    }

    const stageConfig = STAGE_MAP[stage];
    if (!stageConfig) {
        return res.status(400).json({ error: `Unknown stage: ${stage}` });
    }

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        logger.info('Starting action submit', { id, stage, decision });

        // Get current request
        const reqRes = await client.query('SELECT * FROM tr_request WHERE id = $1 AND deleted_at IS NULL', [id]);
        const request = reqRes.rows[0];
        if (!request) {
            logger.error('Request not found', { id });
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found' });
        }

        const isApprove = decision === 'approve' || decision === 'submit';
        const nextStatus = isApprove ? stageConfig.approveStatus : stageConfig.denyStatus;
        const nextStage  = isApprove ? stageConfig.approveStage  : stageConfig.denyStage;

        if (!nextStatus) {
            logger.error('Stage does not support decision', { stage, decision });
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Stage "${stage}" does not support decision "${decision}"` });
        }

        // Update request status + stage
        const newReqNo = (stage === WORKFLOW_STAGES.ENG_CHECK && isApprove && extra?.request_no)
            ? extra.request_no : null;

        logger.info('Updating tr_request', { nextStatus, nextStage, newReqNo });
        await client.query(
            `UPDATE tr_request SET
                status = $1,
                current_stage = $2,
                req_no = COALESCE($3, req_no),
                updated_at = NOW()
             WHERE id = $4`,
            [nextStatus, nextStage, newReqNo, id]
        );

        // Insert workflow record
        logger.info('Inserting tr_workflow record', { stepNo: stageConfig.stepNo });
        await client.query(
            `INSERT INTO tr_workflow (req_id, step_no, action_by, action_type, comment, status, stage_name, extra_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, stageConfig.stepNo, action_by || 'system', decision,
             comment || '', nextStatus, stage, JSON.stringify(extra || {})]
        );

        await client.query('COMMIT');
        logger.info('Action submitted and committed successfully', { id, nextStatus });

        // Send email (fire-and-forget — don't block response)
        try {
            const emailKey = isApprove ? stageConfig.emailApprove : stageConfig.emailDeny;
            let recipients = emailKey ? EMAIL_CONFIG[emailKey] : [];

            // For deny, also CC the requester
            if (!isApprove && request.requester_email) {
                recipients = [request.requester_email, ...recipients];
            }
            // For eng_inform completed, notify requester
            if (stage === WORKFLOW_STAGES.ENG_INFORM && request.requester_email) {
                recipients = [request.requester_email, ...recipients];
            }

            if (recipients.length > 0) {
                const subject = generateSubject(stage, decision, request);
                const html = renderEmail({
                    stage,
                    decision,
                    request,
                    extra: { ...extra, comment },
                    actionBy: action_by || 'System',
                });
                logger.info('Sending email notification', { recipients, subject });
                sendEmailWithFallback(recipients.join(','), subject, html).catch((err) => {
                    logger.error('Email sending failed', { error: err.message });
                });
            }
        } catch (emailErr) {
            logger.warn('Email notification failed', { error: emailErr.message });
            // Email failure should not affect response
        }

        res.json({
            success: true,
            request_item: request.request_item,
            status: nextStatus,
            current_stage: nextStage,
            message: `${stage} ${decision} submitted successfully`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Error submitting action', { error: err.message });
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

>>>>>>> old-work-backup
module.exports = {
    getToolRequests,
    getToolRequestById,
    createToolRequest,
    updateToolRequest,
    deleteToolRequest,
<<<<<<< HEAD
    getToolRequestDashboard
=======
    getToolRequestDashboard,
    getStagePermissions,
    submitAction,
>>>>>>> old-work-backup
};
