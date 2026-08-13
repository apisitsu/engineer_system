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
      `SELECT id, cn_prefixes, process_codes, label, mime_type, file_name, description, created_by, updated_by, created_at, updated_at
       FROM ${TABLES.SDS_V2_GRINDING_IMAGE} ORDER BY cn_prefixes[1], process_codes[1]`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/images/grinding/coverage — which (CN prefix × grinding process) pairs
 * that actually exist in the factory process plans still have NO image, plus a shape-mix
 * risk read on the images that DO exist.
 *
 * Must stay above `/grinding/:cn_prefix` — that route is a catch-all and would otherwise
 * swallow the literal path `coverage`.
 *
 * "Covered" is decided by the same rule the PDF renderer uses (see the grinding lookup in
 * sdsV2HeadlessController): the prefix must be in `cn_prefixes`, and `process_codes` must
 * either be empty (default image) or contain the process. Anything else is a gap.
 *
 * The shape columns differ per family and BALL has none at all — a family with no shape
 * column reports `shape_mix: null` rather than pretending it verified something.
 */
const GRINDING_SHAPE_SQL = `
  SELECT control_no, nullif(shape_code, '')   AS shape FROM ${TABLES.LPB_ENG_BODY}
  UNION ALL SELECT control_no, nullif(shape_code, '')   FROM ${TABLES.LPB_ENG_RACE}
  UNION ALL SELECT control_no, nullif(flange_shape, '') FROM ${TABLES.LPB_ENG_SLEEVE}
  UNION ALL SELECT control_no, nullif(shape, '')        FROM ${TABLES.LPB_ENG_SPH}`;

const familyOf = (p) => {
  if (/^C1[1-9]$|^C5[1-9]$/.test(p)) return 'BODY';
  if (/^C2[1-9]$/.test(p)) return 'RACE';
  if (/^C3[1-9]$/.test(p)) return 'BALL';
  if (/^C6[1-9]$/.test(p)) return 'SLEEVE';
  if (/^A4[1-9]$/.test(p)) return 'SPHERICAL';
  if (/^F0/.test(p)) return 'FINISH GOODS';
  return 'OTHER';
};

// The whole build is ~0.8s, so a short in-memory TTL is enough — no persisted cache.
let _covCache = null; // { at, payload }
const COV_TTL_MS = 5 * 60 * 1000;

