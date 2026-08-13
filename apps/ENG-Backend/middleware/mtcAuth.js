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

/**
 * Feature-level permission guard. Passes when the user is a full admin
 * (department/role === 'AD') OR holds the named feature permission in their JWT
 * `perms` array (sourced from m_user_profile.feature_perms). Lets a specific
 * non-admin user administer ONE section (e.g. 'tooling_admin', 'sds_admin')
 * without being granted blanket 'AD' admin everywhere.
 * @param {string} feature - feature key, e.g. 'tooling_admin' | 'sds_admin'
 */
const hasFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User context missing. Authentication required.' });
    }
    const userDept = req.user.department || req.user.u_department || '';
    const userRole = req.user.role || req.user.u_role || '';
    const perms = Array.isArray(req.user.perms) ? req.user.perms : [];

    if (userDept === 'AD' || userRole === 'AD' || perms.includes(feature)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'Access denied: You do not have permission for this operation.'
    });
  };
};

/**
 * The same test `isAdmin` applies, as a plain predicate.
 *
 * A guard can only answer "may this request proceed at all". Some routes need
 * the answer *inside* the handler instead — the CAD/CAM library lets anyone
 * delete their own saved work and an admin delete anybody's, which is one route
 * with two rules, not two routes. Those handlers must not re-derive "is an
 * admin" from `req.user` themselves: two spellings of the same rule drift, and
 * the one that drifts is the one nobody is looking at.
 *
 * Deliberately identical to `authorize(['AD'])`'s condition — department OR role
 * being 'AD'. Change one and change the other.
 */
const isAdminUser = (user) => {
  const dept = user?.department || user?.u_department || '';
  const role = user?.role || user?.u_role || '';
  return dept === 'AD' || role === 'AD';
};

module.exports = {
  verifyToken,
  authorize,
  hasFeature,
  isAdmin: authorize(['AD']),
  isAdminUser,
  isEngineer: authorize(['AD', 'Engineering'])
};
