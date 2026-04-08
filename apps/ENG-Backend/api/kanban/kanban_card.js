/**
 * kanban_card.js
 * Kanban Card API — CRUD + Membership + Labels + Task Lists + Comments + Attachments
 * Route prefix: /api/kanban/cards, /api/kanban/lists/:id/cards
 */
const { engPool } = require('../../instance/eng_db');
const fs = require('fs');
const path = require('path');
const {
    canAccessProject, canManageProject,
    getBoardMembership, getCardMembership,
    hasBoardLevelOverride, canEditBoard, canEditCard, canManageCard, canViewCard,
} = require('./kanban_acl');
const { insertToPositionables } = require('./positionHelper');

// ─── HELPERS ───────────────────────────────────────────────────────

const logAction = async (client, cardId, uCode, actionType, actionData = {}, boardId = null) => {
    const { rows: [action] } = await client.query(`
        INSERT INTO kb_action (card_id, board_id, u_code, action_type, action_data)
        VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [cardId, boardId, uCode, actionType, JSON.stringify(actionData)]);
    return action.id;
};

const autoSubscribe = async (client, cardId, uCode) => {
    await client.query(`
        INSERT INTO kb_card_subscription (card_id, u_code)
        VALUES ($1,$2) ON CONFLICT DO NOTHING
    `, [cardId, uCode]);
};

// ─── CARD CRUD ─────────────────────────────────────────────────────

// GET /api/kanban/lists/:listId/cards
const GetCards = async (req, res) => {
    const { listId } = req.params;
    const uCode = req.user?.empno;

    try {
        const { rows: [list] } = await engPool.query('SELECT l.board_id, b.project_id FROM kb_list l JOIN kb_board b ON b.id=l.board_id WHERE l.id=$1', [listId]);
        if (!list) return res.status(404).json({ error: 'List not found' });

        const globalOverride = await hasBoardLevelOverride(req, list.board_id);

        const { rows } = await engPool.query(`
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
                   (SELECT COUNT(*) FROM kb_attachment WHERE card_id=c.id) AS attachment_count,
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
                   ) AS action_done_at,
                   c.estimated_hours
            FROM kb_card c
            WHERE c.list_id=$1
              AND (
                  c.is_private = FALSE OR
                  $2 = TRUE OR -- global override
                  EXISTS (SELECT 1 FROM kb_card_membership WHERE card_id=c.id AND u_code=$3)
              )
            ORDER BY c.position ASC
        `, [listId, globalOverride, uCode]);
        res.json({ data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/lists/:listId/cards
const CreateCard = async (req, res) => {
    const { listId } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    const { rows: [list] } = await engPool.query(
        'SELECT l.*, b.project_id FROM kb_list l JOIN kb_board b ON b.id=l.board_id WHERE l.id=$1', [listId]
    );
    if (!list) return res.status(404).json({ error: 'List not found' });
    if (!(await canEditBoard(req, list.board_id)))
        return res.status(403).json({ error: 'Editor permission required' });

    const { name, card_type, description, due_date, is_private, estimated_hours } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Next position
    const posRes = await engPool.query(
        'SELECT COALESCE(MAX(position),0)+65536 AS pos FROM kb_card WHERE list_id=$1', [listId]
    );
    const position = posRes.rows[0].pos;

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [card] } = await client.query(`
            INSERT INTO kb_card (board_id, list_id, creator_u_code, card_type, position, name, description, due_date, is_private, list_changed_at, estimated_hours)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10) RETURNING *
        `, [list.board_id, listId, uCode, card_type || 'task', position, name, description || null, due_date || null, is_private || false, estimated_hours || 0]);

        await client.query("INSERT INTO kb_card_membership (card_id, u_code, role) VALUES ($1, $2, 'owner')", [card.id, uCode]);
        await autoSubscribe(client, card.id, uCode);
        await logAction(client, card.id, uCode, 'card_created', { name, list_id: listId });
        await client.query('COMMIT');
        res.status(201).json({ data: card });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// GET /api/kanban/cards/:id
const GetCard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    try {
        const { rows: [card] } = await engPool.query('SELECT * FROM kb_card WHERE id=$1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });

        if (card.is_private) {
            const globalOverride = await hasBoardLevelOverride(req, card.board_id);
            const { rows: mbr } = await engPool.query('SELECT 1 FROM kb_card_membership WHERE card_id=$1 AND u_code=$2', [id, uCode]);
            if (!globalOverride && mbr.length === 0) {
                return res.status(403).json({ error: 'Access denied to private card' });
            }
        }

        // Fetch all related data in parallel
        const [memberships, labels, taskLists, comments, attachments, subscription, actions, issues] = await Promise.all([
            engPool.query('SELECT * FROM kb_card_membership WHERE card_id=$1', [id]),
            engPool.query('SELECT cl.*, l.name, l.color FROM kb_card_label cl JOIN kb_label l ON l.id=cl.label_id WHERE cl.card_id=$1', [id]),
            engPool.query(`
                SELECT tl.*, COALESCE(
                    JSON_AGG(t.* ORDER BY t.position) FILTER (WHERE t.id IS NOT NULL), '[]'
                ) AS tasks
                FROM kb_task_list tl
                LEFT JOIN kb_task t ON t.task_list_id=tl.id
                WHERE tl.card_id=$1
                GROUP BY tl.id ORDER BY tl.position
            `, [id]),
            engPool.query('SELECT * FROM kb_comment WHERE card_id=$1 ORDER BY created_at ASC', [id]),
            engPool.query('SELECT * FROM kb_attachment WHERE card_id=$1 ORDER BY created_at ASC', [id]),
            engPool.query('SELECT * FROM kb_card_subscription WHERE card_id=$1 AND u_code=$2', [id, uCode]),
            engPool.query('SELECT * FROM kb_action WHERE card_id=$1 ORDER BY created_at DESC LIMIT 50', [id]),
            engPool.query('SELECT * FROM kb_card_issue WHERE card_id=$1 ORDER BY created_at ASC', [id]),
        ]);

        res.json({
            data: {
                ...card,
                memberships: memberships.rows,
                labels: labels.rows,
                task_lists: taskLists.rows,
                comments: comments.rows,
                attachments: attachments.rows,
                subscription: subscription.rows[0] || null,
                actions: actions.rows,
                issues: issues.rows,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/cards/:id
const UpdateCard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    const { rows: [card] } = await engPool.query('SELECT * FROM kb_card WHERE id=$1', [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Subscription toggle — available to all active board members (which we loosely verify)
    // Actually letting any logged in user hit this endpoint is fine since we record their explicit uCode.
    if (Object.keys(req.body).length === 1 && req.body.hasOwnProperty('is_subscribed')) {
        const sub = await engPool.query('SELECT id FROM kb_card_subscription WHERE card_id=$1 AND u_code=$2', [id, uCode]);
        if (req.body.is_subscribed) {
            await engPool.query('INSERT INTO kb_card_subscription (card_id,u_code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, uCode]);
        } else {
            await engPool.query('DELETE FROM kb_card_subscription WHERE card_id=$1 AND u_code=$2', [id, uCode]);
        }
        return res.json({ message: 'Subscription updated' });
    }

    if (!(await canEditCard(req, id))) {
        return res.status(403).json({ error: 'Card editor permission required' });
    }

    const { name, description, due_date, is_due_completed, card_type, is_closed,
        list_id, stopwatch, memo, is_private, estimated_hours } = req.body;

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        let newListId = list_id || card.list_id;
        const listChanged = list_id && list_id !== card.list_id;

        const updateFields = [];
        const updateValues = [];
        let paramIdx = 1;

        if (name !== undefined) { updateFields.push(`name = $${paramIdx++}`); updateValues.push(name); }
        if (description !== undefined) { updateFields.push(`description = $${paramIdx++}`); updateValues.push(description); }
        if (due_date !== undefined) { updateFields.push(`due_date = $${paramIdx++}`); updateValues.push(due_date); }
        if (is_due_completed !== undefined) { updateFields.push(`is_due_completed = $${paramIdx++}`); updateValues.push(is_due_completed); }
        if (card_type !== undefined) { updateFields.push(`card_type = $${paramIdx++}`); updateValues.push(card_type); }
        if (is_closed !== undefined) { updateFields.push(`is_closed = $${paramIdx++}`); updateValues.push(is_closed); }
        if (list_id !== undefined) { updateFields.push(`list_id = $${paramIdx++}`); updateValues.push(newListId); }
        if (stopwatch !== undefined) { updateFields.push(`stopwatch = $${paramIdx++}`); updateValues.push(stopwatch ? JSON.stringify(stopwatch) : null); }
        if (memo !== undefined) { updateFields.push(`memo = $${paramIdx++}`); updateValues.push(memo); }
        if (is_private !== undefined) { updateFields.push(`is_private = $${paramIdx++}`); updateValues.push(is_private); }
        if (estimated_hours !== undefined) { updateFields.push(`estimated_hours = $${paramIdx++}`); updateValues.push(estimated_hours); }

        if (listChanged) {
            updateFields.push(`list_changed_at = NOW()`);
        }

        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.json({ data: card });
        }

        updateValues.push(id);
        const query = `UPDATE kb_card SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING *`;

        const { rows: [updated] } = await client.query(query, updateValues);

        if (listChanged) {
            await logAction(client, id, uCode, 'card_moved', {
                from_list_id: card.list_id, to_list_id: newListId
            });
        }
        if (due_date !== undefined && due_date !== card.due_date) {
            await logAction(client, id, uCode, 'due_date_changed', { new_date: due_date });
        }
        if (memo !== undefined && memo !== card.memo) {
            await logAction(client, id, uCode, 'memo_updated', { memo });
        }
        if (estimated_hours !== undefined && estimated_hours !== card.estimated_hours) {
            await logAction(client, id, uCode, 'estimated_hours_updated', { estimated_hours });
        }
        await logAction(client, id, uCode, 'card_updated', { name, description, is_closed });
        await client.query('COMMIT');
        res.json({ data: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// DELETE /api/kanban/cards/:id
const DeleteCard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { rows: [card] } = await engPool.query('SELECT * FROM kb_card WHERE id=$1', [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (!(await canManageCard(req, id)))
        return res.status(403).json({ error: 'Card manager permission required to delete' });

    try {
        // Get attachments for file cleanup
        const { rows: attachments } = await engPool.query('SELECT file_path FROM kb_attachment WHERE card_id=$1', [id]);
        await engPool.query('DELETE FROM kb_card WHERE id=$1', [id]);
        // Clean up files (non-blocking)
        attachments.forEach(a => {
            const fullPath = path.join(__dirname, '../../../', a.file_path);
            if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => { });
        });
        res.json({ message: 'Card deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/cards/:id/duplicate
const DuplicateCard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [originalCard] } = await client.query('SELECT * FROM kb_card WHERE id=$1', [id]);
        if (!originalCard) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Original card not found' });
        }

        if (!(await canEditBoard(req, originalCard.board_id))) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Editor permission required to duplicate card on this board' });
        }

        const targetListId = originalCard.list_id;

        // Determine new position: right after the original card.
        // We find the card that is currently right after the original card in the same list.
        const { rows: nextCards } = await client.query(
            'SELECT position FROM kb_card WHERE list_id=$1 AND position > $2 AND is_closed = false ORDER BY position ASC LIMIT 1',
            [targetListId, originalCard.position]
        );
        let newPosition;
        if (nextCards.length > 0) {
            newPosition = originalCard.position + (nextCards[0].position - originalCard.position) / 2;
        } else {
            newPosition = originalCard.position + 65536; // Place it at the end if it's the last card
        }

        // Insert new card (without members or comments)
        const newName = originalCard.name + ' (Copy)';
        const { rows: [newCard] } = await client.query(`
            INSERT INTO kb_card (board_id, list_id, creator_u_code, card_type, position, name, description, due_date, is_due_completed, is_closed, stopwatch, memo, list_changed_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *
        `, [
            originalCard.board_id,
            targetListId,
            uCode,
            originalCard.card_type,
            newPosition,
            newName,
            originalCard.description,
            originalCard.due_date,
            originalCard.is_due_completed,
            originalCard.is_closed,
            originalCard.stopwatch,
            originalCard.memo
        ]);

        // Duplicate labels
        await client.query(`
            INSERT INTO kb_card_label (card_id, label_id)
            SELECT $1, label_id FROM kb_card_label WHERE card_id=$2
            ON CONFLICT DO NOTHING
        `, [newCard.id, originalCard.id]);

        // Duplicate task lists and tasks
        const { rows: originalTaskLists } = await client.query('SELECT * FROM kb_task_list WHERE card_id=$1 ORDER BY position', [originalCard.id]);
        for (const originalTaskList of originalTaskLists) {
            const { rows: [newTaskList] } = await client.query(`
                INSERT INTO kb_task_list (card_id, name, position, show_on_front, hide_completed_tasks)
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `, [newCard.id, originalTaskList.name, originalTaskList.position, originalTaskList.show_on_front, originalTaskList.hide_completed_tasks]);

            await client.query(`
                INSERT INTO kb_task (task_list_id, name, position, is_completed)
                SELECT $1, name, position, is_completed FROM kb_task WHERE task_list_id=$2
                ON CONFLICT DO NOTHING
            `, [newTaskList.id, originalTaskList.id]);
        }

        // Log action
        await logAction(client, newCard.id, uCode, 'card_created', { name: newCard.name });

        await client.query('COMMIT');
        res.status(201).json({ data: newCard });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('DuplicateCard error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── CARD MEMBERSHIP ───────────────────────────────────────────────

// POST /api/kanban/cards/:id/memberships
const AddCardMember = async (req, res) => {
    const { id } = req.params;
    const uCode = req.body?.owner_u_code || req.user?.empno || req.query?.u_code || 'LE131';
    console.log(`AddCardMember called for card_id=${id}, uCode=${uCode}, body=`, req.body);
    const { target_u_code } = req.body;
    if (!target_u_code) return res.status(400).json({ error: 'target_u_code is required' });

    const { rows: [card] } = await engPool.query(`
        SELECT c.board_id, b.project_id 
        FROM kb_card c JOIN kb_board b ON b.id = c.board_id 
        WHERE c.id=$1
    `, [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Allow: caller is self-joining (for standard boards?), OR caller has manage powers
    const selfJoin = target_u_code === uCode;
    // For private boards, we shouldn't allow self-join unless they are already a board member (which GetCards filters anyway).
    // Let's rely on canManageCard for adding other users.
    if (!selfJoin && !(await canManageCard(req, id)))
        return res.status(403).json({ error: 'Card manager permission required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            'INSERT INTO kb_card_membership (card_id,u_code) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [id, target_u_code]
        );

        // Auto-cascade to Board Member (as viewer)
        await client.query(`
            INSERT INTO kb_board_membership (board_id, project_id, u_code, role)
            VALUES ($1, $2, $3, 'viewer')
            ON CONFLICT (board_id, u_code) DO NOTHING
        `, [card.board_id, card.project_id, target_u_code]);

        // Auto-cascade to Project Member (as viewer)
        await client.query(`
            INSERT INTO kb_project_membership (project_id, u_code, role)
            VALUES ($1, $2, 'viewer')
            ON CONFLICT (project_id, u_code) DO NOTHING
        `, [card.project_id, target_u_code]);

        // Auto-subscribe (best effort)
        try { await autoSubscribe(client, id, target_u_code); } catch (_) { }
        // Log action (best effort)
        try {
            const actionId = await logAction(client, id, uCode, 'member_added', { u_code: target_u_code });
            // Notify the added member
            if (target_u_code !== uCode) {
                try {
                    await client.query(
                        `INSERT INTO kb_notification 
                         (recipient_u_code, actor_u_code, card_id, action_id, notif_type, board_id) 
                         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
                        [target_u_code, uCode, id, actionId, 'addMemberToCard', card.board_id]
                    ).then(n => {
                        if (n.rows.length > 0 && req.app.get('io')) {
                            req.app.get('io').to(`user:${target_u_code}`).emit('notificationCreate', n.rows[0]);
                        }
                    });
                } catch (_) { }
            }
        } catch (_) { }
        await client.query('COMMIT');

        // Emit card member update to board
        if (req.app.get('io') && card.board_id) {
            req.app.get('io').to(`board:${card.board_id}`).emit('cardUpdate', { id, board_id: card.board_id, member_added: target_u_code });
        }
        res.json({ message: 'Member added' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('AddCardMember error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};


// DELETE /api/kanban/cards/:id/memberships
const RemoveCardMember = async (req, res) => {
    const { id } = req.params;
    const uCode = req.body?.owner_u_code || req.user?.empno || req.query?.u_code || 'LE131';
    console.log(`RemoveCardMember called for card_id=${id}, uCode=${uCode}, body=`, req.body);
    const { target_u_code } = req.body;
    if (!target_u_code) return res.status(400).json({ error: 'target_u_code is required' });

    const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id=$1', [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Allow: caller is leaving (self-remove), OR caller has manage powers
    const selfLeave = target_u_code === uCode;
    if (!selfLeave && !(await canManageCard(req, id)))
        return res.status(403).json({ error: 'Card manager permission required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM kb_card_membership WHERE card_id=$1 AND u_code=$2', [id, target_u_code]);
        try { await logAction(client, id, uCode, 'member_removed', { u_code: target_u_code }); } catch (_) { }
        await client.query('COMMIT');

        // Emit card member update to board
        if (req.app.get('io') && card.board_id) {
            req.app.get('io').to(`board:${card.board_id}`).emit('cardUpdate', { id, board_id: card.board_id, member_removed: target_u_code });
        }
        res.json({ message: 'Member removed' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('RemoveCardMember error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};


// ─── CARD LABELS ────────────────────────────────────────────────────

// POST /api/kanban/cards/:id/labels
const AddCardLabel = async (req, res) => {
    const { id } = req.params;
    const { label_id } = req.body;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });

    await engPool.query('INSERT INTO kb_card_label (card_id,label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, label_id]);
    const { rows: [label] } = await engPool.query('SELECT name FROM kb_label WHERE id=$1', [label_id]);

    if (label) {
        const client = await engPool.connect();
        await logAction(client, id, uCode, 'label_added', { label_id, name: label.name });
        client.release();
    }

    res.json({ message: 'Label added' });
};

// DELETE /api/kanban/cards/:id/labels/:labelId
const RemoveCardLabel = async (req, res) => {
    const { id, labelId } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });

    const { rows: [label] } = await engPool.query('SELECT name FROM kb_label WHERE id=$1', [labelId]);
    await engPool.query('DELETE FROM kb_card_label WHERE card_id=$1 AND label_id=$2', [id, labelId]);

    if (label) {
        const client = await engPool.connect();
        await logAction(client, id, uCode, 'label_removed', { label_id: labelId, name: label.name });
        client.release();
    }

    res.json({ message: 'Label removed' });
};

// ─── TASK LISTS ─────────────────────────────────────────────────────

// GET /api/kanban/cards/:id/task-lists
const GetTaskLists = async (req, res) => {
    const { id } = req.params;
    const { rows } = await engPool.query(`
        SELECT tl.*, COALESCE(
            JSON_AGG(t.* ORDER BY t.position) FILTER (WHERE t.id IS NOT NULL), '[]'
        ) AS tasks
        FROM kb_task_list tl
        LEFT JOIN kb_task t ON t.task_list_id=tl.id
        WHERE tl.card_id=$1
        GROUP BY tl.id ORDER BY tl.position
    `, [id]);
    res.json({ data: rows });
};

// POST /api/kanban/cards/:id/task-lists
const CreateTaskList = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });
    const posRes = await engPool.query('SELECT COALESCE(MAX(position),0)+65536 AS pos FROM kb_task_list WHERE card_id=$1', [id]);

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            'INSERT INTO kb_task_list (card_id,position,name) VALUES ($1,$2,$3) RETURNING *',
            [id, posRes.rows[0].pos, name]
        );
        await logAction(client, id, uCode, 'tasklist_created', { name });
        await client.query('COMMIT');
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// PATCH /api/kanban/task-lists/:id
const UpdateTaskList = async (req, res) => {
    const { id } = req.params;
    const { name, show_on_front, hide_completed_tasks, position } = req.body;
    try {
        const { rows: [list] } = await engPool.query('SELECT card_id FROM kb_task_list WHERE id=$1', [id]);
        if (!list) return res.status(404).json({ error: 'Task list not found' });
        if (!(await canEditCard(req, list.card_id))) return res.status(403).json({ error: 'Card editor permission required' });

        const { rows } = await engPool.query(`
            UPDATE kb_task_list SET
                name                 = COALESCE($1, name),
                show_on_front        = COALESCE($2, show_on_front),
                hide_completed_tasks = COALESCE($3, hide_completed_tasks),
                position             = COALESCE($4, position)
            WHERE id=$5 RETURNING *
        `, [name, show_on_front, hide_completed_tasks, position, id]);
        if (!rows.length) return res.status(404).json({ error: 'Task list not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/task-lists/:id/tasks
const CreateTask = async (req, res) => {
    const { id } = req.params;
    const { name, assignee_u_code, linked_card_id } = req.body;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [list] } = await engPool.query('SELECT card_id FROM kb_task_list WHERE id=$1', [id]);
    if (!list) return res.status(404).json({ error: 'Task list not found' });
    if (!(await canEditCard(req, list.card_id))) return res.status(403).json({ error: 'Card editor permission required' });

    const posRes = await engPool.query('SELECT COALESCE(MAX(position),0)+65536 AS pos FROM kb_task WHERE task_list_id=$1', [id]);
    const { rows } = await engPool.query(
        'INSERT INTO kb_task (task_list_id,position,name,assignee_u_code,linked_card_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [id, posRes.rows[0].pos, name, assignee_u_code || null, linked_card_id || null]
    );

    const client = await engPool.connect();
    try {
        await logAction(client, list.card_id, uCode, 'task_created', { name });
    } finally {
        client.release();
    }

    res.status(201).json({ data: rows[0] });
};

// PATCH /api/kanban/tasks/:id
const UpdateTask = async (req, res) => {
    const { id } = req.params;
    const { name, is_completed, position, assignee_u_code, linked_card_id } = req.body;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    const { rows: [oldTask] } = await engPool.query(`
        SELECT t.*, tl.card_id 
        FROM kb_task t 
        JOIN kb_task_list tl ON t.task_list_id = tl.id 
        WHERE t.id=$1
    `, [id]);
    if (!oldTask) return res.status(404).json({ error: 'Task not found' });
    if (!(await canEditCard(req, oldTask.card_id))) return res.status(403).json({ error: 'Card editor permission required' });

    const { rows } = await engPool.query(`
        UPDATE kb_task SET
            name             = COALESCE($1, name),
            is_completed     = COALESCE($2, is_completed),
            position         = COALESCE($3, position),
            assignee_u_code  = COALESCE($4, assignee_u_code),
            linked_card_id   = COALESCE($5, linked_card_id)
        WHERE id=$6 RETURNING *
    `, [name, is_completed, position, assignee_u_code, linked_card_id, id]);

    if (is_completed !== undefined && is_completed !== oldTask.is_completed) {
        const client = await engPool.connect();
        try {
            await logAction(client, oldTask.card_id, uCode, is_completed ? 'task_checked' : 'task_unchecked', { name: oldTask.name });
        } finally {
            client.release();
        }
    }

    res.json({ data: rows[0] });
};

// DELETE /api/kanban/tasks/:id
const DeleteTask = async (req, res) => {
    const { id } = req.params;
    const { rows: [task] } = await engPool.query(`
        SELECT t.*, tl.card_id 
        FROM kb_task t 
        JOIN kb_task_list tl ON t.task_list_id = tl.id 
        WHERE t.id=$1
    `, [id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!(await canEditCard(req, task.card_id))) return res.status(403).json({ error: 'Card editor permission required' });

    await engPool.query('DELETE FROM kb_task WHERE id=$1', [id]);
    res.json({ message: 'Task deleted' });
};

// DELETE /api/kanban/task-lists/:id
const DeleteTaskList = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: [list] } = await engPool.query('SELECT card_id FROM kb_task_list WHERE id=$1', [id]);
        if (!list) return res.status(404).json({ error: 'Task list not found' });
        if (!(await canEditCard(req, list.card_id))) return res.status(403).json({ error: 'Card editor permission required' });

        await engPool.query('DELETE FROM kb_task WHERE task_list_id=$1', [id]);
        await engPool.query('DELETE FROM kb_task_list WHERE id=$1', [id]);
        res.json({ message: 'Task list deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// ─── COMMENTS ──────────────────────────────────────────────────────

// POST /api/kanban/cards/:id/comments
const AddComment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.body?.owner_u_code || req.user?.empno || req.query?.u_code || 'LE131';
    console.log(`AddComment called for card_id=${id}, uCode=${uCode}, body=`, req.body);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id=$1', [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required to comment' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            'INSERT INTO kb_comment (card_id,u_code,content) VALUES ($1,$2,$3) RETURNING *',
            [id, uCode, content.trim()]
        );
        // Update comments_count if column exists (best effort)
        try {
            await client.query('UPDATE kb_card SET comments_count=COALESCE(comments_count,0)+1 WHERE id=$1', [id]);
        } catch (_) { }

        // Log action & notify mentions (best effort)
        try {
            const comment = rows[0];
            const actionId = await logAction(client, id, uCode, 'comment_added', { comment_id: comment.id });

            // Planka uses @[Username](u_code)
            const mentionedUcodesStr = [...new Set(
                Array.from(content.matchAll(/@\[.*?\]\((.*?)\)/g)).map(m => m[1])
            )];

            // Filter to only those who are members of the board/card
            const mentionedUcodes = mentionedUcodesStr.filter(u => u !== uCode);

            for (const targetUcode of mentionedUcodes) {
                try {
                    await client.query(
                        `INSERT INTO kb_notification 
                         (recipient_u_code, actor_u_code, card_id, action_id, notif_type, board_id, comment_id, notif_data) 
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,
                        [targetUcode, uCode, id, actionId, 'mentionInComment', card.board_id, comment.id, JSON.stringify({ text: content })]
                    ).then(n => {
                        if (n.rows.length > 0 && req.app.get('io')) {
                            req.app.get('io').to(`user:${targetUcode}`).emit('notificationCreate', n.rows[0]);
                        }
                    });
                } catch (_) { }
            }

            // Notify subscribed card members that are NOT mentioned explicitly
            const { rows: subs } = await client.query('SELECT u_code FROM kb_card_subscription WHERE card_id=$1', [id]);
            const subscribedUsers = subs.map(s => s.u_code).filter(u => u !== uCode && !mentionedUcodes.includes(u));
            for (const targetUcode of subscribedUsers) {
                try {
                    await client.query(
                        `INSERT INTO kb_notification 
                         (recipient_u_code, actor_u_code, card_id, action_id, notif_type, board_id, comment_id, notif_data) 
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,
                        [targetUcode, uCode, id, actionId, 'commentCard', card.board_id, comment.id, JSON.stringify({ text: content })]
                    ).then(n => {
                        if (n.rows.length > 0 && req.app.get('io')) {
                            req.app.get('io').to(`user:${targetUcode}`).emit('notificationCreate', n.rows[0]);
                        }
                    });
                } catch (_) { }
            }

            // Broadcast via WebSocket
            const io = req.app.get('io');
            if (io) {
                io.to(`board:${card.board_id}`).emit('commentCreate', {
                    item: comment
                });
            }
        } catch (err) {
            console.error('Notification error', err);
        }

        await client.query('COMMIT');
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('AddComment error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};


// PATCH /api/kanban/comments/:id
const UpdateComment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { content } = req.body;
    const { rows: [comment] } = await engPool.query('SELECT * FROM kb_comment WHERE id=$1', [id]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.u_code !== uCode) return res.status(403).json({ error: 'Can only edit own comments' });
    const { rows } = await engPool.query(
        'UPDATE kb_comment SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [content, id]
    );

    const io = req.app.get('io');
    if (io && comment.card_id) {
        // Need board_id to broadcast
        const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id=$1', [comment.card_id]);
        if (card) {
            io.to(`board:${card.board_id}`).emit('commentUpdate', {
                item: rows[0]
            });
        }
    }

    res.json({ data: rows[0] });
};

// DELETE /api/kanban/comments/:id
const DeleteComment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { rows: [comment] } = await engPool.query('SELECT * FROM kb_comment WHERE id=$1', [id]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Owner or card editor can delete
    const { rows: [card] } = await engPool.query('SELECT board_id, is_private FROM kb_card WHERE id=$1', [comment.card_id]);
    const canDelete = comment.u_code === uCode || await canManageCard(req, comment.card_id);
    if (!canDelete) return res.status(403).json({ error: 'Permission denied' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM kb_comment WHERE id=$1', [id]);
        await client.query('UPDATE kb_card SET comments_count=GREATEST(0,comments_count-1) WHERE id=$1', [comment.card_id]);
        await client.query('COMMIT');

        const io = req.app.get('io');
        if (io) {
            io.to(`board:${card.board_id}`).emit('commentDelete', {
                item: { id }
            });
        }

        res.json({ message: 'Comment deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── ATTACHMENTS ────────────────────────────────────────────────────

// POST /api/kanban/cards/:id/attachments  (uses express-fileupload or link)
const UploadAttachment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });

    // Support link-type attachments
    if (req.body.attachment_type === 'link') {
        const { url, name } = req.body;
        if (!url) return res.status(400).json({ error: 'url is required for link attachments' });
        const linkData = { url, name: name || url };
        const { rows } = await engPool.query(`
            INSERT INTO kb_attachment (card_id, creator_u_code, attachment_type, file_name, file_path, link_data)
            VALUES ($1,$2,'link',$3,$4,$5) RETURNING *
        `, [id, uCode, name || url, url, JSON.stringify(linkData)]);
        return res.status(201).json({ data: rows[0] });
    }

    // Handle file upload
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No file uploaded and no link provided' });
    }
    const file = req.files.file;
    // __dirname is api/kanban. ../../public goes to ENG-Backend/public
    const uploadDir = path.join(__dirname, '../../public/kanban_attachments', id);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);
    const relPath = `public/kanban_attachments/${id}/${safeName}`;
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name);

    await file.mv(filePath);

    const { rows } = await engPool.query(`
        INSERT INTO kb_attachment (card_id, creator_u_code, attachment_type, file_name, file_path, file_size, mime_type, is_image)
        VALUES ($1,$2,'file',$3,$4,$5,$6,$7) RETURNING *
    `, [id, uCode, file.name, relPath, file.size, file.mimetype, isImage]);

    const client = await engPool.connect();
    await logAction(client, id, uCode, 'attachment_added', { file_name: file.name });
    client.release();

    res.status(201).json({ data: rows[0] });
};

// DELETE /api/kanban/attachments/:id
const DeleteAttachment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { rows: [att] } = await engPool.query('SELECT * FROM kb_attachment WHERE id=$1', [id]);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const { rows: [card] } = await engPool.query('SELECT board_id, is_private FROM kb_card WHERE id=$1', [att.card_id]);
    const canDelete = att.creator_u_code === uCode || await canManageCard(req, att.card_id);
    if (!canDelete) return res.status(403).json({ error: 'Permission denied' });

    await engPool.query('DELETE FROM kb_attachment WHERE id=$1', [id]);
    if (att.attachment_type === 'file') {
        const fullPath = path.join(__dirname, '../../', att.file_path);
        if (fs.existsSync(fullPath)) fs.unlink(fullPath, () => { });
    }
    res.json({ message: 'Attachment deleted' });
};

// PATCH /api/kanban/attachments/:id
const UpdateAttachment = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { name, url } = req.body;

    const { rows: [att] } = await engPool.query('SELECT * FROM kb_attachment WHERE id=$1', [id]);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });
    if (att.attachment_type !== 'link') {
        return res.status(400).json({ error: 'Only link attachments can be edited' });
    }

    const { rows: [card] } = await engPool.query('SELECT board_id, is_private FROM kb_card WHERE id=$1', [att.card_id]);
    const canEdit = att.creator_u_code === uCode || await canManageCard(req, att.card_id);
    if (!canEdit) return res.status(403).json({ error: 'Permission denied' });

    const linkData = { url: url || att.file_path, name: name || att.file_name };
    const { rows } = await engPool.query(
        'UPDATE kb_attachment SET file_name=$1, file_path=$2, link_data=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
        [linkData.name, linkData.url, JSON.stringify(linkData), id]
    );

    res.json({ data: rows[0] });
};

// PATCH /api/kanban/cards/:id/cover
const SetCoverImage = async (req, res) => {
    const { id } = req.params;
    const { attachment_id } = req.body; // null to clear

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });

    const { rows } = await engPool.query(
        'UPDATE kb_card SET cover_attachment_id=$1 WHERE id=$2 RETURNING *', [attachment_id || null, id]
    );
    res.json({ data: rows[0] });
};

