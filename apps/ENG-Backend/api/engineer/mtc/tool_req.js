const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');
const { sendEmailWithFallback } = require('../../system/emailService');

// ── Email recipient config (mirrors AppsScript defaults) ─────────────────────
const EMAIL_CONFIG = {
  ENG_CHECK:  ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com', 'PATTANAPONG.PROMYAI@minebea.com'],
  DRAFTMAN:   ['SURANAT.NAKA@minebea.com'],
  DWG_CHECK:  ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
  ENG_REVIEW: ['TEERAPOL.KANTAPOOM@minebea.com'],
  ENG_APPROVE:['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
  ENG_INFORM: ['CHAIRAT.SRIPRATUENG@minebea.com', 'APISIT.SUWANNAKATE@minebea.com'],
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
        const workflowRes = await engPool.query('SELECT * FROM tr_workflow WHERE req_id = $1 ORDER BY COALESCE(created_at, action_date) ASC', [id]);

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

        // Calculate due date based on request type
        const req_due_date = calcDueDate(type_of_request);

        const sql = `
            INSERT INTO tr_request (
                request_item, department, work_center, work_center_name,
                requester, requester_email, type_of_request, category,
                drawing_required, type_of_drawing, title, detail,
                machine_no, machine_name, req_due_date, req_no,
                status, current_stage
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id
        `;

        const params = [
            request_item, department, work_center, work_center_name,
            requester, requester_email, type_of_request, category,
            drawing_required, type_of_drawing, title, detail,
            machine_no, machine_name, req_due_date, request_item,
            'Pending Eng Check', 'Eng Check'
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

/**
 * POST /api/engineer/mtc/tool-requests/:id/action
 * Submit a workflow stage action (approve/deny/submit)
 */
const submitAction = async (req, res) => {
    const { id } = req.params;
    const { stage, decision, comment, extra, action_by } = req.body;

    if (!stage || !decision) {
        return res.status(400).json({ error: 'stage and decision are required' });
    }

    const stageConfig = STAGE_MAP[stage];
    if (!stageConfig) {
        return res.status(400).json({ error: `Unknown stage: ${stage}` });
    }

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Get current request
        const reqRes = await client.query('SELECT * FROM tr_request WHERE id = $1', [id]);
        const request = reqRes.rows[0];
        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found' });
        }

        const isApprove = decision === 'approve' || decision === 'submit';
        const nextStatus = isApprove ? stageConfig.approveStatus : stageConfig.denyStatus;
        const nextStage  = isApprove ? stageConfig.approveStage  : stageConfig.denyStage;

        if (!nextStatus) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Stage "${stage}" does not support decision "${decision}"` });
        }

        // Update request status + stage
        const newReqNo = (stage === 'eng_check' && isApprove && extra?.request_no)
            ? extra.request_no : null;

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
        await client.query(
            `INSERT INTO tr_workflow (req_id, step_no, action_by, action_type, comment, status, stage_name, extra_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, stageConfig.stepNo, action_by || 'system', decision,
             comment || '', nextStatus, stage, JSON.stringify(extra || {})]
        );

        await client.query('COMMIT');

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
    submitAction,
};
