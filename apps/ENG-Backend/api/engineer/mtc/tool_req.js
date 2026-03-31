const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');
const { sendEmailWithFallback } = require('../../system/emailService');

// ── Email recipient config — อ่านจาก environment variables ──────────────────
const splitEmails = (key) =>
  (process.env[key] || '').split(',').map(e => e.trim()).filter(Boolean);

const EMAIL_CONFIG = {
  ENG_CHECK:  splitEmails('EMAIL_MTC_ENG_CHECK'),
  DRAFTMAN:   splitEmails('EMAIL_MTC_DRAFTMAN'),
  DWG_CHECK:  splitEmails('EMAIL_MTC_DWG_CHECK'),
  ENG_REVIEW: splitEmails('EMAIL_MTC_ENG_REVIEW'),
  ENG_APPROVE:splitEmails('EMAIL_MTC_ENG_APPROVE'),
  ENG_INFORM: splitEmails('EMAIL_MTC_ENG_INFORM'),
};

// ── Due date by request type ──────────────────────────────────────────────────
const DUE_DAYS = { 'Regist Drawing': 5, 'Draft Drawing': 7, '3D Print': 10 };

function calcDueDate(typeOfRequest) {
  const days = DUE_DAYS[typeOfRequest] || 7;
  let due = moment();
  let added = 0;
  while (added < days) {
    due.add(1, 'days');
    if (due.day() !== 0 && due.day() !== 6) added++;
  }
  return due.format('YYYY-MM-DD HH:mm:ss');
}

// ── Stage → allowed emails (ใช้ EMAIL_CONFIG เดิม) ───────────────────────────
const STAGE_ALLOWED = {
  eng_check:   EMAIL_CONFIG.ENG_CHECK,
  draft_man:   EMAIL_CONFIG.DRAFTMAN,
  dwg_check:   EMAIL_CONFIG.DWG_CHECK,
  eng_review:  EMAIL_CONFIG.ENG_REVIEW,
  eng_approve: EMAIL_CONFIG.ENG_APPROVE,
  eng_inform:  EMAIL_CONFIG.ENG_INFORM,
};

/**
 * GET /api/engineer/mtc/tool-requests/permissions
 * คืน allowed emails ของแต่ละ stage
 */
const getStagePermissions = (req, res) => {
  res.json({ data: STAGE_ALLOWED });
};

// ── Workflow stage map ────────────────────────────────────────────────────────
const STAGE_MAP = {
  eng_check:  { stepNo: 1, approveStatus: 'Pending Draft Man',   approveStage: 'Draft Man',   denyStatus: 'Denied',             denyStage: 'Denied',   emailApprove: 'DRAFTMAN',    emailDeny: null },
  draft_man:  { stepNo: 2, approveStatus: 'Pending DWG Check',   approveStage: 'DWG Check',                                                             emailApprove: 'DWG_CHECK' },
  dwg_check:  { stepNo: 3, approveStatus: 'Pending Eng Review',  approveStage: 'Eng Review',  denyStatus: 'Pending Draft Man',  denyStage: 'Draft Man',  emailApprove: 'ENG_REVIEW',  emailDeny: 'DRAFTMAN' },
  eng_review: { stepNo: 4, approveStatus: 'Pending Eng Approve', approveStage: 'Eng Approve',                                                            emailApprove: 'ENG_APPROVE' },
  eng_approve:{ stepNo: 5, approveStatus: 'Pending Eng Inform',  approveStage: 'Eng Inform',  denyStatus: 'Denied by Approve',  denyStage: 'Denied',    emailApprove: 'ENG_INFORM',  emailDeny: null },
  eng_inform: { stepNo: 6, approveStatus: 'Completed & Informed',approveStage: 'Completed',                                                              emailApprove: null },
};

