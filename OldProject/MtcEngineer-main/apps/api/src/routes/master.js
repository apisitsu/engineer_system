const express = require('express');
const { pool } = require('../db/pool');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/master/departments
 */
router.get('/departments', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM departments ORDER BY name ASC');
  res.json({ success: true, data: rows });
}));

/**
 * POST /api/master/departments
 */
router.post('/departments', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    throw new AppError('Department name is required', 400);
  }
  const { rows } = await pool.query(
    'INSERT INTO departments (name) VALUES ($1) RETURNING *',
    [name]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

/**
 * GET /api/master/work-centers
 */
router.get('/work-centers', asyncHandler(async (req, res) => {
  const { department } = req.query;
  let query = 'SELECT * FROM work_centers';
  const params = [];

  if (department) {
    query += ' WHERE department = $1';
    params.push(department);
  }
  query += ' ORDER BY code ASC';

  const { rows } = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

/**
 * POST /api/master/work-centers
 */
router.post('/work-centers', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { code, name, department } = req.body;
  if (!code || !name) {
    throw new AppError('Work center code and name are required', 400);
  }
  const { rows } = await pool.query(
    'INSERT INTO work_centers (code, name, department) VALUES ($1, $2, $3) RETURNING *',
    [code, name, department]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

/**
 * GET /api/master/machines
 */
router.get('/machines', asyncHandler(async (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM machines';
  const params = [];

  if (search) {
    query += ' WHERE code ILIKE $1 OR name ILIKE $1';
    params.push(`%${search}%`);
  }
  query += ' ORDER BY code ASC';

  const { rows } = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

/**
 * POST /api/master/machines
 */
router.post('/machines', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    throw new AppError('Machine code and name are required', 400);
  }
  const { rows } = await pool.query(
    'INSERT INTO machines (code, name) VALUES ($1, $2) RETURNING *',
    [code, name]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

/**
 * GET /api/master/holidays
 */
router.get('/holidays', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const { rows } = await pool.query(
    'SELECT * FROM holidays WHERE date >= $1 AND date <= $2 ORDER BY date ASC',
    [startDate, endDate]
  );
  res.json({ success: true, data: rows });
}));

/**
 * POST /api/master/holidays
 */
router.post('/holidays', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { date, name } = req.body;
  if (!date) {
    throw new AppError('Holiday date is required', 400);
  }
  const { rows } = await pool.query(
    'INSERT INTO holidays (date, name) VALUES ($1, $2) RETURNING *',
    [new Date(date), name]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

module.exports = router;
