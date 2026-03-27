const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { poolRodpc } = require('../db/pool_rodpc');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Verify password against Engineering_System (rodpc.m_user),
 * then load EngReqJS role from engreq.users (auto-create if first login)
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { empno, password } = req.body;

  if (!empno || !password) {
    throw new AppError('Employee number and password are required', 400);
  }

  const empnoUpper = empno.toUpperCase();

  // Step 1: Verify against Engineering_System rodpc.m_user
  const { rows: rodpcRows } = await poolRodpc.query(
    'SELECT u_code, u_pass, u_name, u_authority, u_role FROM m_user WHERE UPPER(u_code) = $1',
    [empnoUpper]
  );

  const rodpcUser = rodpcRows[0];
  if (!rodpcUser) {
    throw new AppError('Invalid credentials', 401);
  }

  // Support PHP bcrypt hash format ($2y$ -> $2a$)
  const correctedHash = rodpcUser.u_pass.replace('$2y$', '$2a$');
  const isMatch = await bcrypt.compare(password, correctedHash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // Step 2: Load EngReqJS user (auto-create if first login)
  let { rows } = await pool.query(
    'SELECT * FROM users WHERE UPPER(empno) = $1',
    [empnoUpper]
  );

  let engreqUser = rows[0];

  if (!engreqUser) {
    // Map Engineering_System role to EngReqJS role
    const defaultRole = rodpcUser.u_role === 'AD' ? 'admin' : 'requester';
    const insertResult = await pool.query(
      `INSERT INTO users (empno, name, role, auth, "isActive")
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [empnoUpper, rodpcUser.u_name, defaultRole, rodpcUser.u_authority?.toString() || '4']
    );
    engreqUser = insertResult.rows[0];
    console.log(`Auto-created EngReqJS user: ${empnoUpper} (${defaultRole})`);
  }

  if (!engreqUser.isActive) {
    throw new AppError('Account is inactive', 401);
  }

  res.json({
    success: true,
    user: {
      id: engreqUser.id,
      empno: engreqUser.empno,
      email: engreqUser.email,
      name: engreqUser.name || rodpcUser.u_name,
      role: engreqUser.role,
      auth: engreqUser.auth || rodpcUser.u_authority?.toString() || '4',
      department: engreqUser.department,
      section: engreqUser.section
    }
  });
}));

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
}));

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', 400);
  }

  const { rows } = await pool.query(
    'SELECT password FROM users WHERE id = $1',
    [req.user.id]
  );

  const user = rows[0];
  const correctedHash = user.password.replace('$2y$', '$2a$');
  const isMatch = await bcrypt.compare(currentPassword, correctedHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE users SET password = $1 WHERE id = $2',
    [hashedPassword, req.user.id]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * POST /api/auth/register (Admin only)
 */
router.post('/register', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('Only admin can create users', 403);
  }

  const { empno, email, password, name, role, department, section } = req.body;

  if (!empno || !password || !name) {
    throw new AppError('Employee number, password, and name are required', 400);
  }

  // Check if empno already exists
  const { rows: existingEmpno } = await pool.query(
    'SELECT id FROM users WHERE UPPER(empno) = $1',
    [empno.toUpperCase()]
  );

  if (existingEmpno.length > 0) {
    throw new AppError('Employee number already exists', 400);
  }

  // Check if email already exists (if provided)
  if (email) {
    const { rows: existingEmail } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );

    if (existingEmail.length > 0) {
      throw new AppError('Email already exists', 400);
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (empno, email, password, name, role, department, section, auth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, empno, email, name, role, department, section`,
    [empno.toUpperCase(), email?.toLowerCase() || null, hashedPassword, name, role || 'requester', department, section, '4']
  );

  res.status(201).json({
    success: true,
    user: rows[0]
  });
}));

module.exports = router;
