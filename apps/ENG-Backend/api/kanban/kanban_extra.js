/**
 * kanban_extra.js
 * Backend CRUD for: Custom Fields, Webhooks, Notification Service, Background Image
 * Route prefix: /api/kanban/...
 */
const { engPool } = require('../../instance/eng_db');
const {
    canManageProject,
    canManageBoard,
    canEditCard
} = require('./kanban_acl');

// ====================================================================
//  CUSTOM FIELDS (Feature 12)
// ====================================================================

// --- Base Custom Field Group (project-level templates) ---

const GetBaseCustomFieldGroups = async (req, res) => {
    const { projectId } = req.params;
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_base_custom_field_group WHERE project_id=$1 ORDER BY created_at', [projectId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const CreateBaseCustomFieldGroup = async (req, res) => {
    const { projectId } = req.params;
    const { name } = req.body;
    try {
        const canManage = await canManageProject(req, projectId);
        if (!canManage) return res.status(403).json({ error: 'Forbidden' });

        const { rows } = await engPool.query(
            'INSERT INTO kb_base_custom_field_group (project_id, name) VALUES ($1, $2) RETURNING *',
            [projectId, name]);
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpdateBaseCustomFieldGroup = async (req, res) => {
    const { id } = req.params;
    const { name, projectId } = req.body; // Expect frontend to pass projectId
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const { rows } = await engPool.query(
            'UPDATE kb_base_custom_field_group SET name=COALESCE($1,name) WHERE id=$2 RETURNING *',
            [name, id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const DeleteBaseCustomFieldGroup = async (req, res) => {
    const { id } = req.params;
    const { projectId } = req.query; // Expect frontend to pass projectId
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        await engPool.query('DELETE FROM kb_base_custom_field_group WHERE id=$1', [id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Custom Field Group (board/card level) ---

const GetCustomFieldGroups = async (req, res) => {
    const { boardId } = req.params;
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_custom_field_group WHERE board_id=$1 ORDER BY position', [boardId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const CreateCustomFieldGroup = async (req, res) => {
    const { boardId } = req.params;
    const { base_custom_field_group_id, card_id, name, position } = req.body;
    try {
        const canManage = await canManageBoard(req, boardId);
        if (!canManage) return res.status(403).json({ error: 'Forbidden' });

        const pos = position || 65536;
        const { rows } = await engPool.query(
            `INSERT INTO kb_custom_field_group (board_id, card_id, base_custom_field_group_id, position, name)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [boardId, card_id || null, base_custom_field_group_id, pos, name]);
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpdateCustomFieldGroup = async (req, res) => {
    const { id } = req.params;
    const { name, position, boardId } = req.body; // Expect boardId from frontend
    try {
        if (boardId) {
            const canManage = await canManageBoard(req, boardId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const { rows } = await engPool.query(
            `UPDATE kb_custom_field_group SET name=COALESCE($1,name), position=COALESCE($2,position)
             WHERE id=$3 RETURNING *`, [name, position, id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const DeleteCustomFieldGroup = async (req, res) => {
    const { id } = req.params;
    const { boardId } = req.query;
    try {
        if (boardId) {
            const canManage = await canManageBoard(req, boardId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }
        await engPool.query('DELETE FROM kb_custom_field_group WHERE id=$1', [id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Custom Field ---

const GetCustomFields = async (req, res) => {
    const { groupId } = req.params;
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_custom_field WHERE base_custom_field_group_id=$1 ORDER BY position',
            [groupId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const CreateCustomField = async (req, res) => {
    const { groupId } = req.params;
    const { name, show_on_front_of_card, position, custom_field_group_id, projectId } = req.body;
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const pos = position || 65536;
        const { rows } = await engPool.query(
            `INSERT INTO kb_custom_field (base_custom_field_group_id, custom_field_group_id, position, name, show_on_front_of_card)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [groupId, custom_field_group_id || null, pos, name, show_on_front_of_card || false]);
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpdateCustomField = async (req, res) => {
    const { id } = req.params;
    const { name, show_on_front_of_card, position, projectId } = req.body;
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const { rows } = await engPool.query(
            `UPDATE kb_custom_field SET
                name=COALESCE($1,name),
                show_on_front_of_card=COALESCE($2,show_on_front_of_card),
                position=COALESCE($3,position)
             WHERE id=$4 RETURNING *`,
            [name, show_on_front_of_card, position, id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const DeleteCustomField = async (req, res) => {
    const { id } = req.params;
    const { projectId } = req.query;
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }
        await engPool.query('DELETE FROM kb_custom_field WHERE id=$1', [id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Custom Field Values (per card) ---

const GetCustomFieldValues = async (req, res) => {
    const { cardId } = req.params;
    try {
        const { rows } = await engPool.query(`
            SELECT cfv.*, cf.name as field_name, cf.show_on_front_of_card
            FROM kb_custom_field_value cfv
            JOIN kb_custom_field cf ON cf.id = cfv.custom_field_id
            WHERE cfv.card_id=$1
            ORDER BY cf.position
        `, [cardId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpsertCustomFieldValue = async (req, res) => {
    const { cardId } = req.params;
    const { custom_field_id, custom_field_group_id, content } = req.body;
    try {
        const canEdit = await canEditCard(req, cardId);
        if (!canEdit) return res.status(403).json({ error: 'Forbidden' });

        // Check existing
        const existing = await engPool.query(
            'SELECT id FROM kb_custom_field_value WHERE card_id=$1 AND custom_field_id=$2',
            [cardId, custom_field_id]);
        let rows;
        if (existing.rows.length) {
            const r = await engPool.query(
                'UPDATE kb_custom_field_value SET content=$1 WHERE id=$2 RETURNING *',
                [content, existing.rows[0].id]);
            rows = r.rows;
        } else {
            const r = await engPool.query(
                `INSERT INTO kb_custom_field_value (card_id, custom_field_group_id, custom_field_id, content)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [cardId, custom_field_group_id || null, custom_field_id, content]);
            rows = r.rows;
        }
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ====================================================================
//  WEBHOOK (Feature 13)
// ====================================================================

const GetWebhooks = async (req, res) => {
    const { boardId } = req.params;
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_webhook WHERE board_id=$1 ORDER BY created_at', [boardId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const CreateWebhook = async (req, res) => {
    const { boardId } = req.params;
    const { name, url, access_token, events, excluded_events } = req.body;
    try {
        const canManage = await canManageBoard(req, boardId);
        if (!canManage) return res.status(403).json({ error: 'Forbidden' });

        const { rows } = await engPool.query(
            `INSERT INTO kb_webhook (board_id, name, url, access_token, events, excluded_events)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [boardId, name, url, access_token || null, events || '{}', excluded_events || '{}']);
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpdateWebhook = async (req, res) => {
    const { id } = req.params;
    const { name, url, access_token, events, excluded_events, is_active, boardId } = req.body;
    try {
        if (boardId) {
            const canManage = await canManageBoard(req, boardId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const { rows } = await engPool.query(
            `UPDATE kb_webhook SET
                name=COALESCE($1,name), url=COALESCE($2,url),
                access_token=COALESCE($3,access_token),
                events=COALESCE($4,events), excluded_events=COALESCE($5,excluded_events),
                is_active=COALESCE($6,is_active)
             WHERE id=$7 RETURNING *`,
            [name, url, access_token, events, excluded_events, is_active, id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const DeleteWebhook = async (req, res) => {
    const { id } = req.params;
    const { boardId } = req.query;
    try {
        if (boardId) {
            const canManage = await canManageBoard(req, boardId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }
        await engPool.query('DELETE FROM kb_webhook WHERE id=$1', [id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ====================================================================
//  NOTIFICATION SERVICE (Feature 11)
// ====================================================================

const GetNotificationServices = async (req, res) => {
    const uCode = req.user?.empno || req.query?.owner_u_code || 'LE131';
    try {
        const { rows } = await engPool.query(
            'SELECT * FROM kb_notification_service WHERE u_code=$1 ORDER BY created_at', [uCode]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const CreateNotificationService = async (req, res) => {
    const uCode = req.user?.empno || req.body?.owner_u_code || 'LE131';
    const { board_id, url, format } = req.body;
    try {
        const { rows } = await engPool.query(
            `INSERT INTO kb_notification_service (u_code, board_id, url, format)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [uCode, board_id || null, url, format || 'text']);
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UpdateNotificationService = async (req, res) => {
    const { id } = req.params;
    const { url, format, board_id } = req.body;
    try {
        const { rows } = await engPool.query(
            `UPDATE kb_notification_service SET
                url=COALESCE($1,url), format=COALESCE($2,format), board_id=COALESCE($3,board_id)
             WHERE id=$4 RETURNING *`,
            [url, format, board_id, id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ data: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const DeleteNotificationService = async (req, res) => {
    const { id } = req.params;
    try {
        await engPool.query('DELETE FROM kb_notification_service WHERE id=$1', [id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ====================================================================
//  BACKGROUND IMAGE (Feature 10)
// ====================================================================

const GetBackgroundImages = async (req, res) => {
    const { projectId } = req.params;
    try {
        const { rows } = await engPool.query(`
            SELECT bi.*, uf.mime_type, uf.type as file_type
            FROM kb_background_image bi
            JOIN kb_uploaded_file uf ON uf.id = bi.uploaded_file_id
            WHERE bi.project_id=$1 ORDER BY bi.created_at
        `, [projectId]);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const UploadBackgroundImage = async (req, res) => {
    const { projectId } = req.params;
    const { mime_type, size, extension } = req.body;
    try {
        const canManage = await canManageProject(req, projectId);
        if (!canManage) return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        // Create uploaded file record
        const uf = await client.query(
            `INSERT INTO kb_uploaded_file (type, references_total, mime_type, size)
             VALUES ('backgroundImage', 1, $1, $2) RETURNING *`,
            [mime_type || 'image/jpeg', size || 0]);
        // Create background image record
        const bi = await client.query(
            `INSERT INTO kb_background_image (uploaded_file_id, project_id, extension, size)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [uf.rows[0].id, projectId, extension || 'jpg', size || 0]);
        // Update storage usage
        await client.query(`
            INSERT INTO kb_storage_usage (total, background_images)
            VALUES ($1, $1)
            ON CONFLICT (id) DO UPDATE SET
                total = kb_storage_usage.total + $1,
                background_images = kb_storage_usage.background_images + $1
        `, [size || 0]);
        await client.query('COMMIT');
        res.json({ data: { ...bi.rows[0], uploaded_file: uf.rows[0] } });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const DeleteBackgroundImage = async (req, res) => {
    const { id } = req.params;
    const { projectId } = req.query;
    try {
        if (projectId) {
            const canManage = await canManageProject(req, projectId);
            if (!canManage) return res.status(403).json({ error: 'Forbidden' });
        }

        const bg = await engPool.query('SELECT * FROM kb_background_image WHERE id=$1', [id]);
        if (!bg.rows.length) return res.status(404).json({ error: 'Not found' });
        await engPool.query('DELETE FROM kb_uploaded_file WHERE id=$1', [bg.rows[0].uploaded_file_id]);
        res.json({ data: { deleted: true } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ====================================================================
//  STORAGE USAGE
// ====================================================================

const GetStorageUsage = async (req, res) => {
    try {
        const { rows } = await engPool.query('SELECT * FROM kb_storage_usage LIMIT 1');
        res.json({ data: rows[0] || { total: 0, user_avatars: 0, background_images: 0, attachments: 0 } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
    // Custom Fields
    GetBaseCustomFieldGroups, CreateBaseCustomFieldGroup, UpdateBaseCustomFieldGroup, DeleteBaseCustomFieldGroup,
    GetCustomFieldGroups, CreateCustomFieldGroup, UpdateCustomFieldGroup, DeleteCustomFieldGroup,
    GetCustomFields, CreateCustomField, UpdateCustomField, DeleteCustomField,
    GetCustomFieldValues, UpsertCustomFieldValue,
    // Webhooks
    GetWebhooks, CreateWebhook, UpdateWebhook, DeleteWebhook,
    // Notification Service
    GetNotificationServices, CreateNotificationService, UpdateNotificationService, DeleteNotificationService,
    // Background Image
    GetBackgroundImages, UploadBackgroundImage, DeleteBackgroundImage,
    // Storage
    GetStorageUsage,
};
