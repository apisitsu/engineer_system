/**
 * kanban_project.js
 * Kanban Project API — CRUD + Manager + Favorite
 * Route prefix: /api/kanban/projects
 */
const { engPool } = require('../../instance/eng_db');

const {
    isSuperAdmin, canSeeAllProjects, canManageProject, isProjectMember, canAccessProject
} = require('./kanban_acl');


// ─── GET /api/kanban/projects ──────────────────────────────────────
const GetProjects = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const admin = await isSuperAdmin(req);
        const seeAll = !admin && await canSeeAllProjects(req);

        let query, params;
        if (admin) {
            // AD → see ALL projects (including private)
            query = `
                SELECT p.*,
                       pm.role,
                       pf.id IS NOT NULL AS is_favorite,
                       (SELECT COUNT(*) FROM kb_board WHERE project_id = p.id) AS board_count
                FROM kb_project p
                LEFT JOIN kb_project_membership pm ON pm.project_id = p.id AND pm.u_code = $1
                LEFT JOIN kb_project_favorite pf ON pf.project_id = p.id AND pf.u_code = $1
                ORDER BY p.created_at DESC
            `;
            params = [uCode];
        } else if (seeAll) {
            // MGR / COORD → see all NON-private projects + private projects they are a member of
            query = `
                SELECT p.*,
                       pm.role,
                       pf.id IS NOT NULL AS is_favorite,
                       (SELECT COUNT(*) FROM kb_board WHERE project_id = p.id) AS board_count
                FROM kb_project p
                LEFT JOIN kb_project_membership pm ON pm.project_id = p.id AND pm.u_code = $1
                LEFT JOIN kb_project_favorite pf ON pf.project_id = p.id AND pf.u_code = $1
                WHERE p.is_private = FALSE
                   OR pm.u_code = $1
                ORDER BY p.created_at DESC
            `;
            params = [uCode];
        } else {
            // Regular user → only projects where they are a member
            query = `
                SELECT p.*,
                       pm.role,
                       pf.id IS NOT NULL AS is_favorite,
                       (SELECT COUNT(*) FROM kb_board WHERE project_id = p.id) AS board_count
                FROM kb_project p
                INNER JOIN kb_project_membership pm ON pm.project_id = p.id AND pm.u_code = $1
                LEFT JOIN kb_project_favorite pf ON pf.project_id = p.id AND pf.u_code = $1
                ORDER BY p.created_at DESC
            `;
            params = [uCode];
        }

        const { rows } = await engPool.query(query, params);
        res.json({ data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/kanban/projects/:id ─────────────────────────────────
const GetProjectById = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows } = await engPool.query(`
            SELECT p.*,
                   pm.role,
                   pf.id IS NOT NULL AS is_favorite
            FROM kb_project p
            LEFT JOIN kb_project_membership pm ON pm.project_id = p.id AND pm.u_code = $2
            LEFT JOIN kb_project_favorite pf ON pf.project_id = p.id AND pf.u_code = $2
            WHERE p.id = $1
        `, [id, uCode]);
        if (!rows[0]) return res.status(404).json({ error: 'Project not found' });

        const project = rows[0];
        const isMember = project.role != null;

        // Private project: only members + AD can access
        if (project.is_private && !isMember) {
            const admin = await isSuperAdmin(req);
            if (!admin) {
                return res.status(403).json({ error: 'Access denied: private project' });
            }
        }
        // Non-private project: members + AD/MGR/COORD can access
        else if (!isMember) {
            const seeAll = await canSeeAllProjects(req);
            if (!seeAll) {
                return res.status(403).json({ error: 'Access denied: not a project member' });
            }
        }

        res.json({ data: project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/kanban/projects ─────────────────────────────────────
const CreateProject = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { name, description, background_type, background_value, is_hidden, is_private, pm_project_id, icon, priority, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`
            INSERT INTO kb_project (owner_u_code, pm_project_id, name, description, background_type, background_value, is_hidden, is_private, icon, priority, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, [uCode, pm_project_id || null, name, description || null, background_type || null, background_value || null, is_hidden || false, is_private || false, icon || null, priority || 'medium', status || 'active']);

        const project = rows[0];

        // Owner is project manager (Skip if Waiting Pool)
        if (String(project.status).toLowerCase() !== 'waiting') {
            await client.query(
                "INSERT INTO kb_project_membership (project_id, u_code, role) VALUES ($1,$2,'owner')",
                [project.id, uCode]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ data: project });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── PATCH /api/kanban/projects/:id ────────────────────────────────
const UpdateProject = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!(await canManageProject(req, id)))
        return res.status(403).json({ error: 'Only project owners or admins can update' });

    const { name, description, background_type, background_value, is_hidden, is_private, icon, priority, status } = req.body;
    try {
        // Get old status to detect transition
        const oldProjectRes = await engPool.query('SELECT status FROM kb_project WHERE id = $1', [id]);
        const oldStatus = oldProjectRes.rows[0]?.status;

        const { rows } = await engPool.query(`
            UPDATE kb_project SET
                name             = COALESCE($1, name),
                description      = COALESCE($2, description),
                background_type  = COALESCE($3, background_type),
                background_value = COALESCE($4, background_value),
                is_hidden        = COALESCE($5, is_hidden),
                icon             = COALESCE($6, icon),
                is_private       = COALESCE($7, is_private),
                priority         = COALESCE($8, priority),
                status           = COALESCE($9, status)
            WHERE id = $10 RETURNING *
        `, [name, description, background_type, background_value, is_hidden, icon, is_private, priority, status, id]);
        
        const updatedProject = rows[0];

        // Check if transition to active from waiting
        if (status && status.toLowerCase() === 'active' && oldStatus && oldStatus.toLowerCase() === 'waiting') {
            const members = await engPool.query("SELECT u_code FROM kb_project_membership WHERE project_id=$1", [id]);
            for (const member of members.rows) {
                // Avoid notifying the actor themselves if they are the one changing it, though sometimes it's good to notify anyway.
                if (member.u_code !== uCode) {
                    await engPool.query(`
                        INSERT INTO kb_notification (recipient_u_code, actor_u_code, notif_type, notif_data)
                        VALUES ($1, $2, 'project_activated', $3)
                    `, [
                        member.u_code, 
                        uCode, 
                        JSON.stringify({ project_id: id, project_name: updatedProject.name, message: 'Project moved from Waiting Pool to Active.' })
                    ]);
                }
            }
        }

        res.json({ data: updatedProject });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/kanban/projects/:id ───────────────────────────────
const DeleteProject = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!(await canManageProject(req, id)))
        return res.status(403).json({ error: 'Only project owners or admins can delete' });

    try {
        await engPool.query('DELETE FROM kb_project WHERE id = $1', [id]);
        res.json({ message: 'Project deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/kanban/projects/:id/favorite ────────────────────────
const ToggleFavorite = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const canAccess = await canAccessProject(req, id);
        if (!canAccess) return res.status(403).json({ error: 'Forbidden' });

        const existing = await engPool.query(
            'SELECT id FROM kb_project_favorite WHERE project_id=$1 AND u_code=$2', [id, uCode]
        );
        if (existing.rows.length) {
            await engPool.query('DELETE FROM kb_project_favorite WHERE project_id=$1 AND u_code=$2', [id, uCode]);
            res.json({ is_favorite: false });
        } else {
            await engPool.query('INSERT INTO kb_project_favorite (project_id, u_code) VALUES ($1,$2)', [id, uCode]);
            res.json({ is_favorite: true });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/kanban/users ─────────────────────────────────────────
const GetUsers = async (req, res) => {
    try {
        const { rows } = await engPool.query(
            `SELECT u_code, u_name, u_nickname, profile_img_b64
             FROM m_user_profile
             ORDER BY u_name NULLS LAST`
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/kanban/projects/:id/managers ─────────────────────────
const GetManagers = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await engPool.query(
            "SELECT * FROM kb_project_membership WHERE project_id=$1 ORDER BY CASE WHEN role='owner' THEN 1 WHEN role='editor' THEN 2 ELSE 3 END", [id]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/kanban/projects/:id/managers ────────────────────────
const AddManager = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { target_u_code, role } = req.body;

    if (!(await canManageProject(req, id)))
        return res.status(403).json({ error: 'Only project owners or admins can manage members' });

    try {
        await engPool.query(
            `INSERT INTO kb_project_membership (project_id, u_code, role) VALUES ($1,$2,$3) 
             ON CONFLICT (project_id, u_code) DO UPDATE SET role = EXCLUDED.role`,
            [id, target_u_code, role || 'viewer']
        );
        res.json({ message: 'Manager added' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/kanban/projects/:id/managers ──────────────────────
const RemoveManager = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { target_u_code, force } = req.body;
    // Cannot remove owner
    const ownerCheck = await engPool.query(
        "SELECT role FROM kb_project_membership WHERE project_id=$1 AND u_code=$2", [id, target_u_code]
    );
    if (ownerCheck.rows[0]?.role === 'owner') return res.status(400).json({ error: 'Cannot remove project owner' });

    if (!(await canManageProject(req, id)))
        return res.status(403).json({ error: 'Only project owners or admins can remove members' });

    try {
        if (!force) {
            const boardsRes = await engPool.query(`
                SELECT b.id, b.name 
                FROM kb_board_membership bm 
                JOIN kb_board b ON bm.board_id = b.id 
                WHERE b.project_id=$1 AND bm.u_code=$2
            `, [id, target_u_code]);

            const cardsRes = await engPool.query(`
                SELECT c.id, c.name, b.name AS board_name
                FROM kb_card_membership cm 
                JOIN kb_card c ON cm.card_id = c.id
                JOIN kb_list l ON c.list_id = l.id
                JOIN kb_board b ON l.board_id = b.id
                WHERE b.project_id=$1 AND cm.u_code=$2
            `, [id, target_u_code]);

            if (boardsRes.rows.length > 0 || cardsRes.rows.length > 0) {
                return res.json({
                    requires_confirmation: true,
                    boards: boardsRes.rows,
                    cards: cardsRes.rows
                });
            }
        }

        const client = await engPool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                DELETE FROM kb_card_membership 
                WHERE u_code=$2 AND card_id IN (
                    SELECT c.id FROM kb_card c
                    JOIN kb_list l ON c.list_id = l.id
                    JOIN kb_board b ON l.board_id = b.id
                    WHERE b.project_id=$1
                )
            `, [id, target_u_code]);

            await client.query(`
                DELETE FROM kb_board_membership 
                WHERE u_code=$2 AND board_id IN (
                    SELECT id FROM kb_board WHERE project_id=$1
                )
            `, [id, target_u_code]);

            await client.query(
                'DELETE FROM kb_project_membership WHERE project_id=$1 AND u_code=$2', [id, target_u_code]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ message: 'Manager removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/kanban/projects/:id/report-data ─────────────────────
// Aggregates all boards, lists, cards, issues, actions, labels, members for report generation
const GetReportData = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Verify access
        const canAccess = await canAccessProject(req, id);
        if (!canAccess) return res.status(403).json({ error: 'Access denied' });

        // 1. Get project info
        const { rows: [project] } = await engPool.query('SELECT * FROM kb_project WHERE id = $1', [id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // 2. Get all boards for project
        const { rows: boards } = await engPool.query(
            'SELECT * FROM kb_board WHERE project_id = $1 ORDER BY created_at', [id]
        );

        // 3. For each board, get lists, cards (with metadata), labels, and actions
        const enrichedBoards = [];

        for (const board of boards) {
            // Lists
            const { rows: lists } = await engPool.query(
                "SELECT * FROM kb_list WHERE board_id = $1 AND list_type IN ('active','closed') ORDER BY position", [board.id]
            );

            // Cards per list with aggregated data
            const enrichedLists = [];
            for (const list of lists) {
                const { rows: cards } = await engPool.query(`
                    SELECT c.*,
                        ARRAY(SELECT u_code FROM kb_card_membership WHERE card_id=c.id) AS assignees,
                        ARRAY(SELECT label_id FROM kb_card_label WHERE card_id=c.id) AS label_ids,
                        (SELECT COUNT(*) FROM kb_task_list tl
                         JOIN kb_task t ON t.task_list_id=tl.id
                         WHERE tl.card_id=c.id AND t.is_completed=TRUE) AS completed_tasks,
                        (SELECT COUNT(*) FROM kb_task_list tl
                         JOIN kb_task t ON t.task_list_id=tl.id
                         WHERE tl.card_id=c.id) AS total_tasks,
                        (SELECT COUNT(*) FROM kb_card_issue WHERE card_id=c.id) AS issue_count,
                        (
                            SELECT a.created_at
                            FROM kb_action a
                            JOIN kb_list l ON l.id = (NULLIF(a.action_data->>'to_list_id', ''))::integer
                            WHERE a.card_id = c.id AND a.action_type = 'card_moved'
                              AND (lower(l.name) LIKE '%in progress%' OR lower(l.name) LIKE '%working%' OR lower(l.name) LIKE '%กำลังทำ%')
                            ORDER BY a.created_at ASC LIMIT 1
                        ) AS action_in_progress_at,
                        (
                            SELECT a.created_at
                            FROM kb_action a
                            JOIN kb_list l ON l.id = (NULLIF(a.action_data->>'to_list_id', ''))::integer
                            WHERE a.card_id = c.id AND a.action_type = 'card_moved'
                              AND (lower(l.name) LIKE '%done%' OR lower(l.name) LIKE '%completed%' OR lower(l.name) LIKE '%finish%' OR lower(l.name) LIKE '%เสร็จ%')
                            ORDER BY a.created_at DESC LIMIT 1
                        ) AS action_done_at
                    FROM kb_card c
                    WHERE c.list_id = $1
                    ORDER BY c.position ASC
                `, [list.id]);

                // Fetch issues for each card
                for (const card of cards) {
                    const { rows: issues } = await engPool.query(
                        'SELECT * FROM kb_card_issue WHERE card_id = $1 ORDER BY created_at ASC', [card.id]
                    );
                    card.issues = issues;
                }

                enrichedLists.push({ ...list, cards });
            }

            // Labels for this board
            const { rows: labels } = await engPool.query(
                'SELECT * FROM kb_label WHERE board_id = $1 ORDER BY position', [board.id]
            );

            // Activity actions for this board (last 500 for performance)
            const { rows: actions } = await engPool.query(
                'SELECT * FROM kb_action WHERE board_id = $1 ORDER BY created_at DESC LIMIT 500', [board.id]
            );

            enrichedBoards.push({
                ...board,
                lists: enrichedLists,
                labels,
                actions,
            });
        }

        // 4. Get project members
        const { rows: members } = await engPool.query(
            'SELECT pm.*, u.u_name, u.u_nickname, u.profile_img_b64 FROM kb_project_membership pm LEFT JOIN m_user_profile u ON u.u_code = pm.u_code WHERE pm.project_id = $1',
            [id]
        );

        res.json({
            data: {
                project,
                boards: enrichedBoards,
                members,
            }
        });
    } catch (err) {
        console.error('GetReportData error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    GetProjects,
    GetProjectById,
    CreateProject,
    UpdateProject,
    DeleteProject,
    ToggleFavorite,
    GetManagers,
    AddManager,
    RemoveManager,
    GetUsers,
    GetReportData,
};
