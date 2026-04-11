const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');
const { sendEmailWithFallback } = require('../../system/emailService');
const path = require('path');
const { TABLES, PATHS } = require('./mtcConstants');

// Load email renderer from templates folder (at ENG-Backend root)
const { renderEmail, generateSubject } = require(PATHS.EMAIL_RENDERER);

const {
  WORKFLOW_STAGES,
  WORKFLOW_STATUS,
  STAGE_LABELS,
  DUE_DATE_CONFIG,
  REQUEST_TYPES,
} = require('./workflow');
const { verifyToken, optionalAuth, checkStagePermission } = require('./toolRequestAuth');
const { validateFileUpload, sanitizeFilename } = require('./fileUpload');
const fs = require('fs');

// ── Logger utility ───────────────────────────────────────────────────────────
const logger = {
  info: (msg, data = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
  warn: (msg, data = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
  error: (msg, data = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, JSON.stringify(data)),
};

// ── Email recipient config — อ่านจากฐานข้อมูล (tr_email_config) ────────────────
async function getEmailRecipients(stage) {
    try {
        // ดึงทั้งรายชื่อหลัก (stage) และรายชื่อ CC (CC_stage)
        const res = await engPool.query(
            `SELECT stage, emails FROM ${TABLES.TR_EMAIL_CONFIG} WHERE stage = $1 OR stage = $2`,
            [stage, `CC_${stage}`]
        );
        
        let allEmails = [];
        res.rows.forEach(row => {
            if (row.emails) {
                const list = row.emails.split(',').map(e => e.trim()).filter(Boolean);
                allEmails = [...allEmails, ...list];
            }
        });

        if (allEmails.length > 0) {
            return [...new Set(allEmails)]; // ลบตัวซ้ำออก
        }
        
        // Fallback: ถ้าไม่เจอใน DB ให้ไปอ่านจาก .env เหมือนเดิม (เฉพาะรายชื่อหลัก)
        const envMap = {
            [WORKFLOW_STAGES.ENG_CHECK]: 'EMAIL_MTC_ENG_CHECK',
            [WORKFLOW_STAGES.DRAFT_MAN]: 'EMAIL_MTC_DRAFTMAN',
            [WORKFLOW_STAGES.DWG_CHECK]: 'EMAIL_MTC_DWG_CHECK',
            [WORKFLOW_STAGES.ENG_REVIEW]: 'EMAIL_MTC_ENG_REVIEW',
            [WORKFLOW_STAGES.ENG_APPROVE]: 'EMAIL_MTC_ENG_APPROVE',
            [WORKFLOW_STAGES.ENG_INFORM]: 'EMAIL_MTC_ENG_INFORM',
        };
        const envKey = envMap[stage];
        return envKey ? (process.env[envKey] || '').split(',').map(e => e.trim()).filter(Boolean) : [];
    } catch (error) {
        logger.error('Error fetching email recipients from DB', { stage, error: error.message });
        return [];
    }
}

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

/**
 * GET /api/engineer/mtc/tool-requests/permissions
 * คืน allowed emails ของแต่ละ stage (ดึงจาก DB ทั้งหมด)
 */
const getStagePermissions = async (req, res) => {
    try {
        const configRes = await engPool.query(`SELECT stage, emails FROM ${TABLES.TR_EMAIL_CONFIG}`);
        const permissions = {};
        configRes.rows.forEach(row => {
            permissions[row.stage] = row.emails.split(',').map(e => e.trim()).filter(Boolean);
        });
        res.json({ data: permissions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

/**
 * GET /api/engineer/mtc/tool-requests
 * List all tool requests with optional filtering
 */
const getToolRequests = async (req, res) => {
    const { status, search, startDate, endDate, page, limit } = req.query;

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset   = (pageNum - 1) * limitNum;

    let baseWhere = `WHERE deleted_at IS NULL`;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
        baseWhere += ` AND status = $${paramIndex++}`;
        params.push(status);
    }

    if (search) {
        baseWhere += ` AND (request_item ILIKE $${paramIndex++} OR title ILIKE $${paramIndex++} OR requester ILIKE $${paramIndex++})`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (startDate) {
        baseWhere += ` AND DATE(created_at) >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        baseWhere += ` AND DATE(created_at) <= $${paramIndex++}`;
        params.push(endDate);
    }

    try {
        const [dataRes, countRes] = await Promise.all([
            engPool.query(
                `SELECT * FROM ${TABLES.TR_REQUEST} ${baseWhere} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                [...params, limitNum, offset]
            ),
            engPool.query(`SELECT COUNT(*) as total FROM ${TABLES.TR_REQUEST} ${baseWhere}`, params),
        ]);

        const total = parseInt(countRes.rows[0].total);
        res.json({
            data: dataRes.rows,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
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
        const requestRes = await engPool.query(`SELECT * FROM ${TABLES.TR_REQUEST} WHERE id = $1 AND deleted_at IS NULL`, [id]);
        const request = requestRes.rows[0];

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Then get workflow history
        const workflowRes = await engPool.query(`SELECT * FROM ${TABLES.TR_WORKFLOW} WHERE req_id = $1 ORDER BY created_at ASC`, [id]);

        res.json({
            data: {
                ...request,
                workflow: workflowRes.rows || []
            }
        });
    } catch (err) {
        console.error(`❌ Error fetching tool request details (ID: ${id}):`, err.message);
        return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
    }
};

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
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
            });
        }

        // Handle File Upload with sanitized filename
        let file_path = null;
        if (req.files && req.files.attachment) {
            const file = req.files.attachment;
            const sanitizedFileName = sanitizeFilename(file.name, 'attachment');
            const uploadDir = path.join(__dirname, '../../../files/tool_requests');
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const uploadPath = path.join(uploadDir, sanitizedFileName);
            await file.mv(uploadPath);
            file_path = `/tool_requests/${sanitizedFileName}`;
            logger.info('File uploaded successfully', { originalName: file.name, savedPath: file_path });
        }

        // Generate request_item: ITEM-YYYYMMDD-XXX
        const now = moment();
        const dateStr = now.format('YYYYMMDD');
        const countRes = await engPool.query(`SELECT COUNT(*) as count FROM ${TABLES.TR_REQUEST} WHERE request_item LIKE $1`, [`ITEM-${dateStr}-%`]);
        const count = parseInt(countRes.rows[0].count);
        const seq = String((count || 0) + 1).padStart(3, '0');
        const request_item = `ITEM-${dateStr}-${seq}`;

        const req_due_date = calcDueDate(type_of_request);

        const sql = `
            INSERT INTO ${TABLES.TR_REQUEST} (
                request_item, department, work_center, work_center_name,
                requester, requester_email, type_of_request, category,
                drawing_required, type_of_drawing, title, detail,
                machine_no, machine_name, req_due_date, req_no,
                status, current_stage, file_path, req_by, req_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $5, NOW()) RETURNING id
        `;

        const params = [
            request_item, department, work_center, work_center_name,
            requester, requester_email, type_of_request, category,
            drawing_required, type_of_drawing, title, detail,
            machine_no, machine_name, req_due_date, request_item,
            WORKFLOW_STATUS.PENDING_ENG_CHECK, 'Eng Check', file_path
        ];

        try {
            const insertRes = await engPool.query(sql, params);
            const requestId = insertRes.rows[0].id;
            logger.info('Tool request created successfully', { id: requestId, request_item });

            // --- ส่งอีเมลแจ้งเตือนสำหรับการสร้างคำขอใหม่ (ดึงจาก DB) ---
            try {
                const recipients = await getEmailRecipients(WORKFLOW_STAGES.ENG_CHECK);
                if (recipients.length > 0) {
                    const requestData = {
                        id: requestId,
                        request_item,
                        requester,
                        requester_email,
                        department,
                        title,
                        detail,
                        type_of_request,
                        category
                    };

                    const subject = `[New Request] ${request_item}: ${title}`;
                    const html = renderEmail({
                        stage: 'New Request',
                        decision: 'submitted',
                        request: requestData,
                        extra: { comment: 'มีการสร้างคำขอใหม่ในระบบ General DWG Request' },
                        actionBy: requester,
                    });

                    logger.info('Sending new request email notification', { recipients, subject });
                    sendEmailWithFallback(recipients.join(','), subject, html).catch((err) => {
                        logger.error('New request email sending failed', { error: err.message });
                    });
                }
            } catch (emailErr) {
                logger.warn('Initial email notification failed', { error: emailErr.message });
            }

            res.json({ result: 'true', message: 'บันทึกคำขอเรียบร้อยแล้ว', id: requestId });
        } catch (dbErr) {
            logger.error('Database Insert Error', { error: dbErr.message });
            res.status(500).json({ result: 'false', message: dbErr.message });
        }
    } catch (error) {
        logger.error('Server Error', { error: error.message });
        res.status(500).json({ result: 'false', message: 'Server Error' });
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
        request_no
    } = req.body;

    const sql = `
        UPDATE ${TABLES.TR_REQUEST} SET
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
            return res.status(404).json({ result: 'false', message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
        }
        res.json({ result: 'true', message: 'อัพเดทข้อมูลเรียบร้อยแล้ว', changes: result.rowCount });
    } catch (err) {
        console.error('Error updating tool request:', err.message);
        return res.status(500).json({ result: 'false', message: err.message });
    }
};

/**
 * DELETE /api/engineer/mtc/tool-requests/:id
 */
const deleteToolRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(
            `UPDATE ${TABLES.TR_REQUEST} SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ result: 'false', message: 'ไม่พบข้อมูลที่ต้องการลบ' });
        }
        res.json({ result: 'true', message: 'ลบข้อมูลเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error deleting tool request:', err.message);
        return res.status(500).json({ result: 'false', message: err.message });
    }
};

