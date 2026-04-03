const express = require('express');
const { pool } = require('../db/pool');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorizeStage } = require('../middleware/auth');
const { generateRequestNo } = require('../utils/requestNumber');
const { calculateWorkingDays } = require('../utils/workingDays');
const { sendWorkflowEmail } = require('../services/emailService');

const router = express.Router();

/**
 * POST /api/workflow/eng-check
 */
router.post('/eng-check', authenticate, authorizeStage('ENG_CHECK'), asyncHandler(async (req, res) => {
  const { requestId, status, comment, requestNo: manualRequestNo } = req.body;

  if (!requestId || !status) {
    throw new AppError('Request ID and status are required', 400);
  }
  if (!['Approve', 'Deny'].includes(status)) {
    throw new AppError('Status must be Approve or Deny', 400);
  }
  if (status === 'Deny' && !comment) {
    throw new AppError('Comment is required when denying', 400);
  }

  const { rows: reqRows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(requestId)]);
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'Eng Check') throw new AppError('Request is not at Eng Check stage', 400);

  const requestNo = status === 'Approve' ? (manualRequestNo || await generateRequestNo()) : null;
  const newStatus = status === 'Approve' ? 'Pending Draft Man' : 'Denied';
  const newStage = status === 'Approve' ? 'Draft Man' : 'Denied';
  const engCheckDays = await calculateWorkingDays(request.createdAt, new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2, "requestNo"=$3 WHERE id=$4 RETURNING *',
      [newStatus, newStage, requestNo, parseInt(requestId)]
    );

    const { rows: ecRows } = await client.query(
      `INSERT INTO eng_check ("requestId", "checkerName", "checkerEmail", status, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [parseInt(requestId), req.user.name, req.user.email, status, comment]
    );

    await client.query(
      'UPDATE tracking SET "engCheckAt"=$1, "engCheckDays"=$2 WHERE "requestId"=$3',
      [new Date(), engCheckDays, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];
    if (status === 'Approve') {
      try { await sendWorkflowEmail('eng-check-approved', updatedRequest); } catch (e) { console.error('Failed to send email:', e); }
    } else {
      try { await sendWorkflowEmail('eng-check-denied', updatedRequest, { comment }); } catch (e) { console.error('Failed to send email:', e); }
    }

    res.json({
      success: true,
      message: `Request ${status === 'Approve' ? 'approved' : 'denied'} successfully`,
      data: { request: updatedRequest, engCheck: ecRows[0] }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/workflow/draft-man
 */
router.post('/draft-man', authenticate, authorizeStage('DRAFTMAN'), asyncHandler(async (req, res) => {
  const { requestId, dwgFiles } = req.body;

  if (!requestId) throw new AppError('Request ID is required', 400);

  const { rows: reqRows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(requestId)]);
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'Draft Man') throw new AppError('Request is not at Draft Man stage', 400);

  const { rows: trackRows } = await pool.query('SELECT * FROM tracking WHERE "requestId" = $1', [parseInt(requestId)]);
  const tracking = trackRows[0];
  const draftManDays = await calculateWorkingDays(tracking?.engCheckAt || request.createdAt, new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2 WHERE id=$3 RETURNING *',
      ['Pending DWG Check', 'DWG Check', parseInt(requestId)]
    );

    const { rows: dmRows } = await client.query(
      `INSERT INTO draft_man ("requestId", "draftmanName", "draftmanEmail", "dwgFiles")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("requestId") DO UPDATE SET "draftmanName"=$2, "draftmanEmail"=$3, "dwgFiles"=$4
       RETURNING *`,
      [parseInt(requestId), req.user.name, req.user.email, dwgFiles || '']
    );

    await client.query(
      'UPDATE tracking SET "draftManAt"=$1, "draftManDays"=$2 WHERE "requestId"=$3',
      [new Date(), draftManDays, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];
    try { await sendWorkflowEmail('draft-completed', updatedRequest, dmRows[0]); } catch (e) { console.error('Failed to send email:', e); }

    res.json({
      success: true,
      message: 'Drawing uploaded successfully',
      data: { request: updatedRequest, draftMan: dmRows[0] }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * PUT /api/workflow/draft-man/:requestId
 */
router.put('/draft-man/:requestId', authenticate, authorizeStage('DRAFTMAN'), asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { dwgFiles } = req.body;

  const { rows: reqRows } = await pool.query(
    'SELECT r.*, ea.id as "eaId" FROM requests r LEFT JOIN eng_approve ea ON ea."requestId" = r.id WHERE r.id = $1',
    [parseInt(requestId)]
  );
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);

  const { rows: dmRows } = await pool.query('SELECT * FROM draft_man WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!dmRows[0]) throw new AppError('Draft Man record not found', 404);
  if (request.eaId) throw new AppError('Cannot edit after Eng Approve', 400);

  const { rows } = await pool.query(
    `UPDATE draft_man SET "draftmanName"=$1, "draftmanEmail"=$2, "dwgFiles"=$3, "updatedAt"=$4
     WHERE "requestId"=$5 RETURNING *`,
    [req.user.name, req.user.email, dwgFiles || '', new Date(), parseInt(requestId)]
  );

  res.json({
    success: true,
    message: 'Drawing files updated successfully',
    data: { draftMan: rows[0] }
  });
}));

/**
 * POST /api/workflow/dwg-check
 */
router.post('/dwg-check', authenticate, authorizeStage('DWG_CHECK'), asyncHandler(async (req, res) => {
  const { requestId, status, comment } = req.body;

  if (!requestId || !status) throw new AppError('Request ID and status are required', 400);

  const { rows: reqRows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(requestId)]);
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'DWG Check') throw new AppError('Request is not at DWG Check stage', 400);

  const { rows: trackRows } = await pool.query('SELECT * FROM tracking WHERE "requestId" = $1', [parseInt(requestId)]);
  const tracking = trackRows[0];

  const newStatus = status === 'Approve' ? 'Pending Eng Review' : 'Pending Draft Man';
  const newStage = status === 'Approve' ? 'Eng Review' : 'Draft Man';
  const dwgCheckDays = await calculateWorkingDays(tracking?.draftManAt || request.createdAt, new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2 WHERE id=$3 RETURNING *',
      [newStatus, newStage, parseInt(requestId)]
    );

    await client.query(
      `INSERT INTO dwg_check ("requestId", "checkerName", "checkerEmail", status, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("requestId") DO UPDATE SET "checkerName"=$2, "checkerEmail"=$3, status=$4, comment=$5`,
      [parseInt(requestId), req.user.name, req.user.email, status, comment]
    );

    await client.query(
      'UPDATE tracking SET "dwgCheckAt"=$1, "dwgCheckDays"=$2 WHERE "requestId"=$3',
      [new Date(), dwgCheckDays, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];
    if (status === 'Approve') {
      try { await sendWorkflowEmail('dwg-check-approved', updatedRequest); } catch (e) { console.error('Failed to send email:', e); }
    } else {
      try { await sendWorkflowEmail('dwg-check-denied', updatedRequest); } catch (e) { console.error('Failed to send email:', e); }
    }

    res.json({
      success: true,
      message: `Drawing ${status === 'Approve' ? 'approved' : 'returned for revision'}`,
      data: { request: updatedRequest }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/workflow/eng-review
 */
router.post('/eng-review', authenticate, authorizeStage('ENG_REVIEW'), asyncHandler(async (req, res) => {
  const { requestId, section, sparePartType, general, machinePart, gaugeType, noOfDwg, drawingNo, attachFiles } = req.body;

  if (!requestId) throw new AppError('Request ID is required', 400);
  if (!section || !section.trim()) throw new AppError('Section is required', 400);
  if (!noOfDwg || !noOfDwg.toString().trim()) throw new AppError('No. of DWG is required', 400);
  if (!drawingNo || !drawingNo.trim()) throw new AppError('Drawing No. is required', 400);

  const { rows: reqRows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(requestId)]);
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'Eng Review') throw new AppError('Request is not at Eng Review stage', 400);

  const { rows: trackRows } = await pool.query('SELECT * FROM tracking WHERE "requestId" = $1', [parseInt(requestId)]);
  const tracking = trackRows[0];
  const engReviewDays = await calculateWorkingDays(tracking?.dwgCheckAt || request.createdAt, new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2 WHERE id=$3 RETURNING *',
      ['Pending Eng Approve', 'Eng Approve', parseInt(requestId)]
    );

    const { rows: erRows } = await client.query(
      `INSERT INTO eng_review ("requestId", "reviewerName", "reviewerEmail", section, "sparePartType", general, "machinePart", "gaugeType", "noOfDwg", "drawingNo", "attachFiles")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [parseInt(requestId), req.user.name, req.user.email, section, sparePartType, general, machinePart, gaugeType, noOfDwg, drawingNo, attachFiles]
    );

    await client.query(
      'UPDATE tracking SET "engReviewAt"=$1, "engReviewDays"=$2 WHERE "requestId"=$3',
      [new Date(), engReviewDays, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];
    try { await sendWorkflowEmail('eng-review-completed', updatedRequest, erRows[0]); } catch (e) { console.error('Failed to send email:', e); }

    res.json({
      success: true,
      message: 'Engineering review completed',
      data: { request: updatedRequest, engReview: erRows[0] }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/workflow/eng-approve
 */
router.post('/eng-approve', authenticate, authorizeStage('ENG_APPROVE'), asyncHandler(async (req, res) => {
  const { requestId, judgement, comment } = req.body;

  if (!requestId || !judgement) throw new AppError('Request ID and judgement are required', 400);

  const { rows: reqRows } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(requestId)]);
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'Eng Approve') throw new AppError('Request is not at Eng Approve stage', 400);

  const { rows: trackRows } = await pool.query('SELECT * FROM tracking WHERE "requestId" = $1', [parseInt(requestId)]);
  const tracking = trackRows[0];

  const newStatus = judgement === 'Approve' ? 'Pending Eng Inform' : 'Denied by Approve';
  const newStage = judgement === 'Approve' ? 'Eng Inform' : 'Denied';
  const engApproveDays = await calculateWorkingDays(tracking?.engReviewAt || request.createdAt, new Date());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2 WHERE id=$3 RETURNING *',
      [newStatus, newStage, parseInt(requestId)]
    );

    const { rows: eaRows } = await client.query(
      `INSERT INTO eng_approve ("requestId", "approverName", "approverEmail", judgement, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [parseInt(requestId), req.user.name, req.user.email, judgement, comment]
    );

    await client.query(
      'UPDATE tracking SET "engApproveAt"=$1, "engApproveDays"=$2 WHERE "requestId"=$3',
      [new Date(), engApproveDays, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];
    if (judgement === 'Approve') {
      try { await sendWorkflowEmail('eng-approve-completed', updatedRequest); } catch (e) { console.error('Failed to send email:', e); }
    } else {
      try { await sendWorkflowEmail('request-denied-final', updatedRequest); } catch (e) { console.error('Failed to send email:', e); }
    }

    res.json({
      success: true,
      message: `Request ${judgement === 'Approve' ? 'approved' : 'denied'}`,
      data: { request: updatedRequest, engApprove: eaRows[0] }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/workflow/eng-inform
 */
router.post('/eng-inform', authenticate, authorizeStage('ENG_INFORM'), asyncHandler(async (req, res) => {
  const { requestId, cost, evidence, attachFiles } = req.body;

  if (!requestId) throw new AppError('Request ID is required', 400);

  const { rows: reqRows } = await pool.query(
    'SELECT r.*, er."drawingNo", er."noOfDwg" FROM requests r LEFT JOIN eng_review er ON er."requestId" = r.id WHERE r.id = $1',
    [parseInt(requestId)]
  );
  const request = reqRows[0];

  if (!request) throw new AppError('Request not found', 404);
  if (request.currentStage !== 'Eng Inform') throw new AppError('Request is not at Eng Inform stage', 400);

  const totalDays = await calculateWorkingDays(request.createdAt, new Date());
  const onTime = new Date() <= new Date(request.reqDueDate);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: updatedRows } = await client.query(
      'UPDATE requests SET status=$1, "currentStage"=$2 WHERE id=$3 RETURNING *',
      ['Completed & Informed', 'Informed', parseInt(requestId)]
    );

    await client.query(
      `INSERT INTO eng_inform ("requestId", cost, evidence, "attachFiles")
       VALUES ($1,$2,$3,$4)`,
      [parseInt(requestId), cost, evidence, attachFiles]
    );

    await client.query(
      `UPDATE tracking SET "engInformAt"=$1, "completedAt"=$2, "totalDays"=$3, status=$4, "onTime"=$5 WHERE "requestId"=$6`,
      [new Date(), new Date(), totalDays, 'Completed', onTime, parseInt(requestId)]
    );

    await client.query('COMMIT');

    const updatedRequest = updatedRows[0];

    // Fetch eng_review for email
    const { rows: erRows } = await pool.query('SELECT * FROM eng_review WHERE "requestId" = $1', [parseInt(requestId)]);

    try {
      await sendWorkflowEmail('request-completed', updatedRequest, {
        engReview: erRows[0],
        cost,
        evidence,
        attachFiles
      });
    } catch (e) { console.error('Failed to send email:', e); }

    res.json({
      success: true,
      message: 'Requester has been notified successfully',
      data: { request: updatedRequest }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

module.exports = router;
