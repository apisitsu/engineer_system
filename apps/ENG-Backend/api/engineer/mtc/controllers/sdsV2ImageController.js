const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { TABLES } = require('../mtcConstants');

const router = express.Router();

// ── Tooling Images ──────────────────────────────────────────────────────────

/** GET /api/sds/v2/images/tooling/search?q= — search tool_dwg_no from lpb.eng_tooling */
router.get('/tooling/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);
  try {
    const result = await maqPool.query(
      `SELECT tool_dwg_no, tool_name, machine_type
       FROM ${TABLES.LPB_ENG_TOOLING}
       WHERE tool_dwg_no ILIKE $1
       ORDER BY tool_dwg_no
       LIMIT 20`,
      [`%${q.trim()}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/images/tooling — list all with tool_name enriched from lpb.eng_tooling */
router.get('/tooling', async (_req, res) => {
  try {
    const imgResult = await engPool.query(
      `SELECT id, tool_dwg_no, mime_type, file_name, description, created_by, updated_by, created_at, updated_at
       FROM ${TABLES.SDS_V2_TOOLING_IMAGE} ORDER BY tool_dwg_no`
    );
    const rows = imgResult.rows;
    if (!rows.length) return res.json([]);

    const dwgNos = rows.map(r => r.tool_dwg_no);
    const toolResult = await maqPool.query(
      `SELECT tool_dwg_no, tool_name FROM ${TABLES.LPB_ENG_TOOLING} WHERE tool_dwg_no = ANY($1)`,
      [dwgNos]
    );
    const toolMap = {};
    toolResult.rows.forEach(r => { toolMap[r.tool_dwg_no] = r.tool_name; });

    res.json(rows.map(r => ({ ...r, tool_name: toolMap[r.tool_dwg_no] || r.description || null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/images/tooling/:tool_dwg_no — serve image binary */
router.get('/tooling/:tool_dwg_no', async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = $1`,
      [req.params.tool_dwg_no]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Image not found' });
    const { image_data, mime_type, file_name } = result.rows[0];
    res.setHeader('Content-Type', mime_type || 'image/jpeg');
    if (file_name) res.setHeader('Content-Disposition', `inline; filename="${file_name}"`);
    res.send(image_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/images/tooling — upload (multipart: tool_dwg_no, file, description) */
router.post('/tooling', async (req, res) => {
  const { tool_dwg_no, description } = req.body;
  if (!tool_dwg_no?.trim()) return res.status(400).json({ error: 'tool_dwg_no is required' });
  if (!req.files || !req.files.image) return res.status(400).json({ error: 'image file is required (field: image)' });

  // express-fileupload: if multiple files with same name are uploaded, it becomes an array
  const file = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
  const mime = file.mimetype || 'image/jpeg';

  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_V2_TOOLING_IMAGE}
         (tool_dwg_no, image_data, mime_type, file_name, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (tool_dwg_no) DO UPDATE SET
         image_data  = EXCLUDED.image_data,
         mime_type   = EXCLUDED.mime_type,
         file_name   = EXCLUDED.file_name,
         description = EXCLUDED.description,
         updated_by  = EXCLUDED.updated_by,
         updated_at  = NOW()
       RETURNING id, tool_dwg_no, mime_type, file_name, description, updated_at`,
      [tool_dwg_no.trim(), file.data, mime, file.name, description || null, req.user?.empno || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('SDS Tooling Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/images/tooling/:tool_dwg_no */
router.delete('/tooling/:tool_dwg_no', async (req, res) => {
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = $1 RETURNING id`,
      [req.params.tool_dwg_no]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('SDS Tooling Delete Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Grinding Images ─────────────────────────────────────────────────────────

/** GET /api/sds/v2/images/grinding — list all (metadata only) */
router.get('/grinding', async (_req, res) => {
  try {
    const result = await engPool.query(
      `SELECT id, cn_prefixes, process_code, label, mime_type, file_name, description, created_by, updated_by, created_at, updated_at
       FROM ${TABLES.SDS_V2_GRINDING_IMAGE} ORDER BY cn_prefixes[1], process_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/images/grinding/:id — serve image binary by record ID
 */
router.get('/grinding/view/:id', async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE} WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Grinding image not found' });
    const { image_data, mime_type, file_name } = result.rows[0];
    res.setHeader('Content-Type', mime_type || 'image/jpeg');
    if (file_name) res.setHeader('Content-Disposition', `inline; filename="${file_name}"`);
    res.send(image_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/images/grinding/:cn_prefix — serve image binary (Legacy/Lookup)
 * Optional ?process_code=IDG001 to get process-specific image; falls back to default (process_code IS NULL)
 */
router.get('/grinding/:cn_prefix', async (req, res) => {
  const { cn_prefix } = req.params;
  const { process_code } = req.query;
  try {
    let result;
    if (process_code) {
      result = await engPool.query(
        `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
         WHERE $1 = ANY(cn_prefixes) AND process_code = $2 LIMIT 1`,
        [cn_prefix, process_code]
      );
      if (!result.rows[0]) {
        result = await engPool.query(
          `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
           WHERE $1 = ANY(cn_prefixes) AND process_code IS NULL LIMIT 1`,
          [cn_prefix]
        );
      }
    } else {
      result = await engPool.query(
        `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
         WHERE $1 = ANY(cn_prefixes) AND process_code IS NULL LIMIT 1`,
        [cn_prefix]
      );
    }
    if (!result.rows[0]) return res.status(404).json({ error: 'Grinding image not found' });
    const { image_data, mime_type, file_name } = result.rows[0];
    res.setHeader('Content-Type', mime_type || 'image/jpeg');
    if (file_name) res.setHeader('Content-Disposition', `inline; filename="${file_name}"`);
    res.send(image_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/images/grinding — upload (fields: cn_prefixes JSON array, process_code, file) */
router.post('/grinding', async (req, res) => {
  const { cn_prefixes: cn_prefixes_raw, process_code } = req.body;
  if (!cn_prefixes_raw) return res.status(400).json({ error: 'cn_prefixes is required' });
  if (!req.files || !req.files.image) return res.status(400).json({ error: 'image file is required (field: image)' });

  let cn_prefixes;
  try {
    cn_prefixes = typeof cn_prefixes_raw === 'string' ? JSON.parse(cn_prefixes_raw) : cn_prefixes_raw;
  } catch (_) {
    return res.status(400).json({ error: 'cn_prefixes must be a JSON array' });
  }
  if (!Array.isArray(cn_prefixes) || !cn_prefixes.length) {
    return res.status(400).json({ error: 'cn_prefixes must be a non-empty array' });
  }

  const prefixes = cn_prefixes.map(p => String(p).trim()).filter(Boolean);
  const process_code_val = process_code?.trim() || null;
  const label = prefixes.join(', ') + (process_code_val ? ` — ${process_code_val}` : '');

  const file = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
  const mime = file.mimetype || 'image/jpeg';

  try {
    // Replace any existing records that overlap with the same prefixes + process_code
    await engPool.query(
      `DELETE FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
       WHERE cn_prefixes && $1::text[]
         AND (process_code IS NOT DISTINCT FROM $2)`,
      [prefixes, process_code_val]
    );

    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_V2_GRINDING_IMAGE}
         (cn_prefixes, process_code, label, image_data, mime_type, file_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, cn_prefixes, process_code, label, mime_type, file_name, updated_at`,
      [
        prefixes,
        process_code_val,
        label,
        file.data,
        mime,
        file.name,
        req.user?.empno || null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('SDS Grinding Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/images/grinding/:id */
router.delete('/grinding/:id', async (req, res) => {
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_V2_GRINDING_IMAGE} WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
