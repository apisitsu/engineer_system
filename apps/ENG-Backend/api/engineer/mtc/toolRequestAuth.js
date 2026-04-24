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

/**
 * Check if user has permission for specific stage
 * Must be used after verifyToken or optionalAuth
 */
const checkStagePermission = (stage) => {
  const EMAIL_CONFIG = {
    eng_check: (process.env.EMAIL_MTC_ENG_CHECK || '').split(',').map(e => e.trim()).filter(Boolean),
    draft_man: (process.env.EMAIL_MTC_DRAFTMAN || '').split(',').map(e => e.trim()).filter(Boolean),
    dwg_check: (process.env.EMAIL_MTC_DWG_CHECK || '').split(',').map(e => e.trim()).filter(Boolean),
    eng_review: (process.env.EMAIL_MTC_ENG_REVIEW || '').split(',').map(e => e.trim()).filter(Boolean),
    eng_approve: (process.env.EMAIL_MTC_ENG_APPROVE || '').split(',').map(e => e.trim()).filter(Boolean),
    eng_inform: (process.env.EMAIL_MTC_ENG_INFORM || '').split(',').map(e => e.trim()).filter(Boolean),
  };

  return (req, res, next) => {
    const allowedEmails = EMAIL_CONFIG[stage] || [];
    const userDept = (req.user?.department || req.body?.user_department || '').toUpperCase();
    
    // AD department bypass
    if (userDept === 'AD') {
      return next();
    }

    // If no allowed emails configured, allow access
    if (allowedEmails.length === 0) {
      return next();
    }

    const allowedCodes = allowedEmails.map(e => e.split('@')[0].toLowerCase());
    const userCode = (req.user?.u_code || req.body?.user_code || '').toLowerCase();
    const userEmail = (req.user?.gmail_email || req.body?.action_by_email || '').toLowerCase();

    const isAllowed = allowedCodes.includes(userCode) 
      || allowedEmails.map(e => e.toLowerCase()).includes(userEmail);

    if (!isAllowed) {
      console.warn(`⚠️ Permission denied for user ${req.user?.userName || 'unknown'} on stage ${stage}`);
      return res.status(403).json({ 
        error: 'Permission denied',
        message: `You do not have permission to perform actions on stage: ${stage}` 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  optionalAuth,
  checkStagePermission
};
