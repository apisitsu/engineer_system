const express = require('express');
const { pool } = require('../db/pool');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('admin'));

/**
 * PUT /api/admin/request/:id
 */
router.put('/request/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, currentStage, title, detail, attachments } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM requests WHERE id = $1', [parseInt(id)]);
  if (!existing[0]) throw new AppError('Request not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (currentStage !== undefined) { fields.push(`"currentStage" = $${idx++}`); values.push(currentStage); }
  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (detail !== undefined) { fields.push(`detail = $${idx++}`); values.push(detail); }
  if (attachments !== undefined) { fields.push(`attachments = $${idx++}`); values.push(attachments); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(id));
  const { rows } = await pool.query(
    `UPDATE requests SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/eng-check/:requestId
 */
router.put('/eng-check/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, comment } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM eng_check WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('Eng Check record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (comment !== undefined) { fields.push(`comment = $${idx++}`); values.push(comment); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE eng_check SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/draft-man/:requestId
 */
router.put('/draft-man/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { dwgFiles } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM draft_man WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('Draft Man record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (dwgFiles !== undefined) { fields.push(`"dwgFiles" = $${idx++}`); values.push(dwgFiles); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE draft_man SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/dwg-check/:requestId
 */
router.put('/dwg-check/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, comment } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM dwg_check WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('DWG Check record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (comment !== undefined) { fields.push(`comment = $${idx++}`); values.push(comment); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE dwg_check SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/eng-review/:requestId
 */
router.put('/eng-review/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { section, noOfDwg, drawingNo, attachFiles } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM eng_review WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('Eng Review record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (section !== undefined) { fields.push(`section = $${idx++}`); values.push(section); }
  if (noOfDwg !== undefined) { fields.push(`"noOfDwg" = $${idx++}`); values.push(noOfDwg); }
  if (drawingNo !== undefined) { fields.push(`"drawingNo" = $${idx++}`); values.push(drawingNo); }
  if (attachFiles !== undefined) { fields.push(`"attachFiles" = $${idx++}`); values.push(attachFiles); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE eng_review SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/eng-approve/:requestId
 */
router.put('/eng-approve/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { judgement, comment } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM eng_approve WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('Eng Approve record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (judgement !== undefined) { fields.push(`judgement = $${idx++}`); values.push(judgement); }
  if (comment !== undefined) { fields.push(`comment = $${idx++}`); values.push(comment); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE eng_approve SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * PUT /api/admin/eng-inform/:requestId
 */
router.put('/eng-inform/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { cost, evidence } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM eng_inform WHERE "requestId" = $1', [parseInt(requestId)]);
  if (!existing[0]) throw new AppError('Eng Inform record not found', 404);

  const fields = [];
  const values = [];
  let idx = 1;

  if (cost !== undefined) { fields.push(`cost = $${idx++}`); values.push(cost); }
  if (evidence !== undefined) { fields.push(`evidence = $${idx++}`); values.push(evidence); }

  if (fields.length === 0) throw new AppError('No fields to update', 400);

  values.push(parseInt(requestId));
  const { rows } = await pool.query(
    `UPDATE eng_inform SET ${fields.join(', ')} WHERE "requestId" = $${idx} RETURNING *`,
    values
  );

  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
