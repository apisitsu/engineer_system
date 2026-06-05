/**
 * PDF Hub Controller
 * Handles stamp/signature CRUD with physical dimension metadata.
 * Used by the Paperless Sign & Stamp feature.
 */
const express = require('express');
const { engPool } = require('../../../instance/eng_db');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// Detect Python executable: Windows uses 'py' launcher, others use 'python3' or 'python'
function getPythonCmd() {
    if (process.platform === 'win32') return 'py';
    // Try python3 first on Unix, fallback to python
    return 'python3';
}

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

// ============================================================================
// POST /usage-log — Record PDF usage (for paper-saving cost calculation)
// ============================================================================
router.post('/usage-log', async (req, res) => {
    try {
        const { filename, empno, user_name, total_pages, action_type, details } = req.body;

        if (!empno || !filename) {
            return res.status(400).json({ result: 'false', message: 'empno and filename are required' });
        }

        await engPool.query(
            `INSERT INTO tt_pdf_usage_logs (filename, empno, user_name, total_pages, action_type, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [filename, empno, user_name || '', total_pages || 1, action_type || 'unknown', details || null]
        );

        res.json({ result: 'true', message: 'Usage log recorded successfully' });
    } catch (err) {
        console.error('pdfHub logUsage error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// GET /usage-history
// ============================================================================
router.get('/usage-history', async (req, res) => {
    try {
        const result = await engPool.query(
            `SELECT id, filename, empno, user_name, total_pages, action_type, details, created_at
             FROM tt_pdf_usage_logs
             ORDER BY created_at DESC
             LIMIT 100`
        );
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        console.error('pdfHub usage-history error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// GET /usage-stats — Aggregate PDF usage for Dashboard
// ============================================================================
router.get('/usage-stats', async (req, res) => {
    try {
        const { year, month } = req.query;
        let dateFilter = '';
        let params = [];
        
        if (year && month) {
            dateFilter = 'AND EXTRACT(YEAR FROM created_at) = $1::numeric AND EXTRACT(MONTH FROM created_at) = $2::numeric';
            params = [year, month];
        } else if (year) {
            dateFilter = 'AND EXTRACT(YEAR FROM created_at) = $1::numeric';
            params = [year];
        }

        const statsResult = await engPool.query(
            `SELECT 
                COUNT(*) as total_docs,
                SUM(total_pages) as total_pages,
                SUM(CASE WHEN action_type = 'view' THEN total_pages * 0.10 ELSE total_pages * 0.50 END) as total_savings
             FROM tt_pdf_usage_logs
             WHERE 1=1 ${dateFilter}`,
            params
        );

        const chartResult = await engPool.query(
            `SELECT 
                TO_CHAR(created_at, 'YYYY-MM') as month,
                SUM(CASE WHEN action_type = 'view' THEN total_pages ELSE 0 END) as view_pages,
                SUM(CASE WHEN action_type != 'view' THEN total_pages ELSE 0 END) as action_pages
             FROM tt_pdf_usage_logs
             WHERE 1=1 ${dateFilter}
             GROUP BY TO_CHAR(created_at, 'YYYY-MM')
             ORDER BY month ASC`,
            params
        );

        const totalDocs = parseInt(statsResult.rows[0].total_docs) || 0;
        const totalPagesSaved = parseInt(statsResult.rows[0].total_pages) || 0;
        const totalSavings = parseFloat(statsResult.rows[0].total_savings) || 0.0;

        res.json({
            result: 'true',
            data: {
                totalDocs,
                totalPagesSaved,
                totalSavings,
                chartData: chartResult.rows
            }
        });
    } catch (err) {
        console.error('pdfHub usage-stats error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// POST /watermark-log — Audit trail
// ============================================================================
router.post('/watermark-log', async (req, res) => {
    try {
        const { watermark_id, watermark_name, filename, empno, user_name } = req.body;
        await engPool.query(
            `INSERT INTO tt_pdf_watermark_logs (watermark_id, watermark_name, filename, empno, user_name)
             VALUES ($1, $2, $3, $4, $5)`,
            [watermark_id, watermark_name, filename, empno, user_name]
        );
        res.json({ result: 'true', message: 'Watermark log recorded successfully' });
    } catch (err) {
        console.error('pdfHub watermark-log error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// GET /watermark-history
// ============================================================================
router.get('/watermark-history', async (req, res) => {
    try {
        const result = await engPool.query(
            `SELECT id, watermark_name, filename, empno, user_name, created_at
             FROM tt_pdf_watermark_logs
             ORDER BY created_at DESC
             LIMIT 100`
        );
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        console.error('pdfHub watermark-history error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// GET /watermarks — List all watermarks (accessible to owner or shared)
// ============================================================================
router.get('/watermarks', async (req, res) => {
    try {
        // Need empno to check shared access
        const token = req.headers.authorization?.split(' ')[1];
        let empno = null;
        if (token) {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            empno = decoded?.empno;
        }
        
        const query = empno 
            ? `SELECT DISTINCT w.* FROM tt_pdf_watermarks w
               LEFT JOIN tt_pdf_watermark_shares s ON w.id = s.watermark_id
               WHERE w.owner_empno = $1 OR s.shared_with_empno = $1 
               ORDER BY w.created_at DESC`
            : `SELECT * FROM tt_pdf_watermarks ORDER BY created_at DESC`;
            
        const result = await engPool.query(query, empno ? [empno] : []);
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        console.error('pdfHub getWatermarks error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// POST /watermarks — Create new watermark
// ============================================================================
router.post('/watermarks', async (req, res) => {
    try {
        const { name, text, color, opacity, font_size, angle, owner_empno } = req.body;
        const result = await engPool.query(
            `INSERT INTO tt_pdf_watermarks (name, text, color, opacity, font_size, angle, owner_empno)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, text, color, opacity, font_size, angle, owner_empno]
        );
        res.json({ result: 'true', data: result.rows[0] });
    } catch (err) {
        console.error('pdfHub createWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// PUT /watermarks/:id — Update existing watermark
// ============================================================================
router.put('/watermarks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, text, color, opacity, font_size, angle } = req.body;
        const result = await engPool.query(
            `UPDATE tt_pdf_watermarks 
             SET name = $1, text = $2, color = $3, opacity = $4, font_size = $5, angle = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [name, text, color, opacity, font_size, angle, id]
        );
        res.json({ result: 'true', data: result.rows[0] });
    } catch (err) {
        console.error('pdfHub updateWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// DELETE /watermarks/:id
// ============================================================================
router.delete('/watermarks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await engPool.query(`DELETE FROM tt_pdf_watermarks WHERE id = $1`, [id]);
        res.json({ result: 'true', message: 'Deleted' });
    } catch (err) {
        console.error('pdfHub deleteWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// POST /watermarks/:id/share
// ============================================================================
router.post('/watermarks/:id/share', async (req, res) => {
    try {
        const { id } = req.params;
        const { target_empno } = req.body;
        await engPool.query(
            `INSERT INTO tt_pdf_watermark_shares (watermark_id, shared_with_empno)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, target_empno]
        );
        res.json({ result: 'true', message: 'Shared' });
    } catch (err) {
        console.error('pdfHub shareWatermark error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
});

// ============================================================================
// POST /unlock — Unlock an encrypted PDF using Python pypdf
// ============================================================================
router.post('/unlock', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ result: 'false', message: 'No PDF file uploaded' });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(os.tmpdir(), `unlocked_${req.file.filename}.pdf`);
    const scriptPath = path.join(__dirname, 'pdf_unlocker.py');
    const pythonCmd = getPythonCmd();

    execFile(pythonCmd, [scriptPath, inputPath, outputPath], (error, stdout, stderr) => {
        if (error) {
            console.error('PDF Unlock Error:', stderr || error.message);
            fs.unlink(inputPath, () => {});
            return res.status(500).json({ result: 'false', message: 'Failed to unlock PDF' });
        }

        fs.readFile(outputPath, (err, data) => {
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});

            if (err) {
                console.error('PDF Unlock Read Error:', err.message);
                return res.status(500).json({ result: 'false', message: 'Failed to read unlocked PDF' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.send(data);
        });
    });
});

