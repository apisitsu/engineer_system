const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { TABLES } = require('../mtcConstants');
const { hasFeature } = require('../../../../middleware/mtcAuth');
const { normalizeTarget, prefixLevel, cnMatchKeys, shapeFamiliesFor } = require('../utils/grindingPrefix');

// SDS image mutations are part of the SDS admin surface — same guard as every other
// SDS config write (sdsV2AdminController): full 'AD' admin OR the 'sds_admin' feature
// permission. Reads (GET) stay open to any authenticated user. Without this, an
// ENG/QA user (the SDS admin page is reachable by those roles) could upload, replace
// or delete tooling / grinding images that print onto operator setup sheets.
const isAdmin = hasFeature('sds_admin');

const router = express.Router();

// ── Tooling Images ──────────────────────────────────────────────────────────

/** GET /api/sds/v2/images/tooling/search?q= — search tool_dwg_no from lpb.eng_tooling
 *
 * ONE ROW PER DWG FAMILY, not per drawing. A tooling image is keyed on the 2-segment
 * family (`4918-02`) — that is what the PDF matches on — and the picker groups whatever
 * comes back down to families anyway. Returning raw drawings meant `LIMIT 20` was spent
 * inside the FIRST family: typing `4918` returned twenty `4918-01-xxxx` rows, so
 * **4918-02, -03 and -10 could not be selected at all**, and `4858` offered only 4858-01
 * out of that series' twenty-two families. An image for a family the picker cannot reach
 * never gets uploaded — reported from the floor for 4918-02 PALLET on 2026-08-26.
 *
 * `tool_name` is the family's most-planned ASCII name, matching what the SDS sheet prints
 * for a slot with no Tool No (see pickFamilyName), so the picker's label and the sheet
 * agree. A family whose drawings are all Japanese-named keeps its first name.
 *
 * The search also matches the NAME now, so "PALLET" finds 4918-02 — before this the
 * clause was `tool_dwg_no ILIKE` only and a name search silently returned nothing.
 */
