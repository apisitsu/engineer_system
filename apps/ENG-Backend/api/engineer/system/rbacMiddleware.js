/**
 * Role-Based Access Control (RBAC) Middleware
 * For Todo and Project Management System
 * 
 * Hierarchy: AD > ENG-MGR/COORD > ENG-HEAD > ENG-STAFF > ENG-LEADER
 */

// ==================== ROLE HIERARCHY ====================

const ROLE_HIERARCHY = {
    'AD': 100,      // Admin - sees everything
    'MGR': 80,      // Manager
    'COORD': 80,    // Coordinator (same level as MGR)
    'HEAD': 60,     // Head - sees own group
    'STAFF': 40,    // Staff - sees own projects + member projects
    'LEADER': 30    // Leader - same as staff
};

function getRoleLevel(role) {
    return ROLE_HIERARCHY[role] || 0;
}

// ==================== PROJECT VISIBILITY ====================

/**
 * Check if user can view a specific project
 * @param {Object} user - User object with u_department, u_role, u_group, id / u_code
 * @param {Object} project - Project object with owner_u_code, project_group, is_private
 * @returns {boolean} - True if user can view the project
 */
function canViewProject(user, project) {
    const userId = user.u_code || user.id;

    // Rule 1: AD department can see all projects
    if (user.u_department === 'AD') {
        return true;
    }

    // Rule 2: Project owner can always see their own project
    if (project.owner_u_code === userId) {
        return true;
    }

    // Rule 3: Private projects - only owner and members can see
    if (project.is_private) {
        // Member check must be done separately (async), so we return false here
        // The caller should check membership separately for private projects
        return false;
    }

    // Rule 4: ENG + (STAFF or LEADER) = Only own projects or projects they are members of
    if (user.u_department === 'ENG' && ['STAFF', 'LEADER'].includes(user.u_role)) {
        // Membership check is handled in getProjectVisibilityFilter SQL
        return false;
    }

    // Rule 5: ENG + HEAD = Only projects in same group
    if (user.u_department === 'ENG' && user.u_role === 'HEAD') {
        return project.project_group === user.u_group;
    }

    // Rule 6: ENG + (COORD or MGR) = All projects except SYS group
    if (user.u_department === 'ENG' && ['COORD', 'MGR'].includes(user.u_role)) {
        return project.project_group !== 'SYS';
    }

    return false;
}

// ==================== PROJECT CREATION ====================

/**
 * Check if user can create a project with given parameters
 * @param {Object} user - User object with u_department, u_role, u_group, id / u_code
 * @param {Object} projectData - { project_group, owner_id } 
 * @returns {{ allowed: boolean, reason?: string, p_type: number }}
 */
function canCreateProject(user, projectData = {}) {
    const { project_group, owner_id } = projectData;
    const userId = user.u_code || user.id;

    // AD: Can create any project (p_type = 1 assigned)
    if (user.u_department === 'AD') {
        return { allowed: true, p_type: 1 };
    }

    // ENG + MGR/COORD: Can create for any group except SYS (p_type = 1)
    if (user.u_department === 'ENG' && ['MGR', 'COORD'].includes(user.u_role)) {
        if (project_group === 'SYS') {
            return { allowed: false, reason: 'MGR/COORD cannot create projects in SYS group' };
        }
        return { allowed: true, p_type: 1 };
    }

    // ENG + HEAD: Only within own group (p_type = 1)
    if (user.u_department === 'ENG' && user.u_role === 'HEAD') {
        if (project_group && project_group !== user.u_group) {
            return { allowed: false, reason: 'HEAD can only create projects in own group' };
        }
        return { allowed: true, p_type: 1 };
    }

    // ENG + STAFF: Personal projects only (p_type = 0)
    if (user.u_department === 'ENG' && user.u_role === 'STAFF') {
        if (owner_id && owner_id !== userId) {
            return { allowed: false, reason: 'STAFF can only create personal projects' };
        }
        return { allowed: true, p_type: 0 };
    }

    // ENG + LEADER: Personal projects only (p_type = 0)
    if (user.u_department === 'ENG' && user.u_role === 'LEADER') {
        if (owner_id && owner_id !== userId) {
            return { allowed: false, reason: 'LEADER can only create personal projects' };
        }
        return { allowed: true, p_type: 0 };
    }

    return { allowed: false, reason: 'Insufficient permissions to create project' };
}

