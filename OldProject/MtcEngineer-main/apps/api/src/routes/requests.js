const express = require('express');
const { pool } = require('../db/pool');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, optionalAuth, isAuthorizedUser } = require('../middleware/auth');
const { generateRequestItem } = require('../utils/requestNumber');
const { calculateDueDate } = require('../utils/workingDays');
const { sendNewRequestEmail } = require('../services/emailService');

const router = express.Router();

/**
 * GET /api/requests
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    status,
    currentStage,
    department,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`r.status = $${paramIdx++}`);
    params.push(status);
  }
  if (currentStage) {
    conditions.push(`r."currentStage" = $${paramIdx++}`);
    params.push(currentStage);
  }
  if (department) {
    conditions.push(`r.department = $${paramIdx++}`);
    params.push(department);
  }
  if (search) {
    conditions.push(`(r."requestItem" ILIKE $${paramIdx} OR r."requestNo" ILIKE $${paramIdx} OR r.title ILIKE $${paramIdx} OR r.requester ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Validate sortBy to prevent SQL injection
  const allowedSortColumns = ['createdAt', 'requestItem', 'status', 'requester', 'title'];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? `"${sortBy}"` : '"createdAt"';
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [requestsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT r.*, ec.status as "engCheckStatus", er."drawingNo" as "engReviewDrawingNo"
       FROM requests r
       LEFT JOIN eng_check ec ON ec."requestId" = r.id
       LEFT JOIN eng_review er ON er."requestId" = r.id
       ${whereClause}
       ORDER BY r.${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM requests r ${whereClause}`,
      params
    )
  ]);

  const total = parseInt(countResult.rows[0].count);

  res.json({
    success: true,
    data: requestsResult.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/requests/dashboard
 */
router.get('/dashboard', optionalAuth, asyncHandler(async (req, res) => {
  const today = new Date();

  const [totalR, pendingR, completedR, deniedR, overdueR, recentR, byTypeR, byDeptR, trackingR, onTimeR] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM requests'),
    pool.query("SELECT COUNT(*) FROM requests WHERE status LIKE '%Pending%'"),
    pool.query("SELECT COUNT(*) FROM requests WHERE status IN ('Completed', 'Completed & Informed')"),
    pool.query("SELECT COUNT(*) FROM requests WHERE status = 'Denied'"),
    pool.query("SELECT COUNT(*) FROM requests WHERE status LIKE '%Pending%' AND \"reqDueDate\" < $1", [today]),
    pool.query(`SELECT id, "requestItem", "requestNo", status, "currentStage", requester, "typeOfRequest", title, "reqDueDate", "createdAt"
                FROM requests ORDER BY "createdAt" DESC`),
    pool.query('SELECT "typeOfRequest", COUNT(id) as count FROM requests GROUP BY "typeOfRequest"'),
    pool.query('SELECT department, COUNT(id) as count FROM requests GROUP BY department'),
    pool.query("SELECT AVG(\"totalDays\") as avg_days, COUNT(id) as count FROM tracking WHERE status = 'Completed'"),
    pool.query("SELECT COUNT(*) FROM tracking WHERE status = 'Completed' AND \"onTime\" = true")
  ]);

  const total = parseInt(totalR.rows[0].count);
  const pending = parseInt(pendingR.rows[0].count);
  const completed = parseInt(completedR.rows[0].count);
  const denied = parseInt(deniedR.rows[0].count);
  const overdue = parseInt(overdueR.rows[0].count);

  const completedCount = parseInt(trackingR.rows[0].count) || 0;
  const onTimeCount = parseInt(onTimeR.rows[0].count) || 0;
  const onTimePercent = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0;

  const statistics = {
    byType: byTypeR.rows.map(t => ({ type: t.typeOfRequest, count: parseInt(t.count) })),
    byDepartment: byDeptR.rows.map(d => ({ department: d.department, count: parseInt(d.count) })),
    avgDuration: Math.round(parseFloat(trackingR.rows[0].avg_days) || 0),
    onTimePercent,
    onTimeCount,
    completedTracked: completedCount
  };

  res.json({
    success: true,
    summary: { total, pending, completed, denied, overdue },
    statistics,
    recentRequests: recentR.rows
  });
}));

/**
 * GET /api/requests/export
 */
