/**
 * kanban_template.js
 * Kanban Template Configuration & Blueprint Instantiation API
 * Route prefix: /api/kanban/templates
 *
 * Handles CRUD for "Template Configurations" and the core
 * "Selective Cloning" engine that instantiates new projects
 * from blueprints.
 *
 * Architectural Safeguards:
 *   1. Position Recalculation — Cards merged into the first list
 *      get fresh positions via (index+1)*65536 to prevent DnD collisions.
 *   2. Dead ID Resilience — Uses `WHERE id = ANY($1::int[])` batch queries
 *      so deleted master entities are silently skipped (no crash).
 *   3. Full Transaction — All multi-stage INSERT/SELECT wrapped in
 *      BEGIN/COMMIT for atomicity.
 */
const { engPool } = require('../../instance/eng_db');
const { isSuperAdmin, canAccessProject, canEditBoard } = require('./kanban_acl');

// ─── HELPERS ──────────────────────────────────────────────────────────
const logAction = async (client, cardId, uCode, actionType, actionData = {}, boardId = null) => {
    const { rows: [action] } = await client.query(`
        INSERT INTO kb_action (card_id, board_id, u_code, action_type, action_data)
        VALUES ($1,$2,$3,$4,$5) RETURNING id
    `, [cardId, boardId, uCode, actionType, JSON.stringify(actionData)]);
    return action.id;
};