/**
 * GET /api/engineer/mtc/tool-requests/dashboard
 */
const getToolRequestDashboard = async (req, res) => {
    const stats = {};
    try {
        const statusCountsRes = await engPool.query(`
            SELECT status, COUNT(*) as count FROM ${TABLES.TR_REQUEST}
            WHERE deleted_at IS NULL GROUP BY status
        `);
        stats.byStatus = statusCountsRes.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});

        const totalRes = await engPool.query(`SELECT COUNT(*) as total FROM ${TABLES.TR_REQUEST} WHERE deleted_at IS NULL`);
        stats.total = parseInt(totalRes.rows[0].total);

        const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');
        const recentRes = await engPool.query(`SELECT COUNT(*) as recent FROM ${TABLES.TR_REQUEST} WHERE deleted_at IS NULL AND DATE(created_at) >= $1`, [thirtyDaysAgo]);
        stats.last30Days = parseInt(recentRes.rows[0].recent);

        const today = moment().format('YYYY-MM-DD');
        const overdueRes = await engPool.query(`
             SELECT COUNT(*) as overdue FROM ${TABLES.TR_REQUEST}
             WHERE deleted_at IS NULL
             AND status NOT IN ('Completed & Informed', 'Denied', 'Denied by Approve')
             AND DATE(req_due_date) < $1
        `, [today]);
        stats.overdue = parseInt(overdueRes.rows[0].overdue);

        const performanceRes = await engPool.query(`
            SELECT completion_status, COUNT(*) as count FROM ${TABLES.TR_REQUEST}
            WHERE deleted_at IS NULL AND completion_status IN ('On time', 'Delay')
            GROUP BY completion_status
        `);
        stats.performance = performanceRes.rows.reduce((acc, row) => {
            acc[row.completion_status] = parseInt(row.count);
            return acc;
        }, { 'On time': 0, 'Delay': 0 });

        res.json({ data: stats });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ── Performance calculation helper ──────────────────────────────────────────
