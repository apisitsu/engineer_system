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
const { isSuperAdmin, canAccessProject } = require('./kanban_acl');

// ─── GET /api/kanban/templates ────────────────────────────────────────
const GetTemplates = async (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { rows } = await engPool.query(`
            SELECT t.*, p.name AS master_project_name
            FROM kb_template_config t
            LEFT JOIN kb_project p ON p.id = t.master_project_id
            ORDER BY t.created_at DESC
        `);
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
    const { name, master_project_id, config_data } = req.body;

    if (!name || !master_project_id || !config_data) {
        return res.status(400).json({ error: 'name, master_project_id, and config_data are required' });
    }

    try {
        const { rows } = await engPool.query(`
            INSERT INTO kb_template_config (name, master_project_id, config_data, created_by)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [name, master_project_id, JSON.stringify(config_data), uCode]);
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

    const { new_project_name } = req.body;
    if (!new_project_name) {
        return res.status(400).json({ error: 'new_project_name is required' });
    }

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

        // ── 2. Create new project ───────────────────────────────────────
        const { rows: [newProject] } = await client.query(`
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

        // Add creator as Owner
        await client.query(
            "INSERT INTO kb_project_membership (project_id, u_code, role) VALUES ($1, $2, 'owner')",
            [newProject.id, uCode]
        );

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
                const { rows: [newBoard] } = await client.query(`
                    INSERT INTO kb_board (project_id, name, position, status)
                    VALUES ($1, $2, $3, 'pool') RETURNING *
                `, [newProject.id, mb.name, mb.position]);
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


module.exports = {
    GetTemplates,
    GetTemplateById,
    CreateTemplate,
    UpdateTemplate,
    DeleteTemplate,
    InstantiateTemplate,
};