/**
 * Legacy: Check if user can create a project with p_type = 1 (assigned)
 * Kept for backward compatibility
 */
function canCreateAssignedProject(user) {
    const result = canCreateProject(user);
    return result.p_type === 1;
}

// ==================== PROJECT VISIBILITY FILTER ====================

/**
 * Get SQL WHERE clause for project visibility filtering
 * Now includes member-based visibility and private project handling
 * Note: Returns `?` as placeholders. The caller must manually iterate and replace with `$1`, etc. if using pg.
 * @param {Object} user - User object
 * @returns {Object} - {clause: string, params: array}
 */
function getProjectVisibilityFilter(user) {
    const userId = user.u_code || user.id;

    // AD: See all projects (no filter)
    if (user.u_department === 'AD') {
        return { clause: '', params: [] };
    }

    // ENG + STAFF/LEADER: Own projects OR projects they are members of
    if (user.u_department === 'ENG' && ['STAFF', 'LEADER'].includes(user.u_role)) {
        return {
            clause: `AND (p.owner_u_code = ? OR p.id IN (SELECT pm.project_id FROM pm_project_member pm WHERE pm.u_code = ?))`,
            params: [userId, userId]
        };
    }

    // ENG + HEAD: Same group OR projects they are members of
    if (user.u_department === 'ENG' && user.u_role === 'HEAD') {
        return {
            clause: `AND (p.project_group = ? OR p.owner_u_code = ? OR p.id IN (SELECT pm.project_id FROM pm_project_member pm WHERE pm.u_code = ?))`,
            params: [user.u_group, userId, userId]
        };
    }

    // ENG + COORD/MGR: All except SYS group (unless they are members)
    if (user.u_department === 'ENG' && ['COORD', 'MGR'].includes(user.u_role)) {
        return {
            clause: `AND (p.project_group != 'SYS' OR p.project_group IS NULL OR p.id IN (SELECT pm.project_id FROM pm_project_member pm WHERE pm.u_code = ?))`,
            params: [userId]
        };
    }

    // Default: No access
    return { clause: 'AND 1=0', params: [] };
}

// ==================== TASK PERMISSIONS ====================

/**
 * Check if user can edit a specific task
 * @param {Object} user - User object with id/u_code, u_department, u_role
 * @param {Object} task - Task object with assignee_u_code / assignee_id
 * @param {boolean} isMember - Whether user is a project member
 * @returns {boolean} - True if user can edit the task
 */
function canEditTask(user, task, isMember) {
    const userId = user.u_code || user.id;
    const assigneeId = task.assignee_u_code || task.assignee_id;

    // AD can always edit
    if (user.u_department === 'AD') {
        return true;
    }

    // Must be a project member first
    if (!isMember) {
        return false;
    }

    // MGR/COORD/HEAD can edit any task in their visible projects
    if (['MGR', 'COORD', 'HEAD'].includes(user.u_role)) {
        return true;
    }

    // If task has no assignee, any project member can edit
    if (!assigneeId || assigneeId === null) {
        return true;
    }

    // If task has assignee, only that assignee can edit
    return assigneeId === userId;
}

/**
 * Check if user can change task to 'check' status (only project owner can review)
 * @param {Object} user - User object
 * @param {Object} project - Project object
 * @returns {boolean}
 */
function canCheckTask(user, project) {
    const userId = user.u_code || user.id;

    // AD can always check
    if (user.u_department === 'AD') {
        return true;
    }

    // Project owner can check
    if (project.owner_u_code === userId || project.owner_id === userId) {
        return true;
    }

    // MGR/COORD can check tasks in their visible projects
    if (user.u_department === 'ENG' && ['MGR', 'COORD'].includes(user.u_role)) {
        return true;
    }

    return false;
}

// ==================== MEMBERSHIP CHECK ====================