async function calculateRequestPerformance(dueDateVal, actualDateVal) {
    if (!dueDateVal || !actualDateVal) {
        return { diff: 0, status: 'Pending' };
    }
    try {
        const plan = moment(dueDateVal).startOf('day');
        const actual = moment(actualDateVal).startOf('day');
        const holidayQuery = await engPool.query(`SELECT holiday_date FROM ${TABLES.HOLIDAYS}`);
        const holidays = holidayQuery.rows.map(row => moment(row.holiday_date).format('YYYY-MM-DD'));

        let diffDays = 0;
        let status = 'On time';
        if (actual.isSameOrBefore(plan)) {
            status = 'On time';
            diffDays = 0; 
        } else {
            status = 'Delay';
            let current = plan.clone().add(1, 'days');
            while (current.isSameOrBefore(actual)) {
                const isWeekend = current.day() === 0 || current.day() === 6;
                const isHoliday = holidays.includes(current.format('YYYY-MM-DD'));
                if (!isWeekend && !isHoliday) diffDays++;
                current.add(1, 'days');
            }
        }
        return { diff: diffDays, status: status };
    } catch (error) {
        console.error('Error calculating request performance:', error.message);
        return { diff: 0, status: 'On time' };
    }
}

/**
 * POST /api/engineer/mtc/tool-requests/:id/action
 */