router.get('/tooling/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);
  try {
    const term = `%${q.trim()}%`;
    // The plan count is a JOINed aggregate, not a per-row subquery: as a correlated
    // subquery this took 2-3 s, which an autocomplete firing per keystroke cannot wear.
    const result = await maqPool.query(
      `WITH fam AS (
         SELECT split_part(tool_dwg_no, '-', 1) || '-' || split_part(tool_dwg_no, '-', 2) AS family,
                tool_dwg_no, tool_name, machine_type
           FROM ${TABLES.LPB_ENG_TOOLING}
          WHERE tool_name IS NOT NULL AND tool_name <> ''
            AND (tool_dwg_no ILIKE $1 OR tool_name ILIKE $1)
       ), cnt AS (
         SELECT p.tool_dwg_no, count(*)::int AS n
           FROM ${TABLES.LPB_ENG_R_PI_TOOL} p
           JOIN fam f ON f.tool_dwg_no = p.tool_dwg_no
          GROUP BY 1
       )
       SELECT DISTINCT ON (f.family) f.family AS tool_dwg_no, f.tool_name, f.machine_type
         FROM fam f
         LEFT JOIN cnt c ON c.tool_dwg_no = f.tool_dwg_no
        ORDER BY f.family, (f.tool_name ~ '^[[:ascii:]]+$') DESC, COALESCE(c.n, 0) DESC, f.tool_name
        LIMIT 40`,
      [term]
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
router.post('/tooling', isAdmin, async (req, res) => {
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
router.delete('/tooling/:tool_dwg_no', isAdmin, async (req, res) => {
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

// ── Turning template cutting-tool photos ────────────────────────────────────
//
// The Turning grid template (sds_grid_template "Turning") has 8 photo boxes for its
// cutting-tool section (T01-T08 — not the F01-F08 jig/fixture section, which already
// gets its photo from T-Select via tool_image_T0N/turning_fixture_image_T0N). A cutting
// insert/holder has no reliable per-CN DWG the way a fixture does, so this is a STATIC
// picture per (machine, tool position) — the admin uploads a reference photo once and
// it prints on every sheet for that machine, unlike the fixture photos which change per
// CN following the factory plan.
//
// The key stored in `sds_v2_tooling_image` is a self-chosen string, not a real DWG
// number — see the comment on `_turningToolImages` in sdsV2HeadlessController.js. This
// route does BOTH halves of that mechanism (the internal `Tool_Photo_Key_N`
// sds_parameter row and the sds_v2_tooling_image row) in one call, keyed
// deterministically off (machine_type_name, slot) so the admin never has to type a
// matching code anywhere. `Tool_Photo_Key_N` is a purely internal link — it has no
// sds_excel_mapping row and never prints — kept deliberately separate from
// `Holder_Info_N`, which IS a real printed text field the admin edits via
// PUT /api/sds/v2/admin/parameters/bulk (see TurningToolImagesTab.jsx): reusing
// Holder_Info_N as the photo key would have silently overwritten whatever holder
// description was typed there.
const TURNING_TOOL_SLOTS = 8;
const turningToolKey = (machine, slot) => `TURN:${machine}:${slot}`;
// Besides the 8 cutting-tool positions, the same route stores the machine's single
// "Turning Cutting Layout" picture (slot 'layout', printed in the right-hand strip where the
// Standard sheet puts its Grinding Area picture). Its link param is likewise internal only.
const TURNING_LAYOUT_SLOT = 'layout';
const TURNING_LAYOUT_PARAM = 'Turning_Layout_Photo_Key';
const parseTurningSlot = (v) => {
  if (String(v) === TURNING_LAYOUT_SLOT) return TURNING_LAYOUT_SLOT;
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 1 && n <= TURNING_TOOL_SLOTS ? n : null;
};
const turningParamKey = (slot) => (slot === TURNING_LAYOUT_SLOT ? TURNING_LAYOUT_PARAM : `Tool_Photo_Key_${slot}`);

/** GET /api/sds/v2/images/turning-tool?machine_type_name=X-100 — all 8 slots' status */
router.get('/turning-tool', async (req, res) => {
  const machine = (req.query.machine_type_name || '').trim();
  if (!machine) return res.status(400).json({ error: 'machine_type_name is required' });
  try {
    const paramRows = await engPool.query(
      `SELECT param_key, param_value FROM ${TABLES.SDS_PARAMETER}
        WHERE machine_type_name = $1 AND cn IS NULL AND process_code IS NULL
          AND param_key = ANY($2)`,
      [machine, [TURNING_LAYOUT_PARAM, ...Array.from({ length: TURNING_TOOL_SLOTS }, (_, i) => `Tool_Photo_Key_${i + 1}`)]]
    );
    const keyBySlot = {};
    paramRows.rows.forEach((r) => {
      const slot = r.param_key === TURNING_LAYOUT_PARAM
        ? TURNING_LAYOUT_SLOT
        : parseInt(r.param_key.replace('Tool_Photo_Key_', ''), 10);
      if (r.param_value) keyBySlot[slot] = r.param_value;
    });
    const keys = Object.values(keyBySlot);
    let imgByKey = {};
    if (keys.length) {
      const imgRows = await engPool.query(
        `SELECT tool_dwg_no, updated_at FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = ANY($1)`,
        [keys]
      );
      imgByKey = Object.fromEntries(imgRows.rows.map((r) => [r.tool_dwg_no, r]));
    }
    const slots = [...Array.from({ length: TURNING_TOOL_SLOTS }, (_, i) => i + 1), TURNING_LAYOUT_SLOT].map((slot) => {
      const key = keyBySlot[slot] || null;
      const img = key ? imgByKey[key] : null;
      return { slot, key, has_image: !!img, updated_at: img?.updated_at || null };
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/images/turning-tool — upload/replace one slot's photo
 *  multipart: machine_type_name, slot (1-8), file (field: image) */
router.post('/turning-tool', isAdmin, async (req, res) => {
  const machine = (req.body.machine_type_name || '').trim();
  const slot = parseTurningSlot(req.body.slot);
  if (!machine) return res.status(400).json({ error: 'machine_type_name is required' });
  if (slot === null) {
    return res.status(400).json({ error: `slot must be an integer 1-${TURNING_TOOL_SLOTS} or '${TURNING_LAYOUT_SLOT}'` });
  }
  if (!req.files || !req.files.image) return res.status(400).json({ error: 'image file is required (field: image)' });

  const file = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
  const mime = file.mimetype || 'image/jpeg';
  const key = turningToolKey(machine, slot);
  const empno = req.user?.empno || null;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ${TABLES.SDS_V2_TOOLING_IMAGE}
         (tool_dwg_no, image_data, mime_type, file_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (tool_dwg_no) DO UPDATE SET
         image_data  = EXCLUDED.image_data,
         mime_type   = EXCLUDED.mime_type,
         file_name   = EXCLUDED.file_name,
         updated_by  = EXCLUDED.updated_by,
         updated_at  = NOW()`,
      [key, file.data, mime, file.name, empno]
    );
    await client.query(
      `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value, process_code, updated_by)
       VALUES (NULL, $1, $2, $3, NULL, $4)
       ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
       DO UPDATE SET param_value = EXCLUDED.param_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [machine, turningParamKey(slot), key, empno]
    );
    await client.query('COMMIT');
    res.json({ slot, key, has_image: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('SDS Turning Tool Image Upload Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/** DELETE /api/sds/v2/images/turning-tool/:machine_type_name/:slot */
router.delete('/turning-tool/:machine_type_name/:slot', isAdmin, async (req, res) => {
  const machine = req.params.machine_type_name;
  const slot = parseTurningSlot(req.params.slot);
  if (slot === null) {
    return res.status(400).json({ error: `slot must be an integer 1-${TURNING_TOOL_SLOTS} or '${TURNING_LAYOUT_SLOT}'` });
  }
  const key = turningToolKey(machine, slot);
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = $1`, [key]);
    await client.query(
      `DELETE FROM ${TABLES.SDS_PARAMETER}
        WHERE machine_type_name = $1 AND cn IS NULL AND process_code IS NULL AND param_key = $2`,
      [machine, turningParamKey(slot)]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
    // Same three-level rule the PDF renderer uses: a family prefix (C39) is covered by
    // its own image OR by the class image (C3). Matching only the exact prefix here would
    // list families as gaps that already print a picture.
    const matchImage = (prefix, pc) => {
      const { keys } = cnMatchKeys(prefix);   // ['C39','C3'] for a family prefix
      const hit = (level) => images.find((im) => {
        if (!(im.cn_prefixes || []).some(p => normalizeTarget(p) === level)) return false;
        const pcs = im.process_codes || [];
        return pcs.length === 0 || pcs.includes(pc);
      });
      for (const k of keys) {             // most specific first
        const im = hit(k);
        if (im) return im;
      }
      return undefined;
    };

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
    // A class-level entry (C3) has to be expanded to the family prefixes that actually
    // exist in factory data, or it reports "no shape data" while in fact covering more
    // parts than any other record — exactly the entry that most needs the check.
    const knownFamilies = [...mix.keys()];
    const imageRisk = images.map((im) => {
      const prefixes = [...new Set(
        (im.cn_prefixes || []).flatMap((p) => shapeFamiliesFor(p, knownFamilies))
      )];
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
 *
 * Accepts a full control-no, a family prefix or a class prefix and resolves the same way
 * the PDF renderer does (see utils/grindingPrefix): full → family → class, with a
 * process-specific image beating the process-default *within* one level.
 * Optional ?process_code=IDG001.
 */
router.get('/grinding/:cn_prefix', async (req, res) => {
  const { cn_prefix } = req.params;
  const { process_code } = req.query;
  try {
    const { exact, family, keys } = cnMatchKeys(cn_prefix);
    if (!keys.length) return res.status(400).json({ error: 'cn_prefix is required' });

    const result = await engPool.query(
      `SELECT image_data, mime_type, file_name FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
       WHERE (cn_prefixes && $1::text[])
         AND ($2::text IS NULL OR process_codes IS NULL OR process_codes = '{}' OR $2::text = ANY(process_codes))
       ORDER BY (CASE WHEN cn_prefixes && $3::text[] THEN 0
                      WHEN cn_prefixes && $4::text[] THEN 1
                      ELSE 2 END) ASC,
                ($2::text IS NOT NULL AND process_codes IS NOT NULL AND process_codes != '{}' AND $2::text = ANY(process_codes)) DESC NULLS LAST
       LIMIT 1`,
      [keys, process_code || null, exact, family ? [family] : []]
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
 * Shared parse/validate for the grinding upload + edit bodies (both are multipart, so
 * the arrays arrive as JSON strings). Returns `{ error }` or `{ prefixes, process_codes, label }`.
 *
 * Prefixes are normalised and level-checked here rather than at the DB: `cn_prefixes` is a
 * free text[], so a typo like 'c3 9' would insert happily and then match nothing forever,
 * with no error anywhere to explain the blank picture on the sheet.
 */
function parseGrindingTargets(body) {
  const { cn_prefixes: cn_prefixes_raw, process_codes: process_codes_raw } = body;
  if (cn_prefixes_raw == null) return { error: 'cn_prefixes is required' };

  let cn_prefixes;
  try {
    cn_prefixes = typeof cn_prefixes_raw === 'string' ? JSON.parse(cn_prefixes_raw) : cn_prefixes_raw;
  } catch (_) {
    return { error: 'cn_prefixes must be a JSON array' };
  }
  if (!Array.isArray(cn_prefixes) || !cn_prefixes.length) {
    return { error: 'cn_prefixes must be a non-empty array' };
  }

  // normalizeTarget upgrades a 6-digit item-no ('290774') to the control-no the renderer
  // compares against ('C29-00774') — typed daily and, stored raw, matches nothing forever.
  const prefixes = [...new Set(cn_prefixes.map(normalizeTarget).filter(Boolean))];
  const bad = prefixes.filter(p => prefixLevel(p) === 'unknown');
  if (bad.length) {
    return {
      error: `Invalid CN target(s): ${bad.join(', ')}. Use a class prefix (C3), a family prefix (C39), a control-no (C39-04137) or a 6-digit item-no (390 4137 → 394137).`,
    };
  }

  let process_codes = [];
  if (process_codes_raw) {
    try {
      const parsed = typeof process_codes_raw === 'string' ? JSON.parse(process_codes_raw) : process_codes_raw;
      process_codes = Array.isArray(parsed)
        ? [...new Set(parsed.map(c => String(c).trim()).filter(Boolean))]
        : [];
    } catch (_) { process_codes = []; }
  }

  const label = prefixes.join(', ') + (process_codes.length ? ` — ${process_codes.join(', ')}` : '');
  return { prefixes, process_codes, label };
}

/** POST /api/sds/v2/images/grinding — upload (fields: cn_prefixes JSON array, process_codes JSON array, file) */
router.post('/grinding', isAdmin, async (req, res) => {
  const parsed = parseGrindingTargets(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (!req.files || !req.files.image) return res.status(400).json({ error: 'image file is required (field: image)' });

  const { prefixes, process_codes, label } = parsed;

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

/**
 * PUT /api/sds/v2/images/grinding/:id — edit an existing record.
 *
 * Retargeting used to mean delete-and-re-upload, which forced the operator to still have
 * the original file on hand just to fix a prefix or add a process code; if they didn't,
 * the only way forward was to drop the picture entirely. The image file is therefore
 * **optional** here — omit it and only the targeting changes, send one and it replaces
 * the binary in place, keeping the same id (and so the same preview URL).
 *
 * Unlike POST this does NOT delete overlapping records: an edit is aimed at one row the
 * operator picked, and silently removing its neighbours is not what "save" should mean.
 */
router.put('/grinding/:id', isAdmin, async (req, res) => {
  const parsed = parseGrindingTargets(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { prefixes, process_codes, label } = parsed;

  const file = req.files?.image
    ? (Array.isArray(req.files.image) ? req.files.image[0] : req.files.image)
    : null;

  try {
    const result = await engPool.query(
      // Every parameter is cast explicitly: the COALESCE arms are NULL whenever no file was
      // sent, and pg cannot infer a bytea/text parameter from a bare NULL — it errors out
      // on exactly the "targeting only" edit this route exists to support.
      `UPDATE ${TABLES.SDS_V2_GRINDING_IMAGE} SET
         cn_prefixes   = $1::text[],
         process_codes = $2::text[],
         label         = $3::text,
         image_data    = COALESCE($4::bytea, image_data),
         mime_type     = COALESCE($5::text,  mime_type),
         file_name     = COALESCE($6::text,  file_name),
         updated_by    = $7::text,
         updated_at    = NOW()
       WHERE id = $8::int
       RETURNING id, cn_prefixes, process_codes, label, mime_type, file_name, updated_at`,
      [
        prefixes,
        process_codes,
        label,
        file ? file.data : null,
        file ? (file.mimetype || 'image/jpeg') : null,
        file ? file.name : null,
        req.user?.empno || null,
        req.params.id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Image not found' });
    _covCache = null;   // retargeting moves which combos are covered
    res.json(result.rows[0]);
  } catch (err) {
    console.error('SDS Grinding Update Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/images/grinding/:id */
router.delete('/grinding/:id', isAdmin, async (req, res) => {
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
