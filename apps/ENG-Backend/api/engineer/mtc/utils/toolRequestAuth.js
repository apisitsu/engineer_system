/**
 * Middleware for Tool Request API authentication and validation
 * Provides JWT verification and user context injection
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and inject user info into request
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'eng_system_secret_2026');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({ 
      error: 'Invalid token',
      message: error.message 
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 */
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'eng_system_secret_2026');
      req.user = decoded;
    } catch (error) {
      // Silently continue without user context
      console.warn('⚠️ Optional auth failed:', error.message);
    }
  }
  next();
};

// NOTE: stage-permission checking for tool-request actions lives inline in
// toolRequestController.js's submitAction() (DB-driven via tr_email_config,
// matched against req.user.empno/req.user.department from the verified JWT).
// A checkStagePermission() middleware used to be defined here as well, reading
// from EMAIL_MTC_* env vars and falling back to unverified req.body fields when
// req.user lacked u_code/gmail_email (fields this JWT never actually carries) -
// it was never wired into any route, and its silent req.body fallback was the
// same bypass the inline check had. Removed rather than fixed-and-left-unused,
// so there is only one place this logic can drift out of sync again.

module.exports = {
  verifyToken,
  optionalAuth,
};