const submitAction = async (req, res) => {
    const { id } = req.params;
    const { stage, decision, comment, action_by } = req.body;
    let extra = req.body.extra;
    if (typeof extra === 'string') {
        try { extra = JSON.parse(extra); } catch { extra = {}; }
    }
    extra = extra || {};

    const uploadDir = path.join(__dirname, '../../../files/tool_requests');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
    };

    await saveFiles('dwg_files', 'dwg_file_paths', 'dwg_file_names');
    await saveFiles('review_files', 'review_file_paths', 'review_file_names');

    if (!stage || !decision) return res.status(400).json({ error: 'stage and decision are required' });

    // ── ตรวจสิทธิ์ ──
    try {
        const recipientsAllowed = await getEmailRecipients(stage);
        const userDept = (req.body.user_department || '').toUpperCase();
        if (recipientsAllowed.length > 0 && userDept !== 'AD') {
            const allowedCodes = recipientsAllowed.map(e => e.split('@')[0].toLowerCase());
            const userCode = (req.body.user_code || '').toLowerCase();
            const userEmailVal = (req.body.action_by_email || '').toLowerCase();
            const isAllowed = allowedCodes.includes(userCode) || 
                              recipientsAllowed.map(e => e.toLowerCase()).includes(userEmailVal);
            if (!isAllowed) return res.status(403).json({ error: `คุณไม่มีสิทธิ์ดำเนินการในขั้นตอน ${stage}` });
        }
    } catch (err) {
        logger.warn('Permission check failed', { error: err.message });
    }

    const stageConfig = STAGE_MAP[stage];
    if (!stageConfig) return res.status(400).json({ error: `Unknown stage: ${stage}` });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const reqRes = await client.query(`SELECT * FROM ${TABLES.TR_REQUEST} WHERE id = $1 AND deleted_at IS NULL`, [id]);
        const request = reqRes.rows[0];
        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found' });
        }

        const isApprove = decision === 'approve' || decision === 'submit';
        const nextStatus = isApprove ? stageConfig.approveStatus : stageConfig.denyStatus;
        const nextStage = isApprove ? stageConfig.approveStage : stageConfig.denyStage;

        if (!nextStatus) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Stage "${stage}" does not support decision "${decision}"` });
        }

        let completionStatus = request.completion_status || 'Pending';
        let diffDays = request.diff_days || null;
        if (stage === WORKFLOW_STAGES.ENG_INFORM && isApprove) {
            const perf = await calculateRequestPerformance(request.req_due_date, moment());
            completionStatus = perf.status;
            diffDays = perf.diff;
        }

        await client.query(
            `UPDATE ${TABLES.TR_REQUEST} SET status = $1, current_stage = $2, req_no = COALESCE($3, req_no), 
             completion_status = $4, diff_days = $5, updated_at = NOW() WHERE id = $6`,
            [nextStatus, nextStage, (stage === WORKFLOW_STAGES.ENG_CHECK && isApprove && extra?.request_no) ? extra.request_no : null,
             completionStatus, diffDays, id]
        );

        await client.query(
            `INSERT INTO ${TABLES.TR_WORKFLOW} (req_id, step_no, action_by, action_type, comment, status, stage_name, extra_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, stageConfig.stepNo, action_by || 'system', decision, comment || '', nextStatus, stage, JSON.stringify(extra || {})]
        );

        await client.query('COMMIT');

        // Send Email notification (Dynamic)
        try {
            const emailKey = isApprove ? stageConfig.emailApprove : stageConfig.emailDeny;
            let recipients = emailKey ? await getEmailRecipients(emailKey) : [];
            if (!isApprove && request.requester_email) recipients = [request.requester_email, ...recipients];
            if (stage === WORKFLOW_STAGES.ENG_INFORM && request.requester_email) recipients = [request.requester_email, ...recipients];

            if (recipients.length > 0) {
                const subject = generateSubject(stage, decision, request);
                const html = renderEmail({ stage, decision, request, extra: { ...extra, comment }, actionBy: action_by || 'System' });
                sendEmailWithFallback(recipients.join(','), subject, html).catch(err => logger.error('Email failed', { error: err.message }));
            }
        } catch (emailErr) {
            logger.warn('Email failed', { error: emailErr.message });
        }

        res.json({ success: true, status: nextStatus, current_stage: nextStage });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * GET /api/engineer/mtc/email-config
 * Fetch all email configurations for admin management
 */
const getEmailConfigs = async (req, res) => {
    try {
        const result = await engPool.query(`SELECT * FROM ${TABLES.TR_EMAIL_CONFIG} ORDER BY stage ASC`);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * PUT /api/engineer/mtc/email-config/:id
 * Update an existing email configuration
 */
const updateEmailConfig = async (req, res) => {
    const { id } = req.params;
    const { emails, stage } = req.body;
    try {
        await engPool.query(
            `UPDATE ${TABLES.TR_EMAIL_CONFIG} SET emails = $1, stage = $2 WHERE id = $3`,
            [emails, stage, id]
        );
        res.json({ success: true, message: 'Updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/engineer/mtc/email-config
 * Create a new email configuration (e.g., for new CC stages)
 */
const createEmailConfig = async (req, res) => {
    const { stage, emails } = req.body;
    try {
        await engPool.query(
            `INSERT INTO ${TABLES.TR_EMAIL_CONFIG} (stage, emails) VALUES ($1, $2)`,
            [stage, emails]
        );
        res.json({ success: true, message: 'Created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * DELETE /api/engineer/mtc/email-config/:id
 */
const deleteEmailConfig = async (req, res) => {
    const { id } = req.params;
    try {
        await engPool.query(`DELETE FROM ${TABLES.TR_EMAIL_CONFIG} WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getToolRequests,
    getToolRequestById,
    createToolRequest,
    updateToolRequest,
    deleteToolRequest,
    getToolRequestDashboard,
    getStagePermissions,
    submitAction,
    getEmailConfigs,
    updateEmailConfig,
    createEmailConfig,
    deleteEmailConfig,
};