/**
 * Check if user is a member of a project
 * @param {Object} pool - Postgres Pool connection
 * @param {string|number} userId - User ID (u_code)
 * @param {number} projectId - Project ID
 * @returns {Promise<boolean>} - True if user is a member
 */
async function isProjectMember(pool, userId, projectId) {
    try {
        const sql = `SELECT COUNT(*) as count FROM pm_project_member WHERE project_id = $1 AND u_code = $2`;
        const result = await pool.query(sql, [projectId, userId]);
        return parseInt(result.rows[0].count) > 0;
    } catch (err) {
        throw err;
    }
}

// ==================== ADMIN SIMULATION ====================

/**
 * Resolve the effective user for API requests.
 * If the request contains an x-simulate-user header AND the real user is AD,
 * merge the simulation fields over the real user fields.
 * @param {Object} req - Express request object
 * @returns {Object} - Effective user object
 */
function resolveEffectiveUser(req) {
    const realUser = req.user || {};

    // Only AD users can simulate
    if (realUser.u_department !== 'AD') {
        return realUser;
    }

    // Check for simulation header
    const simulateHeader = req.headers['x-simulate-user'];
    if (!simulateHeader) {
        return realUser;
    }

    try {
        const simulatedFields = JSON.parse(simulateHeader);
        // Merge simulation over real user — including id so visibility filters work correctly
        return {
            ...realUser,
            id: simulatedFields.id || realUser.id,  // Override ID for correct ownership filtering
            u_code: simulatedFields.u_code || realUser.u_code || simulatedFields.id || realUser.id,
            u_department: simulatedFields.u_department || realUser.u_department,
            u_role: simulatedFields.u_role || realUser.u_role,
            u_group: simulatedFields.u_group || realUser.u_group,
            _isSimulated: true,
            _realUser: { ...realUser }
        };
    } catch (e) {
        console.warn('Invalid x-simulate-user header:', e.message);
        return realUser;
    }
}

// ==================== MIDDLEWARE FUNCTIONS ====================

/**
 * Middleware to check project visibility
 */
async function checkProjectAccess(req, res, next) {
    const projectId = req.params.id || req.body.project_id;
    const user = req.user;

    if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
    }

    try {
        const pool = req.db || require('../../../instance/eng_db').engPool; // Use the pool attached to req, or fallback to import

        const result = await pool.query('SELECT * FROM pm_project WHERE id = $1', [projectId]);
        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check direct visibility
        if (canViewProject(user, project)) {
            req.project = project;
            return next();
        }

        // For private projects or member-based access, check membership
        try {
            const userId = user.u_code || user.id;
            const isMember = await isProjectMember(pool, userId, project.id);
            if (isMember) {
                req.project = project;
                return next();
            }
        } catch (memberErr) {
            console.error('Member check error:', memberErr);
        }

        return res.status(403).json({ error: 'Access denied to this project' });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Middleware to check task edit permission
 */
async function checkTaskEditAccess(req, res, next) {
    const taskId = req.params.id;
    const user = req.user;
    const project = req.project;

    if (!user || !project) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const pool = req.db || require('../../../instance/eng_db').engPool;

        const userId = user.u_code || user.id;

        const isMember = await isProjectMember(pool, userId, project.id);
        if (!isMember) {
            return res.status(403).json({ error: 'Not a member of this project' });
        }

        const taskResult = await pool.query('SELECT * FROM pm_task WHERE id = $1', [taskId]);
        const task = taskResult.rows[0];

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (canEditTask(user, task, true)) {
            req.task = task;
            next();
        } else {
            return res.status(403).json({
                error: 'This task is assigned to someone else',
                assignee_id: task.assignee_u_code || task.assignee_id
            });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
}

module.exports = {
    ROLE_HIERARCHY,
    getRoleLevel,
    canViewProject,
    canCreateProject,
    canCreateAssignedProject,
    getProjectVisibilityFilter,
    canEditTask,
    canCheckTask,
    isProjectMember,
    resolveEffectiveUser,
    checkProjectAccess,
    checkTaskEditAccess
};
