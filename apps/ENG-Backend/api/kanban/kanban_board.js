/**
 * kanban_board.js
 * Kanban Board + List API
 * Route prefix: /api/kanban/boards, /api/kanban/projects/:id/boards
 */
const { engPool } = require('../../instance/eng_db');
const { insertToPositionables } = require('./positionHelper');
const {
    canAccessProject, canManageProject, canSeeAllProjects,
    isSuperAdmin, isManagerOrCoord,
    canManageBoard, canEditBoard, getBoardMembership, isProjectMember,
} = require('./kanban_acl');

// ─── HELPERS ───────────────────────────────────────────────────────

// Compute next float position (insert at end)
const getNextPosition = async (table, filterCol, filterVal) => {
    const r = await engPool.query(
        `SELECT COALESCE(MAX(position), 0) + 65536 AS next_pos FROM ${table} WHERE ${filterCol} = $1`,
        [filterVal]
    );
    return r.rows[0].next_pos;
};

// ─── BOARD CONTROLLERS ─────────────────────────────────────────────

// GET /api/kanban/projects/:projectId/boards
const GetBoards = async (req, res) => {
    const { projectId } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const canAccess = await canAccessProject(req, projectId);
        // Determine global override access
        const globalOverride = await canManageProject(req, projectId); // True for AD, Project Owner, MGR/COORD (public only)

        if (!canAccess && !globalOverride) {
            // Need to check if they are at least a board member
            const boardMemberCount = await engPool.query('SELECT 1 FROM kb_board_membership WHERE project_id=$1 AND u_code=$2 LIMIT 1', [projectId, uCode]);
            if (boardMemberCount.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
        }

        const query = `
            SELECT b.*,
                   mbr.role AS user_role,
                   mbr.can_comment
            FROM kb_board b
            LEFT JOIN kb_board_membership mbr ON mbr.board_id = b.id AND mbr.u_code = $2
            WHERE b.project_id = $1
              AND (
                  $3 = TRUE OR -- Global Override
                  mbr.u_code = $2 OR -- Explicit Board Member
                  (b.is_private = FALSE AND $4 = TRUE) -- Standard Board + Project Access
              )
            ORDER BY b.position ASC
        `;
        const params = [projectId, uCode, globalOverride, canAccess];

        const { rows } = await engPool.query(query, params);
        res.json({ data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/projects/:projectId/boards
const CreateBoard = async (req, res) => {
    const { projectId } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const canAccess = await canAccessProject(req, projectId);
    if (!canAccess && !(await isProjectMember(projectId, uCode)))
        return res.status(403).json({ error: 'Only project managers can create boards' });

    const { name, default_view, default_card_type, limit_card_types,
        always_display_card_creator, expand_task_lists_by_default, is_private } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        const position = await getNextPosition('kb_board', 'project_id', projectId);
        const { rows: [board] } = await client.query(`
            INSERT INTO kb_board (project_id, position, name, default_view, default_card_type, limit_card_types,
                                  always_display_card_creator, expand_task_lists_by_default, is_private)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
        `, [projectId, position, name, default_view || 'kanban', default_card_type || 'task', limit_card_types || false,
            always_display_card_creator || false, expand_task_lists_by_default || false, is_private || false]);

        // Add creator as owner of this board
        await client.query(`
            INSERT INTO kb_board_membership (board_id, project_id, u_code, role)
            VALUES ($1,$2,$3,'owner')
        `, [board.id, projectId, uCode]);

        // Create default lists: To Do, In Progress, Done, + archive, trash
        const defaultLists = [
            { name: 'To Do', type: 'active', pos: 65536 },
            { name: 'In Progress', type: 'active', pos: 131072 },
            { name: 'Check', type: 'active', pos: 196608 },
            { name: 'Done', type: 'closed', pos: 262144 },
            { name: null, type: 'archive', pos: null },
            { name: null, type: 'trash', pos: null },
        ];
        for (const l of defaultLists) {
            await client.query(
                'INSERT INTO kb_list (board_id, list_type, position, name) VALUES ($1,$2,$3,$4)',
                [board.id, l.type, l.pos, l.name]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ data: board });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// GET /api/kanban/boards/:id  — full board data (lists + cards summary)
const GetBoard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows: [board] } = await engPool.query('SELECT * FROM kb_board WHERE id=$1', [id]);
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const mbr = await getBoardMembership(id, uCode);
        const globalOverride = await canManageProject(req, board.project_id);
        const canAccess = await canAccessProject(req, board.project_id);

        // Block access to private boards if user is not a member and has no override
        if (board.is_private && !mbr && !globalOverride) {
            return res.status(403).json({ error: 'Access denied to private board' });
        }
        if (!board.is_private && !canAccess && !globalOverride && !mbr) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { rows: lists } = await engPool.query(
            "SELECT * FROM kb_list WHERE board_id=$1 ORDER BY list_type ASC, position ASC", [id]
        );
        const { rows: labels } = await engPool.query(
            "SELECT * FROM kb_label WHERE board_id=$1 ORDER BY position ASC", [id]
        );
        const { rows: members } = await engPool.query(
            "SELECT * FROM kb_board_membership WHERE board_id=$1", [id]
        );

        res.json({ data: { ...board, lists, labels, members, user_role: mbr?.role || 'manager' } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/boards/:id
const UpdateBoard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await canManageBoard(req, id))) {
        return res.status(403).json({ error: 'Only board owners or project managers can update this board' });
    }

    const { name, default_view, default_card_type, limit_card_types, position,
        background_type, background_value,
        always_display_card_creator, expand_task_lists_by_default, is_private } = req.body;

    // Support explicit removal: frontend sends '__REMOVE__' to clear a field
    const bgType = background_type === '__REMOVE__' ? null : background_type;
    const bgValue = background_value === '__REMOVE__' ? null : background_value;
    const useBgType = background_type === '__REMOVE__';
    const useBgValue = background_value === '__REMOVE__';

    try {
        const { rows } = await engPool.query(`
            UPDATE kb_board SET
                name              = COALESCE($1, name),
                default_view      = COALESCE($2, default_view),
                default_card_type = COALESCE($3, default_card_type),
                limit_card_types  = COALESCE($4, limit_card_types),
                position          = COALESCE($5, position),
                background_type   = ${useBgType ? '$6' : 'COALESCE($6, background_type)'},
                background_value  = ${useBgValue ? '$7' : 'COALESCE($7, background_value)'},
                always_display_card_creator  = COALESCE($8, always_display_card_creator),
                expand_task_lists_by_default = COALESCE($9, expand_task_lists_by_default),
                is_private                   = COALESCE($10, is_private)
            WHERE id=$11 RETURNING *
        `, [name, default_view, default_card_type, limit_card_types, position,
            bgType, bgValue,
            always_display_card_creator, expand_task_lists_by_default, is_private, id]);
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/kanban/boards/:id
const DeleteBoard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await canManageBoard(req, id))) {
        return res.status(403).json({ error: 'Only board owners or project managers can delete this board' });
    }
    try {
        await engPool.query('DELETE FROM kb_board WHERE id=$1', [id]);
        res.json({ message: 'Board deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── BOARD MEMBERSHIP ──────────────────────────────────────────────

// GET /api/kanban/boards/:id/members
const GetBoardMembers = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_board_membership WHERE board_id=$1 ORDER BY role ASC', [id]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/boards/:id/members
const AddBoardMember = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { target_u_code, role, can_comment } = req.body;

    if (!(await canManageBoard(req, id))) {
        return res.status(403).json({ error: 'Only board owners or project managers can manage members' });
    }

    const { rows: [board] } = await engPool.query('SELECT project_id FROM kb_board WHERE id=$1', [id]);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    try {
        const { rows } = await engPool.query(`
            INSERT INTO kb_board_membership (board_id, project_id, u_code, role, can_comment)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (board_id, u_code)
                DO UPDATE SET role=EXCLUDED.role, can_comment=EXCLUDED.can_comment, updated_at=NOW()
            RETURNING *
        `, [id, board.project_id, target_u_code, role || 'viewer', can_comment ?? null]);

        // Auto-cascade to Project Member (as viewer) if not already explicitly in the project
        await engPool.query(`
            INSERT INTO kb_project_membership (project_id, u_code, role)
            VALUES ($1, $2, 'viewer')
            ON CONFLICT (project_id, u_code) DO NOTHING
        `, [board.project_id, target_u_code]);

        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/kanban/boards/:id/members
const RemoveBoardMember = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { target_u_code } = req.body;

    // Prevent removing owner unless user passes override (handled lightly here by requiring them to be at least board owner)
    // Actually, maybe project managers can demote board owners. For now let's just use canManageBoard.
    if (!(await canManageBoard(req, id))) {
        return res.status(403).json({ error: 'Only board owners or project managers can manage members' });
    }

    try {
        await engPool.query('DELETE FROM kb_board_membership WHERE board_id=$1 AND u_code=$2', [id, target_u_code]);
        res.json({ message: 'Member removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── LIST CONTROLLERS ──────────────────────────────────────────────

// GET /api/kanban/boards/:boardId/lists
const GetLists = async (req, res) => {
    const { boardId } = req.params;
    try {
        const { rows } = await engPool.query(
            "SELECT * FROM kb_list WHERE board_id=$1 ORDER BY list_type ASC, position ASC", [boardId]
        );
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/boards/:boardId/lists
const CreateList = async (req, res) => {
    const { boardId } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await canEditBoard(req, boardId))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const position = await getNextPosition('kb_list', 'board_id', boardId);
    try {
        const { rows } = await engPool.query(`
            INSERT INTO kb_list (board_id, list_type, position, name, color)
            VALUES ($1,'active',$2,$3,$4) RETURNING *
        `, [boardId, position, name, color || null]);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/lists/:id
const UpdateList = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [list] } = await engPool.query('SELECT board_id FROM kb_list WHERE id=$1', [id]);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (!(await canEditBoard(req, list.board_id))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const { name, color, position } = req.body;
    try {
        const { rows } = await engPool.query(`
            UPDATE kb_list SET
                name     = COALESCE($1, name),
                color    = COALESCE($2, color),
                position = COALESCE($3, position)
            WHERE id=$4 RETURNING *
        `, [name, color, position, id]);
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/kanban/lists/:id
const DeleteList = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { rows: [list] } = await engPool.query('SELECT * FROM kb_list WHERE id=$1', [id]);
    if (!list) return res.status(404).json({ error: 'List not found' });
    // Prevent deleting archive/trash lists
    if (['archive', 'trash'].includes(list.list_type))
        return res.status(400).json({ error: 'Cannot delete system lists (archive/trash)' });
    if (!(await canEditBoard(req, list.board_id))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }
    try {
        await engPool.query('DELETE FROM kb_list WHERE id=$1', [id]);
        res.json({ message: 'List deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── LABEL CONTROLLERS ─────────────────────────────────────────────

// GET /api/kanban/boards/:boardId/labels
const GetLabels = async (req, res) => {
    const { boardId } = req.params;
    const { rows } = await engPool.query('SELECT * FROM kb_label WHERE board_id=$1 ORDER BY position ASC', [boardId]);
    res.json({ data: rows });
};

// POST /api/kanban/boards/:boardId/labels
const CreateLabel = async (req, res) => {
    const { boardId } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await canEditBoard(req, boardId))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const { name, color } = req.body;
    if (!color) return res.status(400).json({ error: 'color is required' });
    const position = await getNextPosition('kb_label', 'board_id', boardId);
    const { rows } = await engPool.query(
        'INSERT INTO kb_label (board_id, position, name, color) VALUES ($1,$2,$3,$4) RETURNING *',
        [boardId, position, name || null, color]
    );
    res.status(201).json({ data: rows[0] });
};

// PATCH /api/kanban/labels/:id
const UpdateLabel = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [label] } = await engPool.query('SELECT board_id FROM kb_label WHERE id=$1', [id]);
    if (!label) return res.status(404).json({ error: 'Label not found' });

    if (!(await canEditBoard(req, label.board_id))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const { name, color } = req.body;
    const { rows } = await engPool.query(
        'UPDATE kb_label SET name=COALESCE($1,name), color=COALESCE($2,color) WHERE id=$3 RETURNING *',
        [name, color, id]
    );
    res.json({ data: rows[0] });
};

// DELETE /api/kanban/labels/:id
const DeleteLabel = async (req, res) => {
    const { id } = req.params;
    await engPool.query('DELETE FROM kb_label WHERE id=$1', [id]);
    res.json({ message: 'Label deleted' });
};

// ─── LIST REORDER (Drag & Drop) ────────────────────────────────────

// PATCH /api/kanban/boards/:boardId/lists/reorder
const ReorderLists = async (req, res) => {
    const { boardId } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { list_id, position } = req.body;

    if (!list_id || position === undefined) {
        return res.status(400).json({ error: 'list_id and position are required' });
    }

    if (!(await canEditBoard(req, boardId))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Get all sibling lists (excluding the one being moved), only finite lists
        const { rows: siblings } = await client.query(
            `SELECT id, position FROM kb_list
             WHERE board_id=$1 AND id!=$2 AND list_type IN ('active','closed')
             ORDER BY position ASC`,
            [boardId, list_id]
        );

        const { position: newPosition, repositions } = insertToPositionables(position, siblings);

        // Apply repositions for colliding siblings
        for (const repo of repositions) {
            await client.query(
                'UPDATE kb_list SET position=$1 WHERE id=$2',
                [repo.position, repo.record.id]
            );
        }

        // Update the target list's position
        await client.query(
            'UPDATE kb_list SET position=$1 WHERE id=$2 AND board_id=$3',
            [newPosition, list_id, boardId]
        );

        await client.query('COMMIT');

        // Return updated lists
        const { rows: lists } = await engPool.query(
            `SELECT * FROM kb_list WHERE board_id=$1 ORDER BY list_type ASC, position ASC`,
            [boardId]
        );

        // Broadcast via WebSocket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`board:${boardId}`).emit('listUpdate', { lists });
        }

        res.json({ data: lists });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── BOARD SUBSCRIPTION (Feature 6) ───────────────────────────────

// POST /api/kanban/boards/:id/subscription
const ToggleBoardSubscription = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows } = await engPool.query(
            'SELECT id FROM kb_board_subscription WHERE board_id=$1 AND u_code=$2', [id, uCode]
        );
        if (rows.length > 0) {
            await engPool.query('DELETE FROM kb_board_subscription WHERE board_id=$1 AND u_code=$2', [id, uCode]);
            res.json({ subscribed: false });
        } else {
            await engPool.query(
                'INSERT INTO kb_board_subscription (board_id, u_code) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [id, uCode]
            );
            res.json({ subscribed: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── LIST SORT (Feature 7) ────────────────────────────────────────

// POST /api/kanban/lists/:id/sort
const SortListCards = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { sort_by } = req.body; // 'name', 'due_date', 'created_at'

    const { rows: [list] } = await engPool.query('SELECT board_id FROM kb_list WHERE id=$1', [id]);
    if (!list) return res.status(404).json({ error: 'List not found' });

    if (!(await canEditBoard(req, list.board_id))) {
        return res.status(403).json({ error: 'Editor permission required' });
    }

    const orderCol = sort_by === 'due_date' ? 'due_date' : sort_by === 'created_at' ? 'created_at' : 'name';

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows: cards } = await client.query(
            `SELECT id FROM kb_card WHERE list_id=$1 ORDER BY ${orderCol} ASC NULLS LAST`, [id]
        );
        // Reassign positions with GAP spacing
        for (let i = 0; i < cards.length; i++) {
            await client.query('UPDATE kb_card SET position=$1 WHERE id=$2', [(i + 1) * 65536, cards[i].id]);
        }
        await client.query('COMMIT');

        const { rows: sorted } = await engPool.query(`
            SELECT c.*,
                   ARRAY(SELECT u_code FROM kb_card_membership WHERE card_id=c.id) AS assignees,
                   ARRAY(SELECT label_id FROM kb_card_label WHERE card_id=c.id) AS label_ids,
                   (SELECT COUNT(*) FROM kb_task_list tl
                    JOIN kb_task t ON t.task_list_id=tl.id
                    WHERE tl.card_id=c.id AND t.is_completed=TRUE) AS completed_tasks,
                   (SELECT COUNT(*) FROM kb_task_list tl
                    JOIN kb_task t ON t.task_list_id=tl.id
                    WHERE tl.card_id=c.id) AS total_tasks,
                   (
                       SELECT COALESCE(json_agg(
                           json_build_object('id', t.id, 'name', t.name, 'is_completed', t.is_completed)
                           ORDER BY tl.position ASC, t.position ASC
                       ), '[]'::json)
                       FROM kb_task_list tl
                       JOIN kb_task t ON t.task_list_id=tl.id
                       WHERE tl.card_id=c.id
                   ) AS tasks,
                   (SELECT COUNT(*) FROM kb_comment WHERE card_id=c.id) AS comment_count,
                   (SELECT COUNT(*) FROM kb_attachment WHERE card_id=c.id) AS attachment_count
            FROM kb_card c
            WHERE c.list_id=$1
            ORDER BY c.position ASC
        `, [id]);
        res.json({ data: sorted });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};
// ─── USER PREFERENCES (Feature 9) ─────────────────────────────────

// GET /api/kanban/user-preferences
const GetUserPreferences = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows } = await engPool.query(`
            SELECT subscribe_to_own_cards, subscribe_to_card_when_commenting,
                   turn_off_recent_card_highlighting, enable_favorites_by_default,
                   default_editor_mode, default_home_view, default_projects_order,
                   is_notification_off, pref_language
            FROM m_user_profile WHERE u_code=$1
        `, [uCode]);
        if (!rows.length) return res.status(404).json({ error: 'User profile not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/user-preferences
const UpdateUserPreferences = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const {
        subscribe_to_own_cards, subscribe_to_card_when_commenting,
        turn_off_recent_card_highlighting, enable_favorites_by_default,
        default_editor_mode, default_home_view, default_projects_order,
        is_notification_off, pref_language
    } = req.body;
    try {
        const { rows } = await engPool.query(`
            UPDATE m_user_profile SET
                subscribe_to_own_cards            = COALESCE($1, subscribe_to_own_cards),
                subscribe_to_card_when_commenting = COALESCE($2, subscribe_to_card_when_commenting),
                turn_off_recent_card_highlighting = COALESCE($3, turn_off_recent_card_highlighting),
                enable_favorites_by_default       = COALESCE($4, enable_favorites_by_default),
                default_editor_mode               = COALESCE($5, default_editor_mode),
                default_home_view                 = COALESCE($6, default_home_view),
                default_projects_order            = COALESCE($7, default_projects_order),
                is_notification_off               = COALESCE($8, is_notification_off),
                pref_language                     = COALESCE($9, pref_language)
            WHERE u_code=$10 RETURNING *
        `, [subscribe_to_own_cards, subscribe_to_card_when_commenting,
            turn_off_recent_card_highlighting, enable_favorites_by_default,
            default_editor_mode, default_home_view, default_projects_order,
            is_notification_off, pref_language, uCode]);
        if (!rows.length) return res.status(404).json({ error: 'User profile not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    // Board
    GetBoards, CreateBoard, GetBoard, UpdateBoard, DeleteBoard,
    // Board Members
    GetBoardMembers, AddBoardMember, RemoveBoardMember,
    // Board Subscription
    ToggleBoardSubscription,
    // List
    GetLists, CreateList, UpdateList, DeleteList, ReorderLists,
    // List Sort
    SortListCards,
    // Labels
    GetLabels, CreateLabel, UpdateLabel, DeleteLabel,
    // User Preferences
    GetUserPreferences, UpdateUserPreferences,
};