router.get('/export', authenticate, asyncHandler(async (req, res) => {
  const { rows: requests } = await pool.query(`
    SELECT r.*,
      ec.status as "ecStatus", ec."checkerName" as "ecChecker", ec."createdAt" as "ecDate",
      dm."draftmanName" as "dmName", dm."createdAt" as "dmDate",
      dc.status as "dcStatus", dc."checkerName" as "dcChecker", dc."createdAt" as "dcDate",
      er."drawingNo" as "erDrawingNo", er."noOfDwg" as "erNoOfDwg", er.section as "erSection", er."reviewerName" as "erReviewer", er."createdAt" as "erDate",
      ea.judgement as "eaJudgement", ea."approverName" as "eaApprover", ea."createdAt" as "eaDate",
      ei.cost as "eiCost", ei.evidence as "eiEvidence", ei."sentAt" as "eiSentAt",
      t."engCheckDays", t."draftManDays", t."dwgCheckDays", t."engReviewDays", t."engApproveDays", t."totalDays", t."onTime"
    FROM requests r
    LEFT JOIN eng_check ec ON ec."requestId" = r.id
    LEFT JOIN draft_man dm ON dm."requestId" = r.id
    LEFT JOIN dwg_check dc ON dc."requestId" = r.id
    LEFT JOIN eng_review er ON er."requestId" = r.id
    LEFT JOIN eng_approve ea ON ea."requestId" = r.id
    LEFT JOIN eng_inform ei ON ei."requestId" = r.id
    LEFT JOIN tracking t ON t."requestId" = r.id
    ORDER BY r."createdAt" DESC
  `);

  const headers = [
    'Request Item', 'Request No', 'Status', 'Current Stage',
    'Department', 'Requester', 'Type', 'Category', 'Title',
    'Machine No', 'Machine Name', 'Due Date', 'Created At',
    'Eng Check Status', 'Eng Check By', 'Draft Man By',
    'DWG Check Status', 'DWG Check By', 'Drawing No', 'No of DWG',
    'Section', 'Eng Review By', 'Eng Approve Judgement', 'Eng Approve By',
    'Cost', 'Evidence', 'Informed At',
    'Eng Check Days', 'Draft Man Days', 'DWG Check Days',
    'Eng Review Days', 'Eng Approve Days', 'Total Days', 'On Time'
  ];

  const escCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

  const rows = requests.map(r => [
    r.requestItem, r.requestNo || '', r.status, r.currentStage,
    r.department, r.requester, r.typeOfRequest, r.category, r.title,
    r.machineNo || '', r.machineName || '', formatDate(r.reqDueDate), formatDate(r.createdAt),
    r.ecStatus || '', r.ecChecker || '', r.dmName || '',
    r.dcStatus || '', r.dcChecker || '', r.erDrawingNo || '',
    r.erNoOfDwg || '', r.erSection || '', r.erReviewer || '',
    r.eaJudgement || '', r.eaApprover || '',
    r.eiCost || '', r.eiEvidence || '', formatDate(r.eiSentAt),
    r.engCheckDays ?? '', r.draftManDays ?? '', r.dwgCheckDays ?? '',
    r.engReviewDays ?? '', r.engApproveDays ?? '', r.totalDays ?? '',
    r.onTime === true ? 'Yes' : r.onTime === false ? 'No' : ''
  ]);

  const csv = [headers.join(','), ...rows.map(row => row.map(escCsv).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="requests_export_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send('\ufeff' + csv);
}));

/**
 * GET /api/requests/:id
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const isNumeric = !isNaN(id);
  const { rows } = await pool.query(
    isNumeric
      ? 'SELECT * FROM requests WHERE id = $1'
      : 'SELECT * FROM requests WHERE "requestItem" = $1',
    [isNumeric ? parseInt(id) : id]
  );

  const request = rows[0];
  if (!request) {
    throw new AppError('Request not found', 404);
  }

  // Fetch related data
  const [ecR, dmR, dcR, erR, eaR, eiR, trR] = await Promise.all([
    pool.query('SELECT * FROM eng_check WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM draft_man WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM dwg_check WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM eng_review WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM eng_approve WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM eng_inform WHERE "requestId" = $1', [request.id]),
    pool.query('SELECT * FROM tracking WHERE "requestId" = $1', [request.id])
  ]);

  request.engCheck = ecR.rows[0] || null;
  request.draftMan = dmR.rows[0] || null;
  request.dwgCheck = dcR.rows[0] || null;
  request.engReview = erR.rows[0] || null;
  request.engApprove = eaR.rows[0] || null;
  request.engInform = eiR.rows[0] || null;
  request.tracking = trR.rows[0] || null;

  const canViewAllFlows = await isAuthorizedUser(req.user);

  if (!canViewAllFlows) {
    delete request.engCheck;
    delete request.draftMan;
    delete request.dwgCheck;
    delete request.engReview;
    delete request.engInform;
    delete request.tracking;
    if (request.engApprove) {
      request.engApprove = { judgement: request.engApprove.judgement };
    }
  }

  res.json({
    success: true,
    data: request,
    canViewAllFlows
  });
}));

/**
 * POST /api/requests
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const {
    department, workCenter, workCenterName, typeOfRequest, category,
    drawingRequired, typeOfDrawing, title, detail, machineNo, machineName, attachments
  } = req.body;

  if (!department || !workCenter || !typeOfRequest || !category || !title || !detail || !machineNo || !machineName) {
    throw new AppError('Missing required fields', 400);
  }

  const requestItem = await generateRequestItem();
  const dueDate = await calculateDueDate(typeOfRequest);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      `INSERT INTO requests ("requestItem", department, "workCenter", "workCenterName", requester, "requesterEmail",
        "typeOfRequest", category, "drawingRequired", "typeOfDrawing", title, detail, "machineNo", "machineName",
        attachments, "reqDueDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [requestItem, department, workCenter, workCenterName, req.user.name, req.user.email,
        typeOfRequest, category, drawingRequired, typeOfDrawing, title, detail, machineNo, machineName,
        attachments, dueDate]
    );

    const request = reqRows[0];

    await client.query(
      'INSERT INTO tracking ("requestId") VALUES ($1)',
      [request.id]
    );

    await client.query('COMMIT');

    // Send email notification
    try {
      await sendNewRequestEmail(request);
    } catch (error) {
      console.error('Failed to send email:', error);
    }

    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      data: request
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * PUT /api/requests/:id
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows: existing } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(id)]);
  const existingRequest = existing[0];

  if (!existingRequest) {
    throw new AppError('Request not found', 404);
  }

  if (existingRequest.currentStage !== 'Eng Check') {
    throw new AppError('Cannot edit request after Eng Check stage', 400);
  }

  const {
    department, workCenter, workCenterName, typeOfRequest, category,
    drawingRequired, typeOfDrawing, title, detail, machineNo, machineName, attachments
  } = req.body;

  let reqDueDate = existingRequest.reqDueDate;
  if (typeOfRequest && typeOfRequest !== existingRequest.typeOfRequest) {
    reqDueDate = await calculateDueDate(typeOfRequest, existingRequest.createdAt);
  }

  const { rows } = await pool.query(
    `UPDATE requests SET department=$1, "workCenter"=$2, "workCenterName"=$3, "typeOfRequest"=$4,
     category=$5, "drawingRequired"=$6, "typeOfDrawing"=$7, title=$8, detail=$9,
     "machineNo"=$10, "machineName"=$11, attachments=$12, "reqDueDate"=$13
     WHERE id=$14 RETURNING *`,
    [department, workCenter, workCenterName, typeOfRequest, category,
     drawingRequired, typeOfDrawing, title, detail, machineNo, machineName, attachments, reqDueDate,
     parseInt(id)]
  );

  res.json({
    success: true,
    message: 'Request updated successfully',
    data: rows[0]
  });
}));

/**
 * DELETE /api/requests/:id
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(id)]);
  const request = rows[0];

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  const isAdminUser = req.user.role === 'admin';
  const isOwner = request.requesterEmail === req.user.email;
  const isFirstStage = request.currentStage === 'Eng Check';

  if (!isAdminUser && !isOwner) {
    throw new AppError('Not authorized to delete this request', 403);
  }

  if (!isAdminUser && !isFirstStage) {
    throw new AppError('Cannot delete request after Eng Check stage', 400);
  }

  if (!isDevelopment && !isFirstStage && !isAdminUser) {
    throw new AppError('Cannot delete processed requests in production', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tracking WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM eng_check WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM draft_man WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM dwg_check WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM eng_review WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM eng_approve WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM eng_inform WHERE "requestId" = $1', [parseInt(id)]);
    await client.query('DELETE FROM requests WHERE id = $1', [parseInt(id)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  res.json({
    success: true,
    message: 'Request deleted successfully'
  });
}));

module.exports = router;
