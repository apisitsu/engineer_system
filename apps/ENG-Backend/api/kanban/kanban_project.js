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
    const { name, description, background_type, background_value, is_hidden, is_private, pm_project_id, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`
            INSERT INTO kb_project (owner_u_code, pm_project_id, name, description, background_type, background_value, is_hidden, is_private, icon)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
        `, [uCode, pm_project_id || null, name, description || null, background_type || null, background_value || null, is_hidden || false, is_private || false, icon || null]);

        const project = rows[0];

        // Owner is project manager
        await client.query(
            "INSERT INTO kb_project_membership (project_id, u_code, role) VALUES ($1,$2,'owner')",
            [project.id, uCode]
        );
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

    const { name, description, background_type, background_value, is_hidden, is_private, icon } = req.body;
    try {
        const { rows } = await engPool.query(`
            UPDATE kb_project SET
                name             = COALESCE($1, name),
                description      = COALESCE($2, description),
                background_type  = COALESCE($3, background_type),
                background_value = COALESCE($4, background_value),
                is_hidden        = COALESCE($5, is_hidden),
                icon             = COALESCE($6, icon),
                is_private       = COALESCE($7, is_private)
            WHERE id = $8 RETURNING *
        `, [name, description, background_type, background_value, is_hidden, icon, is_private, id]);
        res.json({ data: rows[0] });
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
    const r = await engPool.query(
        "SELECT * FROM kb_project_membership WHERE project_id=$1 AND u_code=$2 AND role='owner'", [id, uCode]
    );
    if (!r.rows.length) return res.status(403).json({ error: 'Only project owner can delete' });

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
};