router.get('/test-unlock', (req, res) => {
    const inputPath = path.join(__dirname, '..', '..', '..', '..', 'ENG-Frontend', 'src', 'components', 'engineer', 'system_eng', 'pdf_hub', 'AS81935-8.pdf');
    const outputPath = path.join(os.tmpdir(), `test_unlock.pdf`);
    const scriptPath = path.join(__dirname, 'pdf_unlocker.py');
    const pythonCmd = getPythonCmd();

    execFile(pythonCmd, [scriptPath, inputPath, outputPath], (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ result: 'false', error: error.message, stderr });
        }
        res.json({ result: 'true', stdout });
    });
});

// ============================================================================
// POST /repair — Rebuild and clean a PDF using Python PyMuPDF
// ============================================================================
router.post('/repair', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ result: 'false', message: 'No PDF file uploaded' });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(os.tmpdir(), `repaired_${req.file.filename}.pdf`);
    const scriptPath = path.join(__dirname, 'pdf_rebuilder.py');
    const pythonCmd = getPythonCmd();

    execFile(pythonCmd, [scriptPath, inputPath, outputPath], (error, stdout, stderr) => {
        if (error) {
            console.error('PDF Repair Error:', stderr || error.message);
            fs.unlink(inputPath, () => {});
            return res.status(500).json({ result: 'false', message: 'Failed to repair PDF' });
        }

        fs.readFile(outputPath, (err, data) => {
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});

            if (err) {
                console.error('PDF Repair Read Error:', err.message);
                return res.status(500).json({ result: 'false', message: 'Failed to read repaired PDF' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.send(data);
        });
    });
});

module.exports = router;
