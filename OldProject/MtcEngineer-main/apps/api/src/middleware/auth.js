const { pool } = require('../db/pool');
const { AppError } = require('./errorHandler');

/**
 * Authentication middleware - reads empno from x-emp-no header (session-based, no JWT)
 */
const authenticate = async (req, res, next) => {
  try {
    const empno = req.headers['x-emp-no'];

    if (!empno) {
      throw new AppError('Not authenticated', 401);
    }

    const { rows } = await pool.query(
      'SELECT id, empno, email, name, role, auth, department, section, "isActive" FROM users WHERE UPPER(empno) = $1',
      [empno.toUpperCase()]
    );

    const user = rows[0];

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
};

/**
 * Authorization middleware - checks user role
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Not authorized for this action', 403));
    }

    next();
  };
};

/**
 * Optional authentication - sets user if x-emp-no header present
 */
const optionalAuth = async (req, res, next) => {
  try {
    const empno = req.headers['x-emp-no'];
    if (!empno) return next();

    const { rows } = await pool.query(
      'SELECT id, empno, email, name, role, auth, department, section FROM users WHERE UPPER(empno) = $1',
      [empno.toUpperCase()]
    );

    if (rows[0]) req.user = rows[0];
  } catch (_) {}

  next();
};

// Role check helpers
const isAdmin = (user) => user?.role === 'admin';
const isEngineer = (user) => ['admin', 'engineer'].includes(user?.role);
const isDraftman = (user) => ['admin', 'draftman'].includes(user?.role);
const isReviewer = (user) => ['admin', 'reviewer'].includes(user?.role);
const isApprover = (user) => ['admin', 'approver'].includes(user?.role);

/**
 * Check if user can perform action based on email config
 */
const canAccessStage = async (user, stage) => {
  if (user?.role === 'admin') {
    return true;
  }

  try {
    const { rows } = await pool.query(
      'SELECT emails FROM email_config WHERE stage = $1',
      [stage]
    );

    const config = rows[0];
    if (!config || !config.emails) {
      return false;
    }

    const allowedEmails = config.emails
      .split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e);

    return allowedEmails.includes(user?.email?.toLowerCase());
  } catch (error) {
    console.error('Error checking stage access:', error);
    return false;
  }
};

/**
 * Middleware to check stage access based on email config
 */
const authorizeStage = (stage) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const hasAccess = await canAccessStage(req.user, stage);
    if (!hasAccess) {
      return next(new AppError(`Not authorized for ${stage}. Please contact admin to add your email to the config.`, 403));
    }

    next();
  };
};

/**
 * Check if user is authorized (email exists in any EmailConfig stage)
 */
const isAuthorizedUser = async (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  try {
    const { rows } = await pool.query('SELECT emails FROM email_config');
    const userEmail = user.email?.toLowerCase();

    for (const config of rows) {
      if (!config.emails) continue;
      const emails = config.emails
        .split(/[,\n]/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e);
      if (emails.includes(userEmail)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking authorized user:', error);
    return false;
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  isAdmin,
  isEngineer,
  isDraftman,
  isReviewer,
  isApprover,
  canAccessStage,
  authorizeStage,
  isAuthorizedUser
};