// ─── GET /api/kanban/templates ────────────────────────────────────────
const GetTemplates = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { type } = req.query;
    try {
        let query = `
            SELECT t.*, COALESCE(p.name, t.master_project_name) AS master_project_name
            FROM kb_template_config t
            LEFT JOIN kb_project p ON p.id = t.master_project_id
        `;
        const params = [];
        if (type) {
            query += ` WHERE t.template_type = $1`;
            params.push(type);
        }
        query += ` ORDER BY t.created_at DESC`;

        const { rows } = await engPool.query(query, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('GetTemplates error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/kanban/templates/:id ────────────────────────────────────
const GetTemplateById = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows } = await engPool.query(`
            SELECT t.*, p.name AS master_project_name
            FROM kb_template_config t
            LEFT JOIN kb_project p ON p.id = t.master_project_id
            WHERE t.id = $1
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Template not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error('GetTemplateById error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/kanban/templates ───────────────────────────────────────
const CreateTemplate = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { name, master_project_id, config_data, template_type } = req.body;
    const type = template_type || 'project';

    if (!name || !config_data) {
        return res.status(400).json({ error: 'name and config_data are required' });
    }
    if (type === 'project' && !master_project_id) {
        return res.status(400).json({ error: 'master_project_id is required for project blueprints' });
    }

    try {
        let masterProjectName = null;
        if (master_project_id) {
            // Snapshot the master project name at creation time
            const { rows: projRows } = await engPool.query(
                'SELECT name FROM kb_project WHERE id = $1', [master_project_id]
            );
            masterProjectName = projRows[0]?.name || null;
        }

        const { rows } = await engPool.query(`
            INSERT INTO kb_template_config (name, master_project_id, config_data, created_by, master_project_name, template_type)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [name, master_project_id || null, JSON.stringify(config_data), uCode, masterProjectName, type]);

        // Attach the live name to response
        rows[0].master_project_name = masterProjectName;
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        console.error('CreateTemplate error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── PATCH /api/kanban/templates/:id ──────────────────────────────────
const UpdateTemplate = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    const { name, config_data } = req.body;

    try {
        const { rows } = await engPool.query(`
            UPDATE kb_template_config SET
                name        = COALESCE($1, name),
                config_data = COALESCE($2, config_data),
                updated_at  = NOW()
            WHERE id = $3 RETURNING *
        `, [name, config_data ? JSON.stringify(config_data) : null, id]);
        if (!rows[0]) return res.status(404).json({ error: 'Template not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error('UpdateTemplate error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /api/kanban/templates/:id ─────────────────────────────────
const DeleteTemplate = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        await engPool.query('DELETE FROM kb_template_config WHERE id = $1', [id]);
        res.json({ message: 'Template deleted' });
    } catch (err) {
        console.error('DeleteTemplate error:', err.message);
        res.status(500).json({ error: err.message });
    }
};


// ═══════════════════════════════════════════════════════════════════════
//  INSTANTIATION ENGINE — POST /api/kanban/templates/:id/instantiate
// ═══════════════════════════════════════════════════════════════════════
//
//  Cloning Rules (from config_data):
//   1. Project    → Create new with provided name
//   2. Boards     → Clone if id ∈ config_data.board_ids, force status='pool'
//   3. Lists      → Clone if id ∈ config_data.list_ids
//   4. Cards      → Clone if id ∈ config_data.card_ids
//                    - Force into lowest-position list per board ("To-Do Reset")
//                    - Clean slate: stopwatch=NULL, is_closed=false,
//                      is_suspended=false, is_due_completed=false
//   5. Tasks      → Clone if id ∈ config_data.task_ids, is_completed=false
//   6. Attachments → Deep copy for every cloned card (same URLs/paths)
//   7. Comments   → NOT cloned
//
//  Safeguards:
//   - Dead ID Resilience: `WHERE id = ANY($1::int[])` silently skips deleted entities
//   - Position Recalculation: Cards get position = (index+1) * 65536
//   - Full transaction (BEGIN/COMMIT/ROLLBACK)
//
const InstantiateTemplate = async (req, res) => {
    const { id } = req.params;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });

    const { new_project_name, target_project_id, board_names, board_priority, board_due_date } = req.body;
    
    // Either a new project name OR a target existing project must be provided
    if (!new_project_name && !target_project_id) {
        return res.status(400).json({ error: 'new_project_name or target_project_id is required' });
    }

    const customBoardNames = board_names || {};

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // ── 0. Load template config ─────────────────────────────────────
        const { rows: [template] } = await client.query(
            'SELECT * FROM kb_template_config WHERE id = $1', [id]
        );
        if (!template) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Template not found' });
        }

        const config = template.config_data;
        const boardIds = config.board_ids || [];
        const listIds  = config.list_ids  || [];
        const cardIds  = config.card_ids  || [];
        const taskIds  = config.task_ids  || [];

        // ── 1. Load master project for defaults ─────────────────────────
        const { rows: [masterProject] } = await client.query(
            'SELECT * FROM kb_project WHERE id = $1', [template.master_project_id]
        );
        if (!masterProject) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Master project not found' });
        }

        // ── 2. Create or Resolve Project ───────────────────────────────────────
        let newProject;
        if (target_project_id) {
            // Use existing project
            const { rows: [existingProject] } = await client.query(
                'SELECT * FROM kb_project WHERE id = $1', [target_project_id]
            );
            if (!existingProject) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Target project not found' });
            }
            
            // Check permissions (must be able to access the project, usually owner or team member)
            if (!(await canAccessProject({ user: req.user }, target_project_id))) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Permission denied to target project' });
            }
            newProject = existingProject;
        } else {
            // Create new project
            const { rows: [createdProject] } = await client.query(`
                INSERT INTO kb_project (
                    owner_u_code, name, description, background_type, background_value,
                    is_hidden, is_private, icon, priority, status, is_permanent
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING *
            `, [
                uCode,
                new_project_name,
                masterProject.description,
                masterProject.background_type,
                masterProject.background_value,
                false,
                masterProject.is_private || false,
                masterProject.icon,
                masterProject.priority || 'medium',
                masterProject.is_permanent || false,
            ]);
            newProject = createdProject;

            // Add creator as Owner
            await client.query(
                "INSERT INTO kb_project_membership (project_id, u_code, role) VALUES ($1, $2, 'owner')",
                [newProject.id, uCode]
            );
        }

        // ── 3. Clone Boards (batch, Dead-ID safe) ───────────────────────
        //    Only boards whose IDs are in config_data.board_ids
        const boardIdMap = {}; // oldId -> newId
        if (boardIds.length > 0) {
            const { rows: masterBoards } = await client.query(`
                SELECT * FROM kb_board
                WHERE id = ANY($1::int[]) AND project_id = $2
                ORDER BY created_at ASC
            `, [boardIds, template.master_project_id]);

            for (const mb of masterBoards) {
                const finalBoardName = customBoardNames[mb.id] || mb.name;
                const { rows: [newBoard] } = await client.query(`
                    INSERT INTO kb_board (project_id, name, position, status, priority, due_date, 
                        default_view, default_card_type, limit_card_types, always_display_card_creator, 
                        expand_task_lists_by_default, is_private)
                    VALUES ($1, $2, $3, 'pool', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
                `, [
                    newProject.id, finalBoardName, mb.position, 
                    board_priority || mb.priority || 'MEDIUM', 
                    board_due_date || mb.due_date || null,
                    mb.default_view || 'kanban',
                    mb.default_card_type || 'task',
                    mb.limit_card_types || false,
                    mb.always_display_card_creator || false,
                    mb.expand_task_lists_by_default || false,
                    mb.is_private || false
                ]);
                boardIdMap[mb.id] = newBoard.id;
            }
        }

        // ── 4. Clone Lists (batch, Dead-ID safe) ────────────────────────
        //    Only lists whose IDs are in config_data.list_ids AND
        //    whose parent board was also cloned
        const listIdMap = {};  // oldId -> newId
        const clonedBoardOldIds = Object.keys(boardIdMap).map(Number);

        if (listIds.length > 0 && clonedBoardOldIds.length > 0) {
            const { rows: masterLists } = await client.query(`
                SELECT * FROM kb_list
                WHERE id = ANY($1::int[])
                  AND board_id = ANY($2::int[])
                  AND list_type IN ('active', 'closed')
                ORDER BY board_id, position ASC
            `, [listIds, clonedBoardOldIds]);

            for (const ml of masterLists) {
                const newBoardId = boardIdMap[ml.board_id];
                if (!newBoardId) continue; // Orphan guard

                const { rows: [newList] } = await client.query(`
                    INSERT INTO kb_list (board_id, name, position, list_type)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `, [newBoardId, ml.name, ml.position, ml.list_type]);
                listIdMap[ml.id] = newList.id;
            }
        }

        // ── 5. Determine "To-Do" list per board (lowest position) ───────
        //    For the "To-Do Reset" rule: cards go into the first list
        const firstListPerBoard = {}; // newBoardId -> newListId
        {
            const newBoardIds = Object.values(boardIdMap);
            if (newBoardIds.length > 0) {
                const { rows: firstLists } = await client.query(`
                    SELECT DISTINCT ON (board_id) board_id, id
                    FROM kb_list
                    WHERE board_id = ANY($1::int[]) AND list_type = 'active'
                    ORDER BY board_id, position ASC
                `, [newBoardIds]);

                for (const fl of firstLists) {
                    firstListPerBoard[fl.board_id] = fl.id;
                }
            }
        }

        // ── 6. Clone Cards (batch, Dead-ID safe) ────────────────────────
        //    Only cards in config_data.card_ids whose parent list was cloned
        //    Force into lowest-position list + clean slate state
        const cardIdMap = {}; // oldId -> newId
        const clonedListOldIds = Object.keys(listIdMap).map(Number);

        if (cardIds.length > 0 && clonedListOldIds.length > 0) {
            const { rows: masterCards } = await client.query(`
                SELECT c.*, l.board_id AS original_board_id
                FROM kb_card c
                JOIN kb_list l ON l.id = c.list_id
                WHERE c.id = ANY($1::int[])
                  AND c.list_id = ANY($2::int[])
                ORDER BY c.board_id, c.position ASC
            `, [cardIds, clonedListOldIds]);

            // Position counter per target list to prevent collisions
            const positionCounters = {}; // targetListId -> next index

            for (const mc of masterCards) {
                const newBoardId = boardIdMap[mc.original_board_id || mc.board_id];
                if (!newBoardId) continue;

                // To-Do Reset: force into lowest-position list of the cloned board
                const targetListId = firstListPerBoard[newBoardId];
                if (!targetListId) continue;

                // Position Recalculation: (index+1) * 65536 to prevent collisions
                if (!positionCounters[targetListId]) positionCounters[targetListId] = 0;
                positionCounters[targetListId]++;
                const newPosition = positionCounters[targetListId] * 65536;

                const { rows: [newCard] } = await client.query(`
                    INSERT INTO kb_card (
                        board_id, list_id, creator_u_code, card_type, position, name,
                        description, due_date, estimated_hours, priority, is_private, memo,
                        is_due_completed, is_closed, stopwatch, is_suspended, suspended_reason,
                        list_changed_at
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                            FALSE, FALSE, NULL, FALSE, NULL, NOW())
                    RETURNING *
                `, [
                    newBoardId,
                    targetListId,
                    uCode,
                    mc.card_type,
                    newPosition,
                    mc.name,
                    mc.description,
                    mc.due_date,
                    mc.estimated_hours,
                    mc.priority,
                    mc.is_private || false,
                    mc.memo,
                ]);
                cardIdMap[mc.id] = newCard.id;
            }
        }

        // ── 7. Clone Labels per Board ───────────────────────────────────
        //    Clone all labels from master boards so card-label references work
        const labelIdMap = {}; // oldLabelId -> newLabelId
        for (const [oldBoardId, newBoardId] of Object.entries(boardIdMap)) {
            const { rows: masterLabels } = await client.query(
                'SELECT * FROM kb_label WHERE board_id = $1 ORDER BY position', [oldBoardId]
            );
            for (const ml of masterLabels) {
                const { rows: [newLabel] } = await client.query(`
                    INSERT INTO kb_label (board_id, name, color, position)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `, [newBoardId, ml.name, ml.color, ml.position]);
                labelIdMap[ml.id] = newLabel.id;
            }
        }

        // ── 8. Clone Card Labels ────────────────────────────────────────
        const clonedCardOldIds = Object.keys(cardIdMap).map(Number);
        if (clonedCardOldIds.length > 0) {
            const { rows: masterCardLabels } = await client.query(`
                SELECT * FROM kb_card_label WHERE card_id = ANY($1::int[])
            `, [clonedCardOldIds]);

            for (const mcl of masterCardLabels) {
                const newCardId = cardIdMap[mcl.card_id];
                const newLabelId = labelIdMap[mcl.label_id];
                if (newCardId && newLabelId) {
                    await client.query(`
                        INSERT INTO kb_card_label (card_id, label_id)
                        VALUES ($1, $2) ON CONFLICT DO NOTHING
                    `, [newCardId, newLabelId]);
                }
            }
        }

        // ── 9. Clone Task Lists & Tasks (selective) ─────────────────────
        //    Clone all task lists for cloned cards,
        //    but only clone tasks present in config_data.task_ids
        if (clonedCardOldIds.length > 0) {
            const { rows: masterTaskLists } = await client.query(`
                SELECT * FROM kb_task_list WHERE card_id = ANY($1::int[]) ORDER BY position
            `, [clonedCardOldIds]);

            for (const mtl of masterTaskLists) {
                const newCardId = cardIdMap[mtl.card_id];
                if (!newCardId) continue;

                const { rows: [newTaskList] } = await client.query(`
                    INSERT INTO kb_task_list (card_id, name, position, show_on_front, hide_completed_tasks)
                    VALUES ($1, $2, $3, $4, $5) RETURNING id
                `, [newCardId, mtl.name, mtl.position, mtl.show_on_front, mtl.hide_completed_tasks]);

                // Clone only tasks in config_data.task_ids (Dead-ID safe)
                if (taskIds.length > 0) {
                    await client.query(`
                        INSERT INTO kb_task (task_list_id, name, position, is_completed)
                        SELECT $1, name, position, FALSE
                        FROM kb_task
                        WHERE task_list_id = $2 AND id = ANY($3::int[])
                        ORDER BY position
                    `, [newTaskList.id, mtl.id, taskIds]);
                }
            }
        }

        // ── 10. Clone Attachments (deep copy metadata) ──────────────────
        //     Copy all kb_attachment records for cloned cards.
        //     Points to the same physical Drive URLs / file paths.
        //     Comments are NOT cloned.
        if (clonedCardOldIds.length > 0) {
            const { rows: masterAttachments } = await client.query(`
                SELECT * FROM kb_attachment WHERE card_id = ANY($1::int[])
            `, [clonedCardOldIds]);

            for (const ma of masterAttachments) {
                const newCardId = cardIdMap[ma.card_id];
                if (!newCardId) continue;

                await client.query(`
                    INSERT INTO kb_attachment (
                        card_id, creator_u_code, attachment_type, file_name, file_path,
                        file_size, mime_type, is_image, link_data,
                        drive_file_id, drive_folder_path
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                `, [
                    newCardId,
                    ma.creator_u_code,
                    ma.attachment_type,
                    ma.file_name,
                    ma.file_path,
                    ma.file_size,
                    ma.mime_type,
                    ma.is_image,
                    ma.link_data,
                    ma.drive_file_id,
                    ma.drive_folder_path,
                ]);
            }
        }

        // ── COMMIT ──────────────────────────────────────────────────────
        await client.query('COMMIT');

        console.log(`[InstantiateTemplate] Template "${template.name}" → Project "${newProject.name}" (id=${newProject.id}) | Boards: ${Object.keys(boardIdMap).length}, Lists: ${Object.keys(listIdMap).length}, Cards: ${Object.keys(cardIdMap).length}`);

        res.status(201).json({
            data: newProject,
            summary: {
                boards_cloned: Object.keys(boardIdMap).length,
                lists_cloned: Object.keys(listIdMap).length,
                cards_cloned: Object.keys(cardIdMap).length,
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('InstantiateTemplate error:', err.message);
        res.status(500).json({ error: 'Instantiation failed: ' + err.message });
    } finally {
        client.release();
    }
};

// ─── POST /api/kanban/templates/:id/stamp-card ────────────────────────
const StampCard = async (req, res) => {
    const { id } = req.params;
    const { list_id } = req.body;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!list_id) return res.status(400).json({ error: 'list_id is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Verify list and permissions
        const { rows: [list] } = await client.query(
            'SELECT l.*, b.project_id FROM kb_list l JOIN kb_board b ON b.id=l.board_id WHERE l.id=$1', [list_id]
        );
        if (!list) throw new Error('Target list not found');
        if (!(await canEditBoard(req, list.board_id))) throw new Error('Editor permission required');

        // Fetch Template
        const { rows: [tmpl] } = await client.query('SELECT * FROM kb_template_config WHERE id = $1 AND template_type = $2', [id, 'card']);
        if (!tmpl) throw new Error('Card template not found');
        const config = tmpl.config_data;

        // Next position
        const { rows: [{ pos }] } = await client.query('SELECT COALESCE(MAX(position),0)+65536 AS pos FROM kb_card WHERE list_id=$1', [list_id]);

        // Insert Card
        const { rows: [card] } = await client.query(`
            INSERT INTO kb_card (board_id, list_id, creator_u_code, card_type, position, name, description, due_date, is_private, list_changed_at, estimated_hours, priority)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11) RETURNING *
        `, [list.board_id, list_id, uCode, config.card_type || 'task', pos, config.name, config.description || null, null, false, config.estimated_hours || 0, config.priority || 'medium']);

        await client.query("INSERT INTO kb_card_membership (card_id, u_code, role) VALUES ($1, $2, 'owner')", [card.id, uCode]);

        // Insert Task Lists & Tasks
        if (config.task_lists && config.task_lists.length > 0) {
            for (let i = 0; i < config.task_lists.length; i++) {
                const tl = config.task_lists[i];
                const { rows: [newTl] } = await client.query(`
                    INSERT INTO kb_task_list (card_id, name, position) VALUES ($1, $2, $3) RETURNING id
                `, [card.id, tl.name, i]);
                
                if (tl.tasks && tl.tasks.length > 0) {
                    for (let j = 0; j < tl.tasks.length; j++) {
                        await client.query(`
                            INSERT INTO kb_task (task_list_id, name, position) VALUES ($1, $2, $3)
                        `, [newTl.id, tl.tasks[j].name, j]);
                    }
                }
            }
        }

        await logAction(client, card.id, uCode, 'card_created', { name: config.name, list_id });

        await client.query('COMMIT');
        
        // Broadcast
        const io = req.app.get('io');
        if (io && list.board_id) {
            io.to(`board:${list.board_id}`).emit('cardCreate', {
                item: card,
                listId: parseInt(list_id),
                actorUCode: uCode,
            });
        }
        res.status(201).json({ data: card });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('StampCard error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── POST /api/kanban/templates/:id/stamp-list ────────────────────────
const StampList = async (req, res) => {
    const { id } = req.params;
    const { board_id } = req.body;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!board_id) return res.status(400).json({ error: 'board_id is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        if (!(await canEditBoard(req, board_id))) throw new Error('Editor permission required');

        // Fetch Template
        const { rows: [tmpl] } = await client.query('SELECT * FROM kb_template_config WHERE id = $1 AND template_type = $2', [id, 'list']);
        if (!tmpl) throw new Error('List template not found');
        const config = tmpl.config_data;

        // Next position for list
        const { rows: [{ pos }] } = await client.query('SELECT COALESCE(MAX(position),0)+65536 AS pos FROM kb_list WHERE board_id=$1', [board_id]);

        // Insert List
        const { rows: [newList] } = await client.query(`
            INSERT INTO kb_list (board_id, name, position) VALUES ($1, $2, $3) RETURNING *
        `, [board_id, config.name, pos]);

        // Insert Cards
        if (config.cards && config.cards.length > 0) {
            for (let i = 0; i < config.cards.length; i++) {
                const cardConfig = config.cards[i];
                const cardPos = (i + 1) * 65536;
                const { rows: [newCard] } = await client.query(`
                    INSERT INTO kb_card (board_id, list_id, creator_u_code, card_type, position, name, description, list_changed_at, priority)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8) RETURNING id
                `, [board_id, newList.id, uCode, cardConfig.card_type || 'task', cardPos, cardConfig.name, cardConfig.description || null, cardConfig.priority || 'medium']);

                await client.query("INSERT INTO kb_card_membership (card_id, u_code, role) VALUES ($1, $2, 'owner')", [newCard.id, uCode]);

                // Insert Task Lists & Tasks for the card
                if (cardConfig.task_lists && cardConfig.task_lists.length > 0) {
                    for (let j = 0; j < cardConfig.task_lists.length; j++) {
                        const tl = cardConfig.task_lists[j];
                        const { rows: [newTl] } = await client.query(`
                            INSERT INTO kb_task_list (card_id, name, position) VALUES ($1, $2, $3) RETURNING id
                        `, [newCard.id, tl.name, j]);
                        
                        if (tl.tasks && tl.tasks.length > 0) {
                            for (let k = 0; k < tl.tasks.length; k++) {
                                await client.query(`
                                    INSERT INTO kb_task (task_list_id, name, position) VALUES ($1, $2, $3)
                                `, [newTl.id, tl.tasks[k].name, k]);
                            }
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');
        
        // Broadcast
        const io = req.app.get('io');
        if (io && board_id) {
            io.to(`board:${board_id}`).emit('listCreate', {
                item: newList,
                actorUCode: uCode,
            });
            // Let the frontend refetch board details to get all the new nested cards correctly
        }
        res.status(201).json({ data: newList });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('StampList error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── POST /api/kanban/templates/:id/stamp-checklist ───────────────
// Stamps a checklist template's task lists onto an existing card
const StampChecklist = async (req, res) => {
    const { id } = req.params;
    const { card_id } = req.body;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!card_id) return res.status(400).json({ error: 'card_id is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Verify card exists
        const { rows: [card] } = await client.query('SELECT * FROM kb_card WHERE id=$1', [card_id]);
        if (!card) throw new Error('Card not found');

        // Fetch Template
        const { rows: [tmpl] } = await client.query(
            'SELECT * FROM kb_template_config WHERE id = $1 AND template_type = $2', [id, 'checklist']
        );
        if (!tmpl) throw new Error('Checklist template not found');
        const config = tmpl.config_data;

        // Get existing max position for task lists on this card
        const { rows: [{ max_pos }] } = await client.query(
            'SELECT COALESCE(MAX(position), -1) AS max_pos FROM kb_task_list WHERE card_id=$1', [card_id]
        );
        let nextPos = max_pos + 1;

        const createdTaskLists = [];

        if (config.task_lists && config.task_lists.length > 0) {
            for (const tl of config.task_lists) {
                const { rows: [newTl] } = await client.query(
                    'INSERT INTO kb_task_list (card_id, name, position) VALUES ($1, $2, $3) RETURNING *',
                    [card_id, tl.name, nextPos++]
                );
                createdTaskLists.push(newTl);

                if (tl.tasks && tl.tasks.length > 0) {
                    for (let j = 0; j < tl.tasks.length; j++) {
                        await client.query(
                            'INSERT INTO kb_task (task_list_id, name, position) VALUES ($1, $2, $3)',
                            [newTl.id, tl.tasks[j].name, j]
                        );
                    }
                }
            }
        }

        await logAction(client, card_id, uCode, 'checklist_stamped', { template_name: tmpl.name });
        await client.query('COMMIT');

        // Broadcast
        const io = req.app.get('io');
        if (io && card.board_id) {
            io.to(`board:${card.board_id}`).emit('cardUpdate', {
                item: card,
                actorUCode: uCode,
            });
        }

        res.status(201).json({ data: createdTaskLists });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('StampChecklist error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─── POST /api/kanban/templates/:id/stamp-labels ──────────────────
// Stamps a label template's labels onto an existing board
const StampLabels = async (req, res) => {
    const { id } = req.params;
    const { board_id } = req.body;
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    if (!board_id) return res.status(400).json({ error: 'board_id is required' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        if (!(await canEditBoard(req, board_id))) throw new Error('Editor permission required');

        // Fetch Template
        const { rows: [tmpl] } = await client.query(
            'SELECT * FROM kb_template_config WHERE id = $1 AND template_type = $2', [id, 'label']
        );
        if (!tmpl) throw new Error('Label template not found');
        const config = tmpl.config_data;

        // Get next position for labels on this board
        const { rows: [{ pos }] } = await client.query(
            'SELECT COALESCE(MAX(position), 0) + 65536 AS pos FROM kb_label WHERE board_id=$1', [board_id]
        );
        let nextPos = pos;

        const createdLabels = [];

        if (config.labels && config.labels.length > 0) {
            for (const label of config.labels) {
                const { rows: [newLabel] } = await client.query(
                    'INSERT INTO kb_label (board_id, position, name, color) VALUES ($1, $2, $3, $4) RETURNING *',
                    [board_id, nextPos, label.name, label.color]
                );
                createdLabels.push(newLabel);
                nextPos += 65536;
            }
        }

        await client.query('COMMIT');

        // Broadcast
        const io = req.app.get('io');
        if (io && board_id) {
            io.to(`board:${board_id}`).emit('labelsUpdate', {
                labels: createdLabels,
                actorUCode: uCode,
            });
        }

        res.status(201).json({ data: createdLabels });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('StampLabels error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};


module.exports = {
    GetTemplates,
    GetTemplateById,
    CreateTemplate,
    UpdateTemplate,
    DeleteTemplate,
    InstantiateTemplate,
    StampCard,
    StampList,
    StampChecklist,
    StampLabels,
};

