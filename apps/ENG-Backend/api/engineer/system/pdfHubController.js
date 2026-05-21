/**
 * PDF Hub Controller
 * Handles stamp/signature CRUD with physical dimension metadata.
 * Used by the Paperless Sign & Stamp feature.
 */
const express = require('express');
const { engPool } = require('../../../instance/eng_db');

const router = express.Router();

// ============================================================================
// GET /stamps/:em_id — Fetch a user's stamp & signature with dimensions
// ============================================================================
router.get('/stamps/:em_id', async (req, res) => {
    try {
        const { em_id } = req.params;
        const result = await engPool.query(
            `SELECT id, em_id, first_name, last_name, department,
                    stamp_image, signature_image,
                    stamp_width_mm, stamp_height_mm,
                    sig_width_mm, sig_height_mm,
                    created_at, updated_at
             FROM tt_user_stamps WHERE em_id = $1`,
            [em_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ result: 'false', message: 'No stamp found for this user' });
        }

        const stamp = result.rows[0];

        // Convert BYTEA → base64 for frontend consumption
        if (stamp.stamp_image) {
            stamp.stamp_image = stamp.stamp_image.toString('base64');
        }
        if (stamp.signature_image) {
            stamp.signature_image = stamp.signature_image.toString('base64');
        }

        // Parse numeric strings to numbers
        stamp.stamp_width_mm = parseFloat(stamp.stamp_width_mm) || 40.0;
        stamp.stamp_height_mm = parseFloat(stamp.stamp_height_mm) || 40.0;
        stamp.sig_width_mm = parseFloat(stamp.sig_width_mm) || 50.0;
        stamp.sig_height_mm = parseFloat(stamp.sig_height_mm) || 20.0;

        res.json({ result: 'true', data: stamp });
    } catch (err) {
        console.error('pdfHub getStamp error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// POST /stamps — Upsert stamp/signature with physical dimensions
// ============================================================================
router.post('/stamps', async (req, res) => {
    try {
        const {
            em_id, first_name, last_name, department,
            stamp_width_mm, stamp_height_mm,
            sig_width_mm, sig_height_mm
        } = req.body;

        if (!em_id) {
            return res.status(400).json({ result: 'false', message: 'em_id is required' });
        }

        // Convert base64 → Buffer if provided
        let stampBuf = null;
        let sigBuf = null;
        if (req.body.stamp_image) {
            stampBuf = Buffer.from(req.body.stamp_image, 'base64');
        }
        if (req.body.signature_image) {
            sigBuf = Buffer.from(req.body.signature_image, 'base64');
        }

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
                sig_width_mm || 50.0, sig_height_mm || 20.0
            ]
        );

        res.json({ result: 'true', message: 'Stamp saved successfully' });
    } catch (err) {
        console.error('pdfHub upsertStamp error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// GET /stamps — List all user stamps (admin overview)
// ============================================================================
router.get('/stamps', async (req, res) => {
    try {
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

        // Parse numerics
        const data = result.rows.map(row => ({
            ...row,
            stamp_width_mm: parseFloat(row.stamp_width_mm) || 40.0,
            stamp_height_mm: parseFloat(row.stamp_height_mm) || 40.0,
            sig_width_mm: parseFloat(row.sig_width_mm) || 50.0,
            sig_height_mm: parseFloat(row.sig_height_mm) || 20.0,
        }));

        res.json({ result: 'true', data });
    } catch (err) {
        console.error('pdfHub listStamps error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

module.exports = router;