router.get('/grinding/coverage', async (req, res) => {
  try {
    if (_covCache && !req.query.refresh && Date.now() - _covCache.at < COV_TTL_MS) {
      return res.json({ ..._covCache.payload, cached: true });
    }

    const [planRes, shapeRes, imgRes] = await Promise.all([
      maqPool.query(
        `SELECT left(pi.process_plan_no, 3) AS cn_prefix,
                pi.process_code,
                p.process_eng AS process_name,
                count(DISTINCT pi.process_plan_no)::int AS cns
           FROM ${TABLES.LPB_ENG_PROCESS_INFO} pi
           JOIN ${TABLES.LPB_ENG_ITEM} i
             ON i.control_no = pi.process_plan_no AND i.condition = 'Enable'
           LEFT JOIN ${TABLES.LPB_ENG_PROCESS} p ON p.process_code = pi.process_code
          WHERE p.process_eng ILIKE '%GRIND%' OR p.process_name LIKE '%研%'
          GROUP BY 1, 2, 3`
      ),
      maqPool.query(GRINDING_SHAPE_SQL),
      engPool.query(
        `SELECT id, cn_prefixes, process_codes, label FROM ${TABLES.SDS_V2_GRINDING_IMAGE}`
      ),
    ]);

    // shape distribution per 3-char prefix
    const mix = new Map();
    for (const r of shapeRes.rows) {
      if (!r.shape) continue;
      const p = String(r.control_no).slice(0, 3);
      if (!mix.has(p)) mix.set(p, new Map());
      const m = mix.get(p);
      m.set(r.shape, (m.get(r.shape) || 0) + 1);
    }
    const shapeInfo = (prefix) => {
      const m = mix.get(prefix);
      if (!m) return { shape_mix: null, dominant_shape: null, dominant_share: null };
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
      return {
        shape_mix: sorted.map(([shape, n]) => ({ shape, n })),
        dominant_shape: sorted[0][0],
        dominant_share: +(sorted[0][1] / total).toFixed(4),
      };
    };

    const images = imgRes.rows;
    const matchImage = (prefix, pc) => images.find((im) => {
      if (!(im.cn_prefixes || []).includes(prefix)) return false;
      const pcs = im.process_codes || [];
      return pcs.length === 0 || pcs.includes(pc);
    });

    const combos = planRes.rows.map((r) => ({
      cn_prefix: r.cn_prefix,
      process_code: r.process_code,
      process_name: r.process_name || null,
      cns: r.cns,
      family: familyOf(r.cn_prefix),
      image_id: matchImage(r.cn_prefix, r.process_code)?.id || null,
      ...shapeInfo(r.cn_prefix),
    }));

    const gaps = combos.filter((c) => !c.image_id).sort((a, b) => b.cns - a.cns);
    const covered = combos.filter((c) => c.image_id);
    const sum = (arr) => arr.reduce((a, c) => a + c.cns, 0);
    const cnsCovered = sum(covered);
    const cnsGap = sum(gaps);

    // Shape risk per image: one picture, how many distinct shapes is it standing in for?
    const imageRisk = images.map((im) => {
      const prefixes = (im.cn_prefixes || []).filter((p) => /^[A-Z]\d{2}$/.test(p));
      const agg = new Map();
      for (const p of prefixes) {
        const m = mix.get(p);
        if (!m) continue;
        m.forEach((n, s) => agg.set(s, (agg.get(s) || 0) + n));
      }
      const total = [...agg.values()].reduce((a, b) => a + b, 0);
      if (!total) {
        return { id: im.id, label: im.label, served_cns: 0, off_shape_cns: null, shape_mix: null };
      }
      const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]);
      return {
        id: im.id,
        label: im.label,
        served_cns: total,
        dominant_shape: sorted[0][0],
        dominant_share: +(sorted[0][1] / total).toFixed(4),
        off_shape_cns: total - sorted[0][1],
        shape_mix: sorted.map(([shape, n]) => ({ shape, n })),
      };
    }).sort((a, b) => (b.off_shape_cns || 0) - (a.off_shape_cns || 0));

    const payload = {
      generated_at: new Date().toISOString(),
      summary: {
        combos: combos.length,
        covered: covered.length,
        gaps: gaps.length,
        cns_covered: cnsCovered,
        cns_gap: cnsGap,
        coverage_pct: cnsCovered + cnsGap ? +((cnsCovered / (cnsCovered + cnsGap)) * 100).toFixed(1) : 0,
      },
      gaps,
      image_risk: imageRisk,
    };
    _covCache = { at: Date.now(), payload };
    res.json(payload);
  } catch (err) {
    console.error('SDS Grinding Coverage Error:', err);
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
 * Optional ?process_code=IDG001 to get process-specific image; falls back to default (empty process_codes)
 */
router.get('/grinding/:cn_prefix', async (req, res) => {
  const { cn_prefix } = req.params;
  const { process_code } = req.query;
  try {
    let result;
    if (process_code) {
      result = await engPool.query(
        `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
         WHERE $1 = ANY(cn_prefixes) AND $2 = ANY(process_codes) LIMIT 1`,
        [cn_prefix, process_code]
      );
      if (!result.rows[0]) {
        result = await engPool.query(
          `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
           WHERE $1 = ANY(cn_prefixes) AND (process_codes IS NULL OR process_codes = '{}') LIMIT 1`,
          [cn_prefix]
        );
      }
    } else {
      result = await engPool.query(
        `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
         WHERE $1 = ANY(cn_prefixes) AND (process_codes IS NULL OR process_codes = '{}') LIMIT 1`,
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

/** POST /api/sds/v2/images/grinding — upload (fields: cn_prefixes JSON array, process_codes JSON array, file) */
router.post('/grinding', async (req, res) => {
  const { cn_prefixes: cn_prefixes_raw, process_codes: process_codes_raw } = req.body;
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

  let process_codes = [];
  if (process_codes_raw) {
    try {
      const parsed = typeof process_codes_raw === 'string' ? JSON.parse(process_codes_raw) : process_codes_raw;
      process_codes = Array.isArray(parsed) ? parsed.map(c => String(c).trim()).filter(Boolean) : [];
    } catch (_) { process_codes = []; }
  }

  const prefixes = cn_prefixes.map(p => String(p).trim()).filter(Boolean);
  const label = prefixes.join(', ') + (process_codes.length ? ` — ${process_codes.join(', ')}` : '');

  const file = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
  const mime = file.mimetype || 'image/jpeg';

  try {
    // Replace existing records that overlap cn_prefixes AND have overlapping process_codes
    await engPool.query(
      `DELETE FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
       WHERE cn_prefixes && $1::text[]
         AND (
           (cardinality($2::text[]) = 0 AND (process_codes IS NULL OR process_codes = '{}'))
           OR (cardinality($2::text[]) > 0 AND process_codes && $2::text[])
         )`,
      [prefixes, process_codes]
    );

    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_V2_GRINDING_IMAGE}
         (cn_prefixes, process_codes, label, image_data, mime_type, file_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, cn_prefixes, process_codes, label, mime_type, file_name, updated_at`,
      [
        prefixes,
        process_codes,
        label,
        file.data,
        mime,
        file.name,
        req.user?.empno || null,
      ]
    );
    _covCache = null;   // an upload changes coverage — never serve the pre-upload gap list
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
    _covCache = null;   // a delete re-opens a gap
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