function buildEmailHtml(stage, decision, req, extra, actionBy) {
  const stageLabels = {
    eng_check: 'Eng Check', draft_man: 'Draft Man', dwg_check: 'DWG Check',
    eng_review: 'Eng Review', eng_approve: 'Eng Approve', eng_inform: 'Eng Inform',
  };
  const stageLabel = stageLabels[stage] || stage;
  const isApprove = decision === 'approve' || decision === 'submit';
  const color = isApprove ? '#4CAF50' : '#F44336';
  const title = isApprove
    ? `[${stageLabel} ✅] ${req.request_item} — ${req.title}`
    : `[${stageLabel} ❌ Denied] ${req.request_item} — ${req.title}`;

  let extraHtml = '';
  if (stage === 'eng_check' && extra?.request_no)
    extraHtml = `<p><strong>Request No. Assigned:</strong> ${extra.request_no}</p>`;
  if (stage === 'draft_man' && extra?.dwg_files)
    extraHtml = `<p><strong>Drawing Files:</strong> ${extra.dwg_files}</p>`;
  if (stage === 'eng_review')
    extraHtml = `<p><strong>Drawing No:</strong> ${extra?.drawing_no || '-'}</p><p><strong>No. of Dwg:</strong> ${extra?.no_of_dwg || '-'}</p>`;
  if (stage === 'eng_inform' && extra?.attached_file_paths?.length > 0) {
    const baseUrl = process.env.SERVER_URL || 'http://plbmp129:2005';
    const links = extra.attached_file_paths.map((p, i) =>
      `<a href="${baseUrl}${p}">${extra.attached_file_names?.[i] || p.split('/').pop()}</a>`
    ).join('<br>');
    extraHtml = `<p><strong>ไฟล์แนบ Drawing:</strong><br>${links}</p>`;
  }

  return `
    <div style="border-left:5px solid ${color};padding:16px;background:#f9f9f9;margin-bottom:16px;">
      <h2 style="color:${color};margin:0 0 8px">${title}</h2>
    </div>
    <p><strong>Request Item:</strong> ${req.request_item}</p>
    <p><strong>Requester:</strong> ${req.requester}</p>
    <p><strong>Department:</strong> ${req.department}</p>
    <p><strong>Type:</strong> ${req.type_of_request}</p>
    <p><strong>Title:</strong> ${req.title}</p>
    ${extraHtml}
    ${extra?.comment ? `<p><strong>Comment:</strong> ${extra.comment}</p>` : ''}
    <p><strong>Action by:</strong> ${actionBy}</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0">
    <p style="color:#888;font-size:12px">Tool Drawing Request System — ENG</p>
  `;
}

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
        const requestRes = await engPool.query('SELECT * FROM tr_request WHERE id = $1 AND deleted_at IS NULL', [id]);
        const request = requestRes.rows[0];

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Then get workflow history
        // Use created_at for ordering as it is the standard in the new migration
        const workflowRes = await engPool.query('SELECT * FROM tr_workflow WHERE req_id = $1 ORDER BY created_at ASC', [id]);

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

        // Handle File Upload
        let file_path = null;
        if (req.files && req.files.attachment) {
            const file = req.files.attachment;
            const fileName = `${Date.now()}_${file.name}`;
            const path = require('path');
            const uploadPath = path.join(__dirname, '../../../files/tool_requests', fileName);
            
            // Move file to directory
            await file.mv(uploadPath);
            file_path = `/tool_requests/${fileName}`;
        }

        // Generate request_item: ITEM-YYYYMMDD-XXX
        const now = moment();
        const dateStr = now.format('YYYYMMDD');

        const countRes = await engPool.query(`SELECT COUNT(*) as count FROM tr_request WHERE request_item LIKE $1`, [`ITEM-${dateStr}-%`]);
        const count = parseInt(countRes.rows[0].count);
        const seq = String((count || 0) + 1).padStart(3, '0');
        const request_item = `ITEM-${dateStr}-${seq}`;

        const req_due_date = calcDueDate(type_of_request);

        const sql = `
            INSERT INTO tr_request (
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
            'Pending Eng Check', 'Eng Check', file_path
        ];

        try {
            const insertRes = await engPool.query(sql, params);
            res.json({ result: 'true', message: 'บันทึกคำขอเรียบร้อยแล้ว', id: insertRes.rows[0].id });
        } catch (dbErr) {
            console.error('❌ Database Insert Error:', dbErr.message);
            res.status(500).json({ result: 'false', message: dbErr.message });
        }
    } catch (error) {
        console.error('Server Error:', error);
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
 * Soft-delete tool request (ตั้ง deleted_at แทนการลบจริง เพื่อรักษา audit trail)
 */
const deleteToolRequest = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await engPool.query(
            `UPDATE tr_request SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                result: 'false',
                message: 'ไม่พบข้อมูลที่ต้องการลบ'
            });
        }

        res.json({
            result: 'true',
            message: 'ลบข้อมูลเรียบร้อยแล้ว'
        });
    } catch (err) {
        console.error('Error deleting tool request:', err.message);
        return res.status(500).json({
            result: 'false',
            message: err.message
        });
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
            WHERE deleted_at IS NULL
            GROUP BY status
        `);

        stats.byStatus = statusCountsRes.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
        }, {});

        // Get total count
        const totalRes = await engPool.query('SELECT COUNT(*) as total FROM tr_request WHERE deleted_at IS NULL');
        stats.total = parseInt(totalRes.rows[0].total);

        // Get requests created in last 30 days
        const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');
        const recentRes = await engPool.query('SELECT COUNT(*) as recent FROM tr_request WHERE deleted_at IS NULL AND DATE(created_at) >= $1', [thirtyDaysAgo]);
        stats.last30Days = parseInt(recentRes.rows[0].recent);

        // Get overdue count
        const today = moment().format('YYYY-MM-DD');
        const overdueRes = await engPool.query(`
             SELECT COUNT(*) as overdue FROM tr_request
             WHERE deleted_at IS NULL
             AND status NOT IN ('Completed & Informed', 'Denied', 'Denied by Approve')
             AND DATE(req_due_date) < $1
        `, [today]);
        stats.overdue = parseInt(overdueRes.rows[0].overdue);

        res.json({ data: stats });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

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
    const path = require('path');
    const uploadDir = path.join(__dirname, '../../../files/tool_requests');

    const saveFiles = async (fieldName, pathKey, nameKey) => {
        if (!req.files?.[fieldName]) return;
        const fileList = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
        const savedPaths = [], savedNames = [];
        for (const file of fileList) {
            const fileName = `${id}_${Date.now()}_${file.name}`;
            await file.mv(path.join(uploadDir, fileName));
            savedPaths.push(`/tool_requests/${fileName}`);
            savedNames.push(file.name);
        }
        extra[pathKey] = savedPaths;
        extra[nameKey] = savedNames;
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
        console.log(`🚀 Starting action submit for Request ID: ${id}, Stage: ${stage}, Decision: ${decision}`);

        // Get current request
        const reqRes = await client.query('SELECT * FROM tr_request WHERE id = $1 AND deleted_at IS NULL', [id]);
        const request = reqRes.rows[0];
        if (!request) {
            console.error(`❌ Request ID ${id} not found`);
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found' });
        }

        const isApprove = decision === 'approve' || decision === 'submit';
        const nextStatus = isApprove ? stageConfig.approveStatus : stageConfig.denyStatus;
        const nextStage  = isApprove ? stageConfig.approveStage  : stageConfig.denyStage;

        if (!nextStatus) {
            console.error(`❌ Stage "${stage}" does not support decision "${decision}"`);
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Stage "${stage}" does not support decision "${decision}"` });
        }

        // Update request status + stage
        const newReqNo = (stage === 'eng_check' && isApprove && extra?.request_no)
            ? extra.request_no : null;

        console.log(`📝 Updating tr_request: Status -> ${nextStatus}, Stage -> ${nextStage}, ReqNo -> ${newReqNo}`);
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
        console.log(`📝 Inserting tr_workflow record for step ${stageConfig.stepNo}`);
        await client.query(
            `INSERT INTO tr_workflow (req_id, step_no, action_by, action_type, comment, status, stage_name, extra_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, stageConfig.stepNo, action_by || 'system', decision,
             comment || '', nextStatus, stage, JSON.stringify(extra || {})]
        );

        await client.query('COMMIT');
        console.log(`✅ Action submitted and committed successfully`);

        // Send email (fire-and-forget — don't block response)
        try {
            const emailKey = isApprove ? stageConfig.emailApprove : stageConfig.emailDeny;
            let recipients = emailKey ? EMAIL_CONFIG[emailKey] : [];

            // For deny, also CC the requester
            if (!isApprove && request.requester_email) {
                recipients = [request.requester_email, ...recipients];
            }
            // For eng_inform completed, notify requester
            if (stage === 'eng_inform' && request.requester_email) {
                recipients = [request.requester_email, ...recipients];
            }

            if (recipients.length > 0) {
                const subject = `[Tool Request] ${isApprove ? '✅' : '❌'} ${nextStatus} — ${request.request_item}`;
                const html = buildEmailHtml(stage, decision, request, { ...extra, comment }, action_by);
                sendEmailWithFallback(recipients.join(','), subject, html).catch(() => {});
            }
        } catch (_) { /* email failure should not affect response */ }

        res.json({
            success: true,
            request_item: request.request_item,
            status: nextStatus,
            current_stage: nextStage,
            message: `${stage} ${decision} submitted successfully`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error submitting action:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
};
