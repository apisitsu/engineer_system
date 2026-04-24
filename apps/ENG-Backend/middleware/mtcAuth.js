const { verifyToken } = require('./auth');

/**
 * Middleware to check if the user has required roles or departments
 * @param {Array} allowedRoles - List of allowed roles/departments (e.g., ['AD', 'Engineering'])
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User context missing. Authentication required.' });
    }

    const userDept = req.user.department || req.user.u_department || '';
    const userRole = req.user.role || req.user.u_role || '';

    const hasAccess = allowedRoles.length === 0 || 
                      allowedRoles.includes(userDept) || 
                      allowedRoles.includes(userRole);

    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: You do not have permission for this operation.' 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  authorize,
  isAdmin: authorize(['AD']),
  isEngineer: authorize(['AD', 'Engineering'])
};
