const { engPool } = require('../../../instance/eng_db'); // Use new schema
const moment = require('moment');
const {
    canViewProject,
    canCreateProject,
    canCreateAssignedProject,
    getProjectVisibilityFilter,
    canEditTask,
    canCheckTask,
    isProjectMember,
    resolveEffectiveUser
} = require('./rbacMiddleware');

// ==================== PROJECTS ====================

/**
 * Get all projects with RBAC filtering
 * Query params: status, project_group, month, search
 */
const GetProjects = async (req, res) => {
    const { status, project_group, month, search, monthType } = req.query;
    const user = req.user || {}; // Should be set by auth middleware

    let sql = `SELECT p.*, u.u_name as owner_name,
    (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id) as total_tasks,
    (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id AND status = 5) as completed_tasks
    FROM pm_project p LEFT JOIN m_user_profile u ON p.owner_u_code = u.u_code WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Apply RBAC filtering
    const rbacFilter = getProjectVisibilityFilter(user);
    if (rbacFilter.clause) {
        // Need to convert SQLite ? to Postgres $x
        let clause = rbacFilter.clause;
        for (const p of rbacFilter.params) {
            clause = clause.replace('?', `$${paramIndex++}`);
            params.push(p);
        }
        sql += ` ${clause}`;
    }

    // Filter by status
    if (status) {
        sql += ` AND p.status = $${paramIndex++}`;
        params.push(status);
    }

    // Filter by project_group
    if (project_group) {
        sql += ` AND p.project_group = $${paramIndex++}`;
        params.push(project_group);
    }

    // Filter by month (creation or due date)
    if (month) {
        const monthFilter = monthType === 'due' ? 'due_date' : 'create_date';
        sql += ` AND TO_CHAR(p.${monthFilter}, 'YYYY-MM') = $${paramIndex++}`;
        params.push(month); // Format: 'YYYY-MM'
    }

    // Search by name
    if (search) {
        sql += ` AND p.name ILIKE $${paramIndex++}`;
        params.push(`%${search}%`);
    }

    sql += " ORDER BY p.create_date DESC";

    try {
        const result = await engPool.query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Get single project by ID
 */
const GetProjectById = async (req, res) => {
    const user = req.user || {};
    const projectId = req.params.id;

    const sql = `SELECT p.*, u.u_name as owner_name 
                 FROM pm_project p 
                 LEFT JOIN m_user_profile u ON p.owner_u_code = u.u_code 
                 WHERE p.id = $1`;

    try {
        const result = await engPool.query(sql, [projectId]);
        const project = result.rows[0];

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check RBAC
        if (!canViewProject(user, project)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ data: project });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Create new project with role-based validation
 */
const CreateProject = async (req, res) => {
    const { name, parent_id, owner_id, priority, project_group, due_date, member_ids, is_private } = req.body;
    const user = req.user || {};

    if (!name) {
        return res.status(400).json({ error: "Name is required" });
    }

    // Validate creation permission with group restrictions
    const createResult = canCreateProject(user, { project_group, owner_id });
    if (!createResult.allowed) {
        return res.status(403).json({ error: createResult.reason });
    }

    const p_type = createResult.p_type;

    // If p_type = 0 (personal), owner must be current user
    const finalOwnerId = p_type === 0 ? user.u_code : (owner_id || user.u_code); // user.u_code mapping instead of user.id potentially mapped elsewhere
    // For personal projects, group is user's own group
    const finalGroup = p_type === 0 ? (user.u_group || project_group) : project_group;

    const sql = `INSERT INTO pm_project (name, parent_id, owner_u_code, status, p_type, priority, project_group, due_date, is_private) 
                 VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8) RETURNING id`;

    const client = await engPool.connect();

    try {
        await client.query('BEGIN');

        const projResult = await client.query(sql, [
            name, parent_id || null, finalOwnerId, p_type, priority || 2, finalGroup,
            due_date ? moment(due_date).format('YYYY-MM-DD HH:mm:ss') : null,
            is_private ? true : false
        ]);

        const newProjectId = projResult.rows[0].id;

        // Add owner as first member (admin role)
        await client.query('INSERT INTO pm_project_member (project_id, u_code, role) VALUES ($1, $2, $3)',
            [newProjectId, finalOwnerId, 'admin']);

        // Add additional members if provided
        if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
            for (const memberId of member_ids) {
                if (memberId !== finalOwnerId) {
                    await client.query('INSERT INTO pm_project_member (project_id, u_code, role) VALUES ($1, $2, $3)',
                        [newProjectId, memberId, 'member']
                    );
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            data: {
                id: newProjectId,
                name,
                parent_id,
                owner_id: finalOwnerId,
                status: 1,
                p_type,
                priority: priority || 2,
                project_group: finalGroup,
                due_date,
                is_private: is_private ? true : false
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Update Project
 */
const UpdateProject = async (req, res) => {
    const { name, parent_id, owner_id, priority, project_group, status, start_date, checked_date, finished_date, due_date, member_ids, is_private } = req.body;

    const sql = `UPDATE pm_project SET 
        name = COALESCE($1, name), 
        parent_id = COALESCE($2, parent_id),
        owner_u_code = COALESCE($3, owner_u_code),
        priority = COALESCE($4, priority),
        project_group = COALESCE($5, project_group),
        status = COALESCE($6, status),
        start_date = COALESCE($7, start_date),
        checked_date = COALESCE($8, checked_date),
        finished_date = COALESCE($9, finished_date),
        due_date = COALESCE($10, due_date),
        is_private = COALESCE($11, is_private),
        updated_at = NOW()
        WHERE id = $12`;

    const client = await engPool.connect();

    try {
        await client.query('BEGIN');

        const projParams = [
            name,
            parent_id || null,
            owner_id,
            priority,
            project_group,
            status,
            start_date ? moment(start_date).format('YYYY-MM-DD HH:mm:ss') : null,
            checked_date ? moment(checked_date).format('YYYY-MM-DD HH:mm:ss') : null,
            finished_date ? moment(finished_date).format('YYYY-MM-DD HH:mm:ss') : null,
            due_date ? moment(due_date).format('YYYY-MM-DD HH:mm:ss') : null,
            is_private !== undefined ? (is_private ? true : false) : null,
            req.params.id
        ];

        const result = await client.query(sql, projParams);

        // Update Members if member_ids provided
        if (member_ids && Array.isArray(member_ids)) {
            const projectId = req.params.id;
            const finalOwnerId = owner_id;

            // Delete existing members
            await client.query("DELETE FROM pm_project_member WHERE project_id = $1", [projectId]);

            // Re-insert Owner (Admin)
            if (finalOwnerId) {
                await client.query("INSERT INTO pm_project_member (project_id, u_code, role) VALUES ($1, $2, 'admin')", [projectId, finalOwnerId]);
            }

            // Insert Members
            if (member_ids.length > 0) {
                for (const uid of member_ids) {
                    if (uid !== finalOwnerId) {
                        try {
                            await client.query("INSERT INTO pm_project_member (project_id, u_code, role) VALUES ($1, $2, 'member')", [projectId, uid]);
                        } catch (memberErr) {
                            // ignore duplicate users if passed in array
                            if (memberErr.code !== '23505') throw memberErr;
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Project updated successfully", changes: result.rowCount });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Delete project
 */
const DeleteProject = async (req, res) => {
    const sql = "DELETE FROM pm_project WHERE id = $1";
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ==================== PROJECT MEMBERS ====================

/**
 * Get project members
 */
const GetProjectMembers = async (req, res) => {
    const sql = `SELECT u.*, pm.role, pm.added_date 
                 FROM m_user_profile u
                 JOIN pm_project_member pm ON u.u_code = pm.u_code
                 WHERE pm.project_id = $1
                 ORDER BY pm.role DESC, u.u_name`;

    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Add project member
 */
const AddProjectMember = async (req, res) => {
    const { user_id, role } = req.body;
    const project_id = req.params.id;

    const sql = `INSERT INTO pm_project_member (project_id, u_code, role) VALUES ($1, $2, $3) RETURNING id`;

    try {
        const result = await engPool.query(sql, [project_id, user_id, role || 'member']);
        res.json({
            message: 'Member added successfully',
            id: result.rows[0].id,
            project_id,
            user_id,
            role: role || 'member'
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Remove project member
 */
const RemoveProjectMember = async (req, res) => {
    const { user_id } = req.body;
    const project_id = req.params.id;

    const sql = 'DELETE FROM pm_project_member WHERE project_id = $1 AND u_code = $2';

    try {
        const result = await engPool.query(sql, [project_id, user_id]);
        res.json({ message: 'Member removed successfully', changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ==================== TASKS ====================

/**
 * Get tasks by project with member check
 */
const GetTasksByProject = async (req, res) => {
    const projectId = req.params.id;
    const user = req.user || {};

    try {
        const sql = `SELECT t.*, u.u_name as assignee_name 
                     FROM pm_task t
                     LEFT JOIN m_user_profile u ON t.assignee_u_code = u.u_code
                     WHERE t.project_id = $1 
                     ORDER BY t.position ASC, t.create_date ASC`;

        const result = await engPool.query(sql, [projectId]);
        res.json({ data: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create task
 */
const CreateTask = async (req, res) => {
    const project_id = req.params.id || req.body.project_id;
    const { name, description, memo, status, priority, task_type, assignee_id, wait_for_task_id, wait_status_required, due_date, problem, solution } = req.body;

    if (!project_id || !name) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = `INSERT INTO pm_task (project_id, name, description, memo, status, priority, task_type, assignee_u_code, wait_for_task_id, wait_status_required, due_date, problem, solution) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`;

    try {
        const result = await engPool.query(sql, [
            project_id,
            name,
            description,
            memo,
            status || 1,
            priority || 2,
            task_type || 0,
            assignee_id,
            wait_for_task_id,
            wait_status_required,
            due_date ? moment(due_date).format('YYYY-MM-DD HH:mm:ss') : null,
            problem,
            solution
        ]);

        res.json({
            data: {
                id: result.rows[0].id,
                project_id,
                name,
                description,
                memo,
                status: status || 1,
                priority: priority || 2,
                task_type: task_type || 0,
                assignee_id,
                wait_for_task_id,
                wait_status_required,
                due_date,
                problem,
                solution
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Update task with permission check
 */
const UpdateTask = async (req, res) => {
    const taskId = req.params.id;
    const user = req.user || {};
    const { name, description, memo, status, priority, assignee_id, wait_for_task_id, wait_status_required, due_date, problem, solution, start_date, checked_date, finished_date } = req.body;

    // Use regular PG query to get the old task for permission checking
    const client = await engPool.connect();

    try {
        const taskRes = await client.query('SELECT * FROM pm_task WHERE id = $1', [taskId]);
        const task = taskRes.rows[0];

        if (!task) {
            client.release();
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user is project member
        const memRes = await client.query('SELECT COUNT(*) as count FROM pm_project_member WHERE project_id = $1 AND u_code = $2', [task.project_id, user.u_code]);
        const isMember = parseInt(memRes.rows[0].count) > 0;

        if (!isMember) {
            client.release();
            return res.status(403).json({ error: 'Not a member of this project' });
        }

        // Check edit permission using rbac middleware helper function (it expects properties from old task, mapped manually here just in case)
        const oldTaskMap = { ...task, assignee_id: task.assignee_u_code };
        const userMap = { ...user, id: user.u_code };

        if (!canEditTask(userMap, oldTaskMap, true)) {
            client.release();
            return res.status(403).json({
                error: 'This task is assigned to someone else',
                assignee_id: task.assignee_u_code
            });
        }

        // Perform update
        const sql = `UPDATE pm_task SET 
            name = COALESCE($1, name), 
            description = COALESCE($2, description),
            memo = COALESCE($3, memo),
            status = COALESCE($4, status),
            priority = COALESCE($5, priority),
            assignee_u_code = COALESCE($6, assignee_u_code),
            wait_for_task_id = COALESCE($7, wait_for_task_id),
            wait_status_required = COALESCE($8, wait_status_required),
            due_date = COALESCE($9, due_date),
            problem = COALESCE($10, problem),
            solution = COALESCE($11, solution),
            start_date = COALESCE($12, start_date),
            checked_date = COALESCE($13, checked_date),
            finished_date = COALESCE($14, finished_date),
            updated_at = NOW()
            WHERE id = $15`;

        const result = await client.query(sql, [
            name,
            description,
            memo,
            status,
            priority,
            assignee_id,
            wait_for_task_id,
            wait_status_required,
            due_date ? moment(due_date).format('YYYY-MM-DD HH:mm:ss') : null,
            problem,
            solution,
            start_date ? moment(start_date).format('YYYY-MM-DD HH:mm:ss') : null,
            checked_date ? moment(checked_date).format('YYYY-MM-DD HH:mm:ss') : null,
            finished_date ? moment(finished_date).format('YYYY-MM-DD HH:mm:ss') : null,
            taskId
        ]);

        res.json({ message: "Updated", changes: result.rowCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        // Important: release the client back to the pool in finally block
        if (client) client.release();
    }
};

/**
 * Reorder tasks (drag and drop in Kanban)
 */
const ReorderTasks = async (req, res) => {
    const tasks = req.body.todos || req.body.tasks || req.body;

    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: "Invalid data" });
    }

    const client = await engPool.connect();

    try {
        await client.query("BEGIN");

        for (const task of tasks) {
            const sql = `UPDATE pm_task SET 
                position = $1, 
                status = $2, 
                start_date = COALESCE($3, start_date),
                checked_date = COALESCE($4, checked_date),
                finished_date = COALESCE($5, finished_date),
                updated_at = NOW()
                WHERE id = $6`;

            await client.query(sql, [
                task.position,
                task.status,
                task.start_date ? moment(task.start_date).format('YYYY-MM-DD HH:mm:ss') : null,
                task.checked_date ? moment(task.checked_date).format('YYYY-MM-DD HH:mm:ss') : null,
                task.finished_date ? moment(task.finished_date).format('YYYY-MM-DD HH:mm:ss') : null,
                task.id
            ]);
        }

        await client.query("COMMIT");
        res.json({ message: "Reordered successfully" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Failed to update positions:", err.message);
        res.status(500).json({ error: "Failed to update positions" });
    } finally {
        client.release();
    }
};

/**
 * Delete task
 */
const DeleteTask = async (req, res) => {
    const sql = "DELETE FROM pm_task WHERE id = $1";
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ==================== TEMPLATES ====================

/**
 * Get all templates
 */
const GetTemplates = async (req, res) => {
    const { project_group } = req.query;

    let sql = 'SELECT t.*, u.u_name as created_by_name FROM pm_template t LEFT JOIN m_user_profile u ON t.created_by_code = u.u_code WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (project_group) {
        sql += ` AND (t.project_group = $${paramIndex++} OR t.project_group IS NULL)`;
        params.push(project_group);
    }

    sql += ' ORDER BY t.created_at DESC';

    try {
        const result = await engPool.query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Get template items
 */
const GetTemplateItems = async (req, res) => {
    const sql = 'SELECT * FROM pm_template_item WHERE template_id = $1 ORDER BY position ASC';
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Create template
 */
const CreateTemplate = async (req, res) => {
    const { name, description, project_group, items } = req.body;
    const user = req.user || {};

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const client = await engPool.connect();

    try {
        await client.query("BEGIN");

        const sql = 'INSERT INTO pm_template (name, description, project_group, created_by_code) VALUES ($1, $2, $3, $4) RETURNING id';
        const result = await client.query(sql, [name, description, project_group, user.u_code]);
        const templateId = result.rows[0].id;

        // Add items if provided
        if (items && Array.isArray(items) && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await client.query('INSERT INTO pm_template_item (template_id, name, description, position, wait_for_item_id, priority) VALUES ($1, $2, $3, $4, $5, $6)',
                    [templateId, item.name, item.description, item.position || i, item.wait_for_item_id, item.priority || 2]);
            }
        }

        await client.query("COMMIT");
        res.json({ data: { id: templateId, name, description, project_group } });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/**
 * Apply template to project (create tasks from template)
 */
const ApplyTemplate = async (req, res) => {
    const { template_id, project_id } = req.body;

    if (!template_id || !project_id) {
        return res.status(400).json({ error: 'Template ID and Project ID required' });
    }

    const client = await engPool.connect();

    try {
        await client.query("BEGIN");

        // Get template items
        const itemsRes = await client.query('SELECT * FROM pm_template_item WHERE template_id = $1 ORDER BY position ASC', [template_id]);
        const items = itemsRes.rows;

        if (items.length === 0) {
            client.release();
            return res.status(400).json({ error: 'Template has no items' });
        }

        // Create tasks from template items
        const itemIdMap = new Map(); // Map template item ID to new task ID

        for (const item of items) {
            const result = await client.query('INSERT INTO pm_task (project_id, name, description, position, priority, task_type, wait_for_task_id) VALUES ($1, $2, $3, $4, $5, 1, $6) RETURNING id',
                [project_id, item.name, item.description, item.position, item.priority, null]);
            itemIdMap.set(item.id, result.rows[0].id);
        }

        // Update dependencies
        for (const item of items) {
            if (item.wait_for_item_id) {
                const newTaskId = itemIdMap.get(item.id);
                const waitForTaskId = itemIdMap.get(item.wait_for_item_id);

                if (newTaskId && waitForTaskId) {
                    await client.query('UPDATE pm_task SET wait_for_task_id = $1 WHERE id = $2', [waitForTaskId, newTaskId]);
                }
            }
        }

        await client.query("COMMIT");
        res.json({ message: `Created ${items.length} tasks from template`, count: items.length });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ==================== DASHBOARD & STATS ====================

/**
 * Close Project
 */
const CloseProject = async (req, res) => {
    const { skipReview } = req.body;
    const projectId = req.params.id;
    const newStatus = skipReview ? 5 : 4; // 5 = Done, 4 = Check
    const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

    const sql = `UPDATE pm_project SET 
        status = $1,
        ${skipReview ? 'finished_date' : 'checked_date'} = COALESCE(${skipReview ? 'finished_date' : 'checked_date'}, $2),
        updated_at = NOW()
        WHERE id = $3`;

    try {
        const result = await engPool.query(sql, [newStatus, currentTime, projectId]);
        res.json({
            message: skipReview ? 'Project completed successfully' : 'Project sent for review',
            status: newStatus,
            changes: result.rowCount
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Get Project Statistics
 * Status: 1=todo, 2=assign, 3=in_progress, 4=check, 5=done
 */
const GetProjectStats = async (req, res) => {
    const projectId = req.params.id;

    const sql = `SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as todo_tasks,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as assigned_tasks,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END) as check_tasks,
        SUM(CASE WHEN status = 5 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN due_date < NOW() AND status NOT IN (4, 5) THEN 1 ELSE 0 END) as overdue_tasks
        FROM pm_task WHERE project_id = $1`;

    try {
        const result = await engPool.query(sql, [projectId]);
        const row = result.rows[0];

        const total = parseInt(row.total_tasks) || 0;
        const completed = parseInt(row.completed_tasks) || 0;
        const checkTasks = parseInt(row.check_tasks) || 0;
        const progress = total > 0 ? Math.round(((completed + checkTasks) / total) * 100) : 0;

        res.json({
            data: {
                ...row,
                progress_percentage: progress,
                all_tasks_done: total > 0 && (completed + checkTasks) === total
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Get Dashboard Data with RBAC
 */
const GetDashboardData = async (req, res) => {
    const user = req.user || {};

    // Apply RBAC filter
    const rbacFilter = getProjectVisibilityFilter(user);
    const params = [];
    let paramIndex = 1;
    let rbacClauseProject = '';
    let rbacClauseTask = '';

    if (rbacFilter.clause) {
        let clauseProject = rbacFilter.clause;
        let clauseTask = rbacFilter.clause;

        // mapping owners
        clauseTask = clauseTask.replace('owner_id', 't.owner_u_code'); // Not perfectly equivalent, projects owns it, wait see task table.
        // It's 'owner_id' inside the function, let's fix it below manually.

        for (const p of rbacFilter.params) {
            clauseProject = clauseProject.replace('?', `$${paramIndex}`);
            clauseTask = clauseTask.replace('?', `$${paramIndex}`);
            params.push(p);
            paramIndex++;
        }
        rbacClauseProject = clauseProject; // p.owner_u_code will be inside rbacFilter function? no, it's 'owner_id'.

        // Fixing 'owner_id' generated by helper function to 'owner_u_code' in postgres
        rbacClauseProject = rbacClauseProject.replace(/owner_id/g, 'owner_u_code');
        rbacClauseTask = rbacClauseTask.replace(/owner_id/g, 'p.owner_u_code');
        rbacClauseTask = rbacClauseTask.replace(/project_group/g, 'p.project_group');
    }

    let projectSql = `SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN p.status != 5 THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN p.status = 4 THEN 1 ELSE 0 END) as pending_review,
        SUM(CASE WHEN p.status = 5 THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN TO_CHAR(p.create_date, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') THEN 1 ELSE 0 END) as this_month
        FROM pm_project p WHERE 1=1 ${rbacClauseProject}`;

    try {
        const projResult = await engPool.query(projectSql, params);
        const projectStats = projResult.rows[0];

        // Get task stats with RBAC
        let taskSql = `SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN t.status IN (1, 2, 3) THEN 1 ELSE 0 END) as active_tasks,
            SUM(CASE WHEN t.status = 5 THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN (4, 5) THEN 1 ELSE 0 END) as overdue_tasks
            FROM pm_task t
            JOIN pm_project p ON t.project_id = p.id
            WHERE 1=1 ${rbacClauseTask}`;

        const taskResult = await engPool.query(taskSql, params);
        const taskStats = taskResult.rows[0];

        res.json({
            data: {
                ...projectStats,
                ...taskStats
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * Get Detailed Dashboard Data: Problems/Solutions grouped by project, per-group stats
 */
const GetDashboardDetailData = async (req, res) => {
    const user = req.user || {};
    const rbacFilter = getProjectVisibilityFilter(user);

    const params = [];
    let paramIndex = 1;
    let rbacClauseProject = '';
    let rbacClauseJoined = '';

    if (rbacFilter.clause) {
        rbacClauseProject = rbacFilter.clause;
        for (const p of rbacFilter.params) {
            rbacClauseProject = rbacClauseProject.replace('?', `$${paramIndex++}`);
            params.push(p);
        }
        rbacClauseProject = rbacClauseProject.replace(/owner_id/g, 'owner_u_code');

        rbacClauseJoined = rbacClauseProject;
        rbacClauseJoined = rbacClauseJoined.replace(/owner_u_code/g, 'p.owner_u_code');
        rbacClauseJoined = rbacClauseJoined.replace(/project_group/g, 'p.project_group');
    }

    // 1. Get all projects (with task counts) visible to user
    const projectsSql = `SELECT p.*, u.u_name as owner_name,
        (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id AND status = 5) as completed_tasks,
        (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id AND status IN (1,2,3)) as active_tasks,
        (SELECT COUNT(*) FROM pm_task WHERE project_id = p.id AND due_date < NOW() AND status NOT IN (4,5)) as overdue_tasks
        FROM pm_project p LEFT JOIN m_user_profile u ON p.owner_u_code = u.u_code
        WHERE 1=1 ${rbacClauseProject}
        ORDER BY p.project_group, p.create_date DESC`;

    try {
        const projResult = await engPool.query(projectsSql, params);
        const projects = projResult.rows;

        // 2. Get all tasks that have problem or solution recorded
        let fixedProblemsSql = `SELECT t.id as task_id, t.name as task_name, t.status as task_status,
            t.priority as task_priority, t.problem, t.solution, t.create_date as task_create_date,
            t.due_date as task_due_date, t.finished_date as task_finished_date,
            t.project_id, p.name as project_name, p.project_group,
            u.u_name as assignee_name
            FROM pm_task t
            JOIN pm_project p ON t.project_id = p.id
            LEFT JOIN m_user_profile u ON t.assignee_u_code = u.u_code
            WHERE (t.problem IS NOT NULL AND t.problem != '' OR t.solution IS NOT NULL AND t.solution != '')
            ${rbacClauseJoined} ORDER BY p.project_group, p.name, t.create_date DESC`;

        const problemTasksResult = await engPool.query(fixedProblemsSql, params);
        const problemTasks = problemTasksResult.rows;

        // 3. Get per-group aggregated stats
        let groupStatsSql = `SELECT 
            COALESCE(p.project_group, 'General') as group_name,
            COUNT(DISTINCT p.id) as total_projects,
            COUNT(DISTINCT CASE WHEN p.status != 5 THEN p.id END) as active_projects,
            COUNT(DISTINCT CASE WHEN p.status = 5 THEN p.id END) as completed_projects,
            (SELECT COUNT(*) FROM pm_task t2 WHERE t2.project_id IN (SELECT p2.id FROM pm_project p2 WHERE COALESCE(p2.project_group, 'General') = COALESCE(p.project_group, 'General'))) as total_tasks,
            (SELECT COUNT(*) FROM pm_task t2 WHERE t2.project_id IN (SELECT p2.id FROM pm_project p2 WHERE COALESCE(p2.project_group, 'General') = COALESCE(p.project_group, 'General')) AND t2.status = 5) as completed_tasks,
            (SELECT COUNT(*) FROM pm_task t2 WHERE t2.project_id IN (SELECT p2.id FROM pm_project p2 WHERE COALESCE(p2.project_group, 'General') = COALESCE(p.project_group, 'General')) AND (t2.problem IS NOT NULL AND t2.problem != '')) as tasks_with_problems
            FROM pm_project p
            WHERE 1=1 ${rbacClauseProject}
            GROUP BY COALESCE(p.project_group, 'General')
            ORDER BY group_name`;

        const groupStatsResult = await engPool.query(groupStatsSql, params);
        const groupStats = groupStatsResult.rows;

        // 4. Get status distribution across all tasks
        let statusDistSql = `SELECT t.status, COUNT(*) as count
            FROM pm_task t
            JOIN pm_project p ON t.project_id = p.id
            WHERE 1=1 ${rbacClauseJoined}
            GROUP BY t.status`;

        const statusDistResult = await engPool.query(statusDistSql, params);
        const statusDist = statusDistResult.rows;

        // Group problem tasks by project
        const problemsByProject = {};
        problemTasks.forEach(task => {
            if (!problemsByProject[task.project_id]) {
                problemsByProject[task.project_id] = {
                    project_id: task.project_id,
                    project_name: task.project_name,
                    project_group: task.project_group || 'General',
                    tasks: []
                };
            }
            problemsByProject[task.project_id].tasks.push(task);
        });

        res.json({
            data: {
                projects: projects,
                group_stats: groupStats,
                problems_by_project: Object.values(problemsByProject),
                status_distribution: statusDist
            }
        });

    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    // Projects
    GetProjects,
    GetProjectById,
    CreateProject,
    UpdateProject,
    DeleteProject,
    CloseProject,
    GetProjectStats,
    GetDashboardData,
    GetDashboardDetailData,

    // Project Members
    GetProjectMembers,
    AddProjectMember,
    RemoveProjectMember,

    // Tasks
    GetTasksByProject,
    CreateTask,
    UpdateTask,
    DeleteTask,
    ReorderTasks,

    // Templates
    GetTemplates,
    GetTemplateItems,
    CreateTemplate,
    ApplyTemplate
};