// ─── NOTIFICATIONS ──────────────────────────────────────────────────

// GET /api/kanban/notifications
const GetNotifications = async (req, res) => {
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { rows } = await engPool.query(`
        SELECT n.*, ka.action_type, ka.action_data
        FROM kb_notification n
        LEFT JOIN kb_action ka ON ka.id=n.action_id
        WHERE n.recipient_u_code=$1
        ORDER BY n.created_at DESC LIMIT 50
    `, [uCode]);
    res.json({ data: rows });
};

// PATCH /api/kanban/notifications/read-all
const MarkAllRead = async (req, res) => {
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    await engPool.query('UPDATE kb_notification SET is_read=TRUE WHERE recipient_u_code=$1', [uCode]);
    res.json({ message: 'All notifications marked as read' });
};

// PATCH /api/kanban/notifications/:id/read
const MarkRead = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { rows } = await engPool.query(
        'UPDATE kb_notification SET is_read=TRUE WHERE id=$1 AND recipient_u_code=$2 RETURNING *',
        [id, uCode]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found or unauthorized' });
    res.json({ data: rows[0] });
};

// ─── CARD REORDER (Drag & Drop) ───────────────────────────────────

// PATCH /api/kanban/cards/:id/reorder
const ReorderCard = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno || req.body?.owner_u_code || req.query?.owner_u_code || 'LE131';
    const { list_id, position } = req.body;

    if (!list_id || position === undefined) {
        return res.status(400).json({ error: 'list_id and position are required' });
    }

    const { rows: [card] } = await engPool.query('SELECT * FROM kb_card WHERE id=$1', [id]);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (!(await canEditCard(req, id))) return res.status(403).json({ error: 'Card editor permission required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Get all sibling cards in the target list (excluding the card being moved)
        const { rows: siblings } = await client.query(
            `SELECT id, position FROM kb_card
             WHERE list_id=$1 AND id!=$2
             ORDER BY position ASC`,
            [list_id, id]
        );

        const { position: newPosition, repositions } = insertToPositionables(position, siblings);

        // Apply repositions for colliding siblings
        for (const repo of repositions) {
            await client.query(
                'UPDATE kb_card SET position=$1 WHERE id=$2',
                [repo.position, repo.record.id]
            );
        }

        const listChanged = String(list_id) !== String(card.list_id);

        // Update the card's position and optionally the list
        const { rows: [updated] } = await client.query(`
            UPDATE kb_card SET
                position = $1,
                list_id = $2,
                list_changed_at = CASE WHEN $3 THEN NOW() ELSE list_changed_at END
            WHERE id=$4 RETURNING *
        `, [newPosition, list_id, listChanged, id]);

        if (listChanged) {
            await logAction(client, id, uCode, 'card_moved', {
                from_list_id: card.list_id, to_list_id: list_id
            });
        }

        await client.query('COMMIT');

        // Broadcast via WebSocket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`board:${card.board_id}`).emit('cardUpdate', {
                item: updated,
                repositions: repositions.map(r => ({ id: r.record.id, position: r.position })),
                fromListId: listChanged ? card.list_id : null,
            });
        }

        res.json({ data: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── ACTIVITY LOG ───────────────────────────────────────────────

// GET /api/kanban/cards/:id/actions
const GetActions = async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    try {
        const { rows } = await engPool.query(`
            SELECT a.*,
                   u.u_nickname AS user_display_name
            FROM kb_action a
            LEFT JOIN m_user_profile u ON u.u_code = a.u_code
            WHERE a.card_id=$1
            ORDER BY a.created_at DESC
            LIMIT $2
        `, [id, limit]);
        res.json({ data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    // Permission Helpers
    canEditCard, canManageCard, canViewCard,
    // Card
    GetCards, CreateCard, GetCard, UpdateCard, DeleteCard, DuplicateCard,
    // Memberships
    AddCardMember, RemoveCardMember,
    // Labels
    AddCardLabel, RemoveCardLabel,
    // Task Lists
    GetTaskLists, CreateTaskList, UpdateTaskList, DeleteTaskList, CreateTask, UpdateTask, DeleteTask,

    // Comments
    AddComment, UpdateComment, DeleteComment,
    // Attachments
    UploadAttachment, UpdateAttachment, DeleteAttachment, SetCoverImage,
    // Notifications
    GetNotifications, MarkAllRead, MarkRead,
    // Drag & Drop
    ReorderCard,
    // Activity
    GetActions,
};
