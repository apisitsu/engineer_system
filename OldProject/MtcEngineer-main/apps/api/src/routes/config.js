const express = require('express');
const { pool } = require('../db/pool');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/config/email
 */
router.get('/email', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM email_config ORDER BY stage ASC');
  res.json({ success: true, data: rows });
}));

/**
 * PUT /api/config/email/:stage
 */
router.put('/email/:stage', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { stage } = req.params;
  const { emails } = req.body;

  if (!emails) {
    throw new AppError('Emails are required', 400);
  }

  const { rows } = await pool.query(
    `INSERT INTO email_config (stage, emails) VALUES ($1, $2)
     ON CONFLICT (stage) DO UPDATE SET emails = $2
     RETURNING *`,
    [stage, emails]
  );

  res.json({ success: true, data: rows[0] });
}));

/**
 * GET /api/config/due-days
 */
router.get('/due-days', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM due_days_config ORDER BY "requestType" ASC');
  res.json({ success: true, data: rows });
}));

/**
 * PUT /api/config/due-days/:requestType
 */
router.put('/due-days/:requestType', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { requestType } = req.params;
  const { days } = req.body;

  if (!days || isNaN(days)) {
    throw new AppError('Days must be a valid number', 400);
  }

  const { rows } = await pool.query(
    `INSERT INTO due_days_config ("requestType", days) VALUES ($1, $2)
     ON CONFLICT ("requestType") DO UPDATE SET days = $2
     RETURNING *`,
    [requestType, parseInt(days)]
  );

  res.json({ success: true, data: rows[0] });
}));

module.exports = router;
