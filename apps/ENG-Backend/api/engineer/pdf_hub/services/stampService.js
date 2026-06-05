/**
 * stampService.js — Business logic for user stamp & signature operations.
 *
 * Pure data-access layer — no HTTP concerns.
 */
const { engPool } = require('../../../../instance/eng_db');
const { base64ToBuffer, bufferToBase64, parseStampDimensions } = require('../utils/bufferHelpers');

/**
 * Fetch a single user's stamp & signature by employee ID.
 * Returns null if not found.
 */
async function getStampByEmId(emId) {
    const result = await engPool.query(
        `SELECT id, em_id, first_name, last_name, department,
                stamp_image, signature_image,
                stamp_width_mm, stamp_height_mm,
                sig_width_mm, sig_height_mm,
                created_at, updated_at
         FROM tt_user_stamps WHERE em_id = $1`,
        [emId]
    );

    if (result.rows.length === 0) return null;

    const stamp = result.rows[0];

    // Convert BYTEA → base64 for frontend consumption
    stamp.stamp_image = bufferToBase64(stamp.stamp_image);
    stamp.signature_image = bufferToBase64(stamp.signature_image);

    return parseStampDimensions(stamp);
}

/**
 * Upsert (insert or update) a user's stamp/signature with dimensions.
 */
async function upsertStamp(data) {
    const {
        em_id, first_name, last_name, department,
        stamp_image, signature_image,
        stamp_width_mm, stamp_height_mm,
        sig_width_mm, sig_height_mm,
    } = data;

    // Convert base64 → Buffer if provided
    const stampBuf = base64ToBuffer(stamp_image);
    const sigBuf = base64ToBuffer(signature_image);

    await engPool.query(
        `INSERT INTO tt_user_stamps
            (em_id, first_name, last_name, department,
             stamp_image, signature_image,
             stamp_width_mm, stamp_height_mm,
             sig_width_mm, sig_height_mm)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (em_id) DO UPDATE SET
            first_name = $2,
            last_name = $3,
            department = $4,
            stamp_image = COALESCE($5, tt_user_stamps.stamp_image),
            signature_image = COALESCE($6, tt_user_stamps.signature_image),
            stamp_width_mm = COALESCE($7, tt_user_stamps.stamp_width_mm),
            stamp_height_mm = COALESCE($8, tt_user_stamps.stamp_height_mm),
            sig_width_mm = COALESCE($9, tt_user_stamps.sig_width_mm),
            sig_height_mm = COALESCE($10, tt_user_stamps.sig_height_mm),
            updated_at = NOW()`,
        [
            em_id, first_name, last_name, department,
            stampBuf, sigBuf,
            stamp_width_mm || 40.0, stamp_height_mm || 40.0,
            sig_width_mm || 50.0, sig_height_mm || 20.0,
        ]
    );
}

/**
 * List all user stamps (admin overview).
 * Does NOT include image data — only metadata.
 */
async function listAllStamps() {
    const result = await engPool.query(
        `SELECT id, em_id, first_name, last_name, department,
                stamp_width_mm, stamp_height_mm,
                sig_width_mm, sig_height_mm,
                (stamp_image IS NOT NULL) AS has_stamp,
                (signature_image IS NOT NULL) AS has_signature,
                created_at, updated_at
         FROM tt_user_stamps
         ORDER BY updated_at DESC`
    );

    return result.rows.map(parseStampDimensions);
}

module.exports = { getStampByEmId, upsertStamp, listAllStamps };
