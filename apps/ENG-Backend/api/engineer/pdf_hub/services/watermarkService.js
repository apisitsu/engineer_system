/**
 * watermarkService.js — Business logic for watermark template management.
 *
 * CRUD operations for watermark templates, sharing, and audit logging.
 * Upgraded with enterprise system presets, layer support (overlay/underlay), and role-based permissions.
 */
const { engPool } = require('../../../../instance/eng_db');

/**
 * List watermarks accessible to a user:
 * - All system presets (is_system = true)
 * - All public templates (is_public = true)
 * - User-owned templates (owner_empno = empno)
 * - Templates shared directly with user
 * If empno is null, returns all system and public watermarks (and other templates ordered cleanly).
 */
async function getWatermarks(empno) {
    const query = empno
        ? `SELECT DISTINCT w.* FROM tt_pdf_watermarks w
           LEFT JOIN tt_pdf_watermark_shares s ON w.id = s.watermark_id
           WHERE w.owner_empno = $1 OR s.shared_with_empno = $1 OR w.is_system = true OR w.is_public = true
           ORDER BY w.is_system DESC, w.created_at DESC`
        : `SELECT * FROM tt_pdf_watermarks ORDER BY is_system DESC, created_at DESC`;

    const result = await engPool.query(query, empno ? [empno] : []);
    return result.rows;
}

/**
 * Create a new watermark template.
 */
async function createWatermark({ name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style, layer, category, is_public }) {
    const result = await engPool.query(
        `INSERT INTO tt_pdf_watermarks 
         (name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style, layer, category, is_public, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, false)
         RETURNING *`,
        [
            name, text, color, opacity, font_size, angle, owner_empno || 'GUEST',
            repeat_mode || false, repeat_gap || 100, font_family || 'Helvetica',
            font_weight || 'normal', font_style || 'normal', position_preset || 'center',
            repeat_style || 'full', layer || 'overlay', category || 'General', is_public || false
        ]
    );
    return result.rows[0];
}

/**
 * Update an existing watermark template.
 * Protects system presets from being altered by non-AD accounts.
 */
async function updateWatermark(id, { name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style, layer, category, is_public }, userRole = '') {
    const check = await engPool.query(`SELECT is_system, owner_empno FROM tt_pdf_watermarks WHERE id = $1`, [id]);
    if (check.rowCount === 0) throw new Error('Watermark not found');
    if (check.rows[0].is_system && userRole !== 'AD') {
        throw new Error('System standard watermarks cannot be modified');
    }

    const isAdmin = userRole === 'AD';
    const whereClause = isAdmin ? 'WHERE id = $17' : 'WHERE id = $17 AND owner_empno = $18';
    const params = [
        name, text, color, opacity, font_size, angle, repeat_mode || false, repeat_gap || 100,
        font_family || 'Helvetica', font_weight || 'normal', font_style || 'normal',
        position_preset || 'center', repeat_style || 'full', layer || 'overlay', category || 'General',
        is_public || false, id
    ];
    if (!isAdmin) params.push(owner_empno);

    const result = await engPool.query(
        `UPDATE tt_pdf_watermarks 
         SET name = $1, text = $2, color = $3, opacity = $4, font_size = $5, angle = $6,
             repeat_mode = $7, repeat_gap = $8, font_family = $9, font_weight = $10, font_style = $11,
             position_preset = $12, repeat_style = $13, layer = $14, category = $15, is_public = $16
         ${whereClause}
         RETURNING *`,
        params
    );
    if (result.rowCount === 0) throw new Error('Watermark not found or not authorized to update');
    return result.rows[0];
}

/**
 * Delete a watermark template by ID.
 * Protects system presets from deletion.
 */
async function deleteWatermark(id, empno, userRole = '') {
    const check = await engPool.query(`SELECT is_system, owner_empno FROM tt_pdf_watermarks WHERE id = $1`, [id]);
    if (check.rowCount === 0) throw new Error('Watermark not found');
    if (check.rows[0].is_system) throw new Error('System standard watermarks cannot be deleted');

    const isAdmin = userRole === 'AD';
    const query = isAdmin
        ? `DELETE FROM tt_pdf_watermarks WHERE id = $1`
        : `DELETE FROM tt_pdf_watermarks WHERE id = $1 AND owner_empno = $2`;
    const params = isAdmin ? [id] : [id, empno];

    const result = await engPool.query(query, params);
    if (result.rowCount === 0) throw new Error('Watermark not found or not authorized to delete');
}

/**
 * Share a watermark with another employee.
 */
async function shareWatermark(watermarkId, targetEmpno) {
    await engPool.query(
        `INSERT INTO tt_pdf_watermark_shares (watermark_id, shared_with_empno)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [watermarkId, targetEmpno]
    );
}

/**
 * Log a watermark application event (audit trail).
 */
async function logWatermarkUsage({ watermark_id, watermark_name, filename, empno, user_name }) {
    await engPool.query(
        `INSERT INTO tt_pdf_watermark_logs (watermark_id, watermark_name, filename, empno, user_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [watermark_id || null, watermark_name, filename, empno || 'GUEST', user_name || 'Guest User']
    );
}

/**
 * Fetch recent watermark audit history (last 100 entries).
 */
async function getWatermarkHistory() {
    const result = await engPool.query(
        `SELECT id, watermark_name, filename, empno, user_name, created_at
         FROM tt_pdf_watermark_logs
         ORDER BY created_at DESC
         LIMIT 100`
    );
    return result.rows;
}

module.exports = {
    getWatermarks,
    createWatermark,
    updateWatermark,
    deleteWatermark,
    shareWatermark,
    logWatermarkUsage,
    getWatermarkHistory,
};
