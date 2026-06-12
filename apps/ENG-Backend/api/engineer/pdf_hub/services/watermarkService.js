/**
 * watermarkService.js — Business logic for watermark template management.
 *
 * CRUD operations for watermark templates, sharing, and audit logging.
 */
const { engPool } = require('../../../../instance/eng_db');

/**
 * List watermarks accessible to a user (owned + shared).
 * If empno is null, returns all watermarks.
 */
async function getWatermarks(empno) {
    const query = empno
        ? `SELECT DISTINCT w.* FROM tt_pdf_watermarks w
           LEFT JOIN tt_pdf_watermark_shares s ON w.id = s.watermark_id
           WHERE w.owner_empno = $1 OR s.shared_with_empno = $1 
           ORDER BY w.created_at DESC`
        : `SELECT * FROM tt_pdf_watermarks ORDER BY created_at DESC`;

    const result = await engPool.query(query, empno ? [empno] : []);
    return result.rows;
}

/**
 * Create a new watermark template.
 */
async function createWatermark({ name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style }) {
    const result = await engPool.query(
        `INSERT INTO tt_pdf_watermarks (name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [name, text, color, opacity, font_size, angle, owner_empno, repeat_mode || false, repeat_gap || 100, font_family || 'Helvetica', font_weight || 'normal', font_style || 'normal', position_preset || 'center', repeat_style || 'full']
    );
    return result.rows[0];
}

/**
 * Update an existing watermark template.
 */
async function updateWatermark(id, { name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style }) {
    const result = await engPool.query(
        `UPDATE tt_pdf_watermarks 
         SET name = $1, text = $2, color = $3, opacity = $4, font_size = $5, angle = $6,
             repeat_mode = $7, repeat_gap = $8, font_family = $9, font_weight = $10, font_style = $11, position_preset = $12, repeat_style = $13
         WHERE id = $14 AND owner_empno = $15
         RETURNING *`,
        [name, text, color, opacity, font_size, angle, repeat_mode || false, repeat_gap || 100, font_family || 'Helvetica', font_weight || 'normal', font_style || 'normal', position_preset || 'center', repeat_style || 'full', id, owner_empno]
    );
    if (result.rowCount === 0) throw new Error('Watermark not found or not owned by user');
    return result.rows[0];
}

/**
 * Delete a watermark template by ID.
 */
async function deleteWatermark(id, empno) {
    const result = await engPool.query(
        `DELETE FROM tt_pdf_watermarks WHERE id = $1 AND owner_empno = $2`, 
        [id, empno]
    );
    if (result.rowCount === 0) throw new Error('Watermark not found or not owned by user');
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
        [watermark_id, watermark_name, filename, empno, user_name]
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
