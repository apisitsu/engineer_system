const { engPool } = require('../../../instance/eng_db');
const moment = require('moment');

// Get all projects with optional filters
const GetProjects = async (req, res) => {
    const { status, section, includeCompleted } = req.query;

    let sql = "SELECT * FROM pm_project WHERE p_type = 0"; // assuming old todos are type 0 or not filtered
    const params = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
        // old sqlite status was string: 'active', 'pending_review'
        // Need to translate or just map it. 'active' => 1, 'pending_review' => 4
        let s = 1;
        if (status === 'pending_review') s = 4;
        if (status === 'completed') s = 5;

        sql += ` AND status = $${paramIndex++}`;
        params.push(s);
    } else if (!includeCompleted || includeCompleted === 'false') {
        // By default, show only active and pending_review projects
        sql += ` AND status IN (1, 4)`;
    }

    // Filter by section (for Auth level 2)
    if (section) {
        sql += ` AND project_group = $${paramIndex++}`;
        params.push(section);
    }

    sql += " ORDER BY create_date DESC";

    try {
        const result = await engPool.query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Create project
const CreateProject = async (req, res) => {
    const { name, due_date, section, created_by } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // mapping section -> project_group, created_by -> owner_u_code
    const sql = `INSERT INTO pm_project (name, due_date, project_group, owner_u_code, status, p_type) 
                 VALUES ($1, $2, $3, $4, 1, 0) RETURNING id`;

    try {
        const result = await engPool.query(sql, [name, due_date, section, created_by || '']);
        res.json({
            data: {
                id: result.rows[0].id,
                name,
                due_date,
                section,
                created_by,
                status: 'active'
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Update Project
const UpdateProject = async (req, res) => {
    const { name, due_date, start_date, finished_date, status, section } = req.body;

    let mappedStatus = null;
    if (status === 'active') mappedStatus = 1;
    if (status === 'pending_review') mappedStatus = 4;
    if (status === 'completed') mappedStatus = 5;

    const sql = `UPDATE pm_project SET 
        name = COALESCE($1, name), 
        due_date = COALESCE($2, due_date),
        start_date = COALESCE($3, start_date),
        finished_date = COALESCE($4, finished_date),
        status = COALESCE($5, status),
        project_group = COALESCE($6, project_group),
        updated_at = NOW()
        WHERE id = $7`;

    try {
        const result = await engPool.query(sql, [name, due_date, start_date, finished_date, mappedStatus, section, req.params.id]);
        res.json({ message: "Project updated successfully", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Delete project
const DeleteProject = async (req, res) => {
    const sql = "DELETE FROM pm_project WHERE id = $1";
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Get todos by project
const GetTodosByProject = async (req, res) => {
    const sql = "SELECT * FROM pm_task WHERE project_id = $1 ORDER BY position ASC, create_date ASC";
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Create todo (แก้ให้รับ ID จาก URL ได้)
const CreateTodo = async (req, res) => {
    // รับ project_id จาก URL หรือ Body
    const project_id = req.params.id || req.body.project_id;
    const { title, description, status, due_date, problem, solution, start_date, finished_date, is_manual_start, is_manual_finish, priority } = req.body;

    if (!project_id || !title) return res.status(400).json({ error: "Missing required fields" });

    // mapped status todo->1, in_progress->3, done->5
    let mappedStatus = 1;
    if (status === 'in_progress') mappedStatus = 3;
    if (status === 'done') mappedStatus = 5;

    let mappedPriority = 2; // low=1, normal=2, high=3?
    if (priority === 'low') mappedPriority = 1;
    if (priority === 'medium') mappedPriority = 2;
    if (priority === 'high') mappedPriority = 3;

    const sql = "INSERT INTO pm_task (project_id, name, description, status, due_date, problem, solution, start_date, finished_date, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id";
    try {
        const result = await engPool.query(sql, [project_id, title, description, mappedStatus, due_date, problem, solution, start_date, finished_date, mappedPriority]);
        res.json({
            data: { id: result.rows[0].id, project_id, title, description, status: status || 'todo', due_date, problem, solution, start_date, finished_date, is_manual_start: is_manual_start || 0, is_manual_finish: is_manual_finish || 0, priority: priority || 'low' }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Update todo
const UpdateTodo = async (req, res) => {
    const { title, description, status, due_date, problem, solution, start_date, finished_date, is_manual_start, is_manual_finish, priority } = req.body;

    let mappedStatus = null;
    if (status === 'todo') mappedStatus = 1;
    if (status === 'in_progress') mappedStatus = 3;
    if (status === 'done') mappedStatus = 5;

    let mappedPriority = null;
    if (priority === 'low') mappedPriority = 1;
    if (priority === 'medium') mappedPriority = 2;
    if (priority === 'high') mappedPriority = 3;

    const sql = `UPDATE pm_task SET 
    name = COALESCE($1, name), 
    description = COALESCE($2, description), 
    status = COALESCE($3, status),
    due_date = COALESCE($4, due_date),
    problem = COALESCE($5, problem),
    solution = COALESCE($6, solution),
    start_date = COALESCE($7, start_date),
    finished_date = COALESCE($8, finished_date),
    priority = COALESCE($9, priority),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = $10`;

    try {
        const result = await engPool.query(sql, [title, description, mappedStatus, due_date, problem, solution, start_date, finished_date, mappedPriority, req.params.id]);
        res.json({ message: "Updated", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Reorder todos (แก้ Logic Async)
const ReorderTodos = async (req, res) => {
    const todos = req.body.todos || req.body; // รับทั้งแบบ {todos:[]} หรือ []

    if (!Array.isArray(todos)) return res.status(400).json({ error: "Invalid data" });

    const client = await engPool.connect();

    try {
        await client.query("BEGIN");
        for (const todo of todos) {

            let mappedStatus = null;
            if (todo.status === 'todo') mappedStatus = 1;
            if (todo.status === 'in_progress') mappedStatus = 3;
            if (todo.status === 'done') mappedStatus = 5;

            const sql = `UPDATE pm_task SET 
            position = $1, 
            status = $2, 
            start_date = COALESCE($3, start_date),
            finished_date = COALESCE($4, finished_date),
            updated_at = CURRENT_TIMESTAMP 
            WHERE id = $5`;
            await client.query(sql, [todo.position, mappedStatus || 1, todo.start_date, todo.finished_date, todo.id]);
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

// Delete todo
const DeleteTodo = async (req, res) => {
    const sql = "DELETE FROM pm_task WHERE id = $1";
    try {
        const result = await engPool.query(sql, [req.params.id]);
        res.json({ message: "Deleted", changes: result.rowCount });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Close Project (set to pending_review or completed)
const CloseProject = async (req, res) => {
    const { skipReview } = req.body;
    const projectId = req.params.id;
    const newStatus = skipReview ? 5 : 4; // 5 completed, 4 pending_review
    const currentTime = new Date().toISOString();

    const sql = `UPDATE pm_project SET 
        status = $1,
        finished_date = COALESCE(finished_date, $2),
        updated_at = NOW()
        WHERE id = $3`;

    try {
        const result = await engPool.query(sql, [newStatus, currentTime, projectId]);
        res.json({
            message: skipReview ? 'Project completed successfully' : 'Project sent for review',
            status: skipReview ? 'completed' : 'pending_review',
            changes: result.rowCount
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Get Project Statistics
const GetProjectStats = async (req, res) => {
    const projectId = req.params.id;

    // mapped status: 5=done, 3=in progress, 1=todo
    const sql = `SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 5 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as todo_tasks,
        SUM(CASE WHEN due_date < NOW() AND status != 5 THEN 1 ELSE 0 END) as overdue_tasks
        FROM pm_task WHERE project_id = $1`;

    try {
        const result = await engPool.query(sql, [projectId]);
        const row = result.rows[0];

        const total = parseInt(row.total_tasks) || 0;
        const completed = parseInt(row.completed_tasks) || 0;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        res.json({
            data: {
                ...row,
                progress_percentage: progress,
                all_tasks_done: total > 0 && completed === total
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

// Get Dashboard Data
const GetDashboardData = async (req, res) => {
    const { section } = req.query;

    let projectSql = `SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END) as pending_review,
        SUM(CASE WHEN status = 5 THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN TO_CHAR(create_date, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') THEN 1 ELSE 0 END) as this_month
        FROM pm_project WHERE 1=1`;

    const params = [];
    if (section) {
        projectSql += " AND project_group = $1";
        params.push(section);
    }

    try {
        const projResult = await engPool.query(projectSql, params);
        const projectStats = projResult.rows[0];

        let taskSql = `SELECT COUNT(*) as overdue_tasks 
            FROM pm_task 
            WHERE due_date < NOW() AND status != 5`;

        let taskResult;
        if (section) {
            taskSql += ` AND project_id IN (SELECT id FROM pm_project WHERE project_group = $1)`;
            taskResult = await engPool.query(taskSql, [section]);
        } else {
            taskResult = await engPool.query(taskSql);
        }

        const taskStats = taskResult.rows[0];

        res.json({
            data: {
                ...projectStats,
                overdue_tasks: taskStats.overdue_tasks || 0
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    GetProjects,
    CreateProject,
    UpdateProject,
    DeleteProject,
    CloseProject,
    GetProjectStats,
    GetDashboardData,
    GetTodosByProject,
    CreateTodo,
    UpdateTodo,
    DeleteTodo,
    ReorderTodos
};