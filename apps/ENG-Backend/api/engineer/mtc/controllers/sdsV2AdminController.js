const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const { isAdmin } = require('../../../../middleware/mtcAuth');
const cache = require('../services/agents/CacheAgent');
const { invalidateCoverageCache } = require('./sdsV2ReportController');

const router = express.Router();
const headlessController = require('./sdsV2HeadlessController');
const ExcelJS = require('exceljs');
const path = require('path');

const SDS_XLSX_TEMPLATE = path.join(__dirname, '../templates/sds_template.xlsx');

// Excel border style → editor edge { w(px), s(css style) }
const XLSX_BORDER_STYLE = {
  hair: { w: 0.5, s: 'solid' }, thin: { w: 1, s: 'solid' }, medium: { w: 1.5, s: 'solid' }, thick: { w: 2.5, s: 'solid' },
  dotted: { w: 1, s: 'dotted' }, dashed: { w: 1, s: 'dashed' }, dashDot: { w: 1, s: 'dashed' }, dashDotDot: { w: 1, s: 'dashed' },
  mediumDashed: { w: 1.5, s: 'dashed' }, double: { w: 2.5, s: 'double' }, slantDashDot: { w: 1, s: 'dashed' },
};
const argbToHex = (argb) => {
  if (!argb) return null;
  const s = String(argb);
  return '#' + (s.length === 8 ? s.slice(2) : s).toLowerCase();
};
const xlsxEdge = (side) => {
  if (!side || !side.style) return null;
  const m = XLSX_BORDER_STYLE[side.style] || { w: 1, s: 'solid' };
  return { w: m.w, s: m.s, c: argbToHex(side.color && side.color.argb) || '#000000' };
};

/** Parse sds_template.xlsx into the editor's grid model (A1:AV56). */
async function parseSdsXlsxGrid() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SDS_XLSX_TEMPLATE);
  const ws = wb.worksheets[0];
  const rows = 56, cols = 48;
  const colW = [], rowH = [], borders = {}, fills = {}, cells = {};
  for (let c = 1; c <= cols; c++) {
    const w = ws.getColumn(c).width;            // Excel char units
    colW.push(Math.max(8, Math.round((Number(w) || 8.43) * 7 + 5)));
  }
  for (let r = 1; r <= rows; r++) {
    const h = ws.getRow(r).height;              // points
    rowH.push(Math.max(8, Math.round((Number(h) || 15) * 96 / 72)));
  }
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getCell(r, c);
      const bd = cell.border || {};
      const e = {};
      const t = xlsxEdge(bd.top), rr = xlsxEdge(bd.right), bb = xlsxEdge(bd.bottom), ll = xlsxEdge(bd.left);
      if (t) e.t = t; if (rr) e.r = rr; if (bb) e.b = bb; if (ll) e.l = ll;
      if (Object.keys(e).length) borders[`${r - 1},${c - 1}`] = e;
      const f = cell.fill;
      if (f && f.type === 'pattern' && f.pattern === 'solid' && f.fgColor) {
        const hex = argbToHex(f.fgColor.argb);
        if (hex && hex !== '#ffffff') fills[`${r - 1},${c - 1}`] = hex;
      }
      // Text + font + alignment (master cell only — reading .text on a covered
      // merge cell whose master is empty throws inside exceljs, so skip those).
      const isCovered = cell.isMerged && cell.master && cell.master.address !== cell.address;
      if (!isCovered) {
        let txt = '';
        try { txt = cell.text; } catch (_) { txt = ''; }
        const hasText = txt != null && String(txt).trim() !== '';
        const fnt = cell.font || {}, al = cell.alignment || {};
        const fontColor = argbToHex(fnt.color && fnt.color.argb);
        // Capture cells with text OR a meaningful font, so EMPTY dynamic-value
        // placeholders keep their designed colour (e.g. the red header value cells).
        if (hasText || (fontColor && fontColor !== '#000000') || fnt.bold || fnt.italic) {
          const cell0 = {
            f: { name: fnt.name || null, size: fnt.size || null, bold: !!fnt.bold, italic: !!fnt.italic, color: fontColor || null },
            a: { h: al.horizontal || null, v: al.vertical || null, wrap: !!al.wrapText },
          };
          if (hasText) cell0.v = String(txt);
          cells[`${r - 1},${c - 1}`] = cell0;
        }
      }
    }
  }
  const merges = (ws.model.merges || []).map((rng) => {
    const m = String(rng).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) return null;
    const col = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    return { r1: +m[2] - 1, c1: col(m[1]), r2: +m[4] - 1, c2: col(m[3]) };
  }).filter(Boolean);
  return { rows, cols, colW, rowH, borders, fills, cells, merges };
}

// Flush the SDS search/PDF cache (sds:* keys, 10-min TTL) after a successful
// config mutation, so edits to parameters / tool lists / cell mappings are
// reflected on the very next search & PDF. Without this, template-setup edits
// appear to "not take" until the TTL expires. (machine-types routes already
// invalidate inline.)
// Also flushes the coverage cache so the report picks up new machine templates
// and tool configs immediately without waiting for the 15-min TTL.
const flushSds = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      cache.invalidatePrefix('sds:');
      invalidateCoverageCache();
    }
  });
  next();
};

/**
 * Resolve floor machine_code → { machine_name, machine_type_code } from a single
 * source of truth chain (no reliance on redundant sds_machine_code rows):
 *   machine_name      = rodpc.m_machine.TRIM(m_model) [base], overridden by sds_machine_code [exceptions only]
 *   machine_type_code = sds_machine_code override if set, else derived from the
 *                       sds_machine_type_code dictionary by resolved name (active rows only)
 * Keeps admin grids correct even after sds_machine_code is trimmed to override rows.
 */
async function buildMachineResolver() {
  const [rodpc, sds, dict] = await Promise.all([
    rodpcPool.query(`SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine WHERE m_model IS NOT NULL`).catch(() => ({ rows: [] })),
    engPool.query(`SELECT machine_code, machine_name, machine_type_code FROM ${TABLES.SDS_MACHINE_CODE}`),
    engPool.query(`SELECT machine_type_name, machine_type_code FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE is_active AND machine_type_name IS NOT NULL`),
  ]);
  const baseName = new Map();
  for (const r of rodpc.rows) if (r.m_model) baseName.set(r.machine_code, r.m_model);
  const overrideName = new Map(), overrideType = new Map();
  for (const r of sds.rows) {
    if (r.machine_name) overrideName.set(r.machine_code, r.machine_name);
    if (r.machine_type_code) overrideType.set(r.machine_code, r.machine_type_code);
  }
  const codeByName = new Map(); // name → single active code (lowest wins if a dup slips through)
  for (const r of dict.rows) {
    const code = String(r.machine_type_code);
    const cur = codeByName.get(r.machine_type_name);
    if (cur == null || code < cur) codeByName.set(r.machine_type_name, code);
  }
  const nameOf = (code) => overrideName.get(code) || baseName.get(code) || code;
  const typeCodeOf = (code) =>
    overrideType.has(code) ? overrideType.get(code) : (codeByName.get(nameOf(code)) || null);
  return { nameOf, typeCodeOf };
}

// ── Machine Type Codes ───────────────────────────────────────────────────────

/** GET /api/sds/v2/admin/machine-types
 *  ?nodedupe=true  — skip group deduplication (SdsV2Page needs all codes for prefix lookup)
 */
router.get('/machine-types', async (req, res) => {
  const { search, nodedupe } = req.query;
  try {
    let sql = `SELECT id, machine_type_code, machine_type_name, grinding_area_label, tool_code_filter, is_active, created_at, machine_group
               FROM ${TABLES.SDS_MACHINE_TYPE_CODE}`;
    const params = [];
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` WHERE machine_type_name ILIKE $1 OR machine_type_code ILIKE $1`;
    }
    sql += ' ORDER BY machine_type_code';
    const result = await engPool.query(sql, params);

    if (nodedupe === 'true') {
      return res.json(result.rows);
    }

    // Deduplicate grouped machines: return one representative per machine_group.
    // Pick the row with the lowest id within each group (machine_type_code ORDER BY is string-based
    // so '1000' < '664' — id is the reliable tiebreak for canonically-primary machine).
    const groupRepMap = {};
    for (const m of result.rows) {
      if (!m.machine_group) continue;
      if (!groupRepMap[m.machine_group] || m.id < groupRepMap[m.machine_group].id) {
        groupRepMap[m.machine_group] = m;
      }
    }
    const seenGroups = new Set();
    const deduped = result.rows.reduce((acc, m) => {
      if (!m.machine_group) { acc.push(m); return acc; }
      if (!seenGroups.has(m.machine_group) && groupRepMap[m.machine_group].id === m.id) {
        seenGroups.add(m.machine_group);
        acc.push(m);
      }
      return acc;
    }, []);

    res.json(deduped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/machine-types/:id
 *  If machine_type_name changes, cascades the rename to sds_parameter,
 *  sds_machine_tool, and sds_excel_mapping in a single transaction, then
 *  flushes the SDS search cache so stale results are not served.
 */
router.put('/machine-types/:id', isAdmin, async (req, res) => {
  const { machine_type_code, machine_type_name, machine_group, grinding_area_label, tool_code_filter, is_active } = req.body;
  try {
    const sets = [];
    const vals = [];
    if (machine_type_code !== undefined) { vals.push(String(machine_type_code).trim()); sets.push(`machine_type_code=$${vals.length}`); }
    if (machine_type_name !== undefined) { vals.push(machine_type_name); sets.push(`machine_type_name=$${vals.length}`); }
    if (machine_group !== undefined) { vals.push(machine_group?.trim() || null); sets.push(`machine_group=$${vals.length}`); }
    if (grinding_area_label !== undefined) { vals.push(grinding_area_label); sets.push(`grinding_area_label=$${vals.length}`); }
    if (tool_code_filter !== undefined) { vals.push(tool_code_filter || null); sets.push(`tool_code_filter=$${vals.length}`); }
    if (is_active !== undefined) { vals.push(is_active); sets.push(`is_active=$${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);

    const client = await engPool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        `SELECT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE id=$1 FOR UPDATE`,
        [req.params.id]
      );
      if (!current.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Machine type not found' });
      }
      const oldName = current.rows[0].machine_type_name;

      const result = await client.query(
        `UPDATE ${TABLES.SDS_MACHINE_TYPE_CODE} SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`,
        vals
      );

      if (machine_type_name !== undefined && machine_type_name !== oldName) {
        await Promise.all([
          client.query(`UPDATE ${TABLES.SDS_PARAMETER}      SET machine_type_name=$1 WHERE machine_type_name=$2`, [machine_type_name, oldName]),
          client.query(`UPDATE ${TABLES.SDS_V2_MACHINE_TOOL} SET machine_type=$1       WHERE machine_type=$2`,       [machine_type_name, oldName]),
          client.query(`UPDATE ${TABLES.SDS_EXCEL_MAPPING}  SET machine_type_name=$1 WHERE machine_type_name=$2`, [machine_type_name, oldName]),
        ]);
        cache.invalidatePrefix('sds:');
      }

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/admin/machine-types — create a new machine type code */
router.post('/machine-types', isAdmin, async (req, res) => {
  const { machine_type_code, machine_type_name, machine_group, grinding_area_label, tool_code_filter, is_active } = req.body;
  if (!machine_type_code?.toString().trim() || !machine_type_name?.toString().trim()) {
    return res.status(400).json({ error: 'machine_type_code and machine_type_name are required' });
  }
  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_MACHINE_TYPE_CODE}
         (machine_type_code, machine_type_name, machine_group, grinding_area_label, tool_code_filter, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        String(machine_type_code).trim(),
        String(machine_type_name).trim(),
        machine_group?.trim() || null,
        grinding_area_label?.trim() || null,
        tool_code_filter?.trim() || null,
        is_active !== false,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/admin/machine-types/:id
 *  Blocks deletion when the machine_type_name is still referenced by SDS config
 *  (sds_parameter / sds_machine_tool / sds_excel_mapping) unless ?force=true.
 */
router.delete('/machine-types/:id', isAdmin, async (req, res) => {
  try {
    const cur = await engPool.query(
      `SELECT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE id=$1`,
      [req.params.id]
    );
    if (!cur.rows[0]) return res.status(404).json({ error: 'Machine type not found' });
    const name = cur.rows[0].machine_type_name;

    if (req.query.force !== 'true') {
      const [p, t, m] = await Promise.all([
        engPool.query(`SELECT COUNT(*)::int AS c FROM ${TABLES.SDS_PARAMETER}      WHERE machine_type_name=$1`, [name]),
        engPool.query(`SELECT COUNT(*)::int AS c FROM ${TABLES.SDS_V2_MACHINE_TOOL} WHERE machine_type=$1`,       [name]),
        engPool.query(`SELECT COUNT(*)::int AS c FROM ${TABLES.SDS_EXCEL_MAPPING}  WHERE machine_type_name=$1`, [name]),
      ]);
      const refs = { sds_parameter: p.rows[0].c, sds_machine_tool: t.rows[0].c, sds_excel_mapping: m.rows[0].c };
      const totalRefs = refs.sds_parameter + refs.sds_machine_tool + refs.sds_excel_mapping;
      if (totalRefs > 0) {
        return res.status(409).json({
          error: `"${name}" is still referenced by SDS config (${totalRefs} rows). Reassign/remove them first, or delete with force.`,
          references: refs,
        });
      }
    }

    await engPool.query(`DELETE FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE id=$1`, [req.params.id]);
    cache.invalidatePrefix('sds:');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Excel Mapping ────────────────────────────────────────────────────────────

/** GET /api/sds/v2/admin/mappings?machine_type_name= */
router.get('/mappings', async (req, res) => {
  const { machine_type_name } = req.query;
  try {
    let sql = `SELECT * FROM ${TABLES.SDS_EXCEL_MAPPING} WHERE is_active = true`;
    const params = [];
    if (machine_type_name !== undefined) {
      if (machine_type_name === '' || machine_type_name === 'null') {
        sql += ` AND machine_type_name IS NULL`;
      } else {
        params.push(machine_type_name);
        sql += ` AND (machine_type_name IS NULL OR machine_type_name = $${params.length})`;
      }
    }
    sql += ' ORDER BY sort_order, cell_address';
    const result = await engPool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/admin/mappings */
router.post('/mappings', isAdmin, flushSds, async (req, res) => {
  const { machine_type_name, cell_address, param_key, description, sort_order } = req.body;
  if (!cell_address?.trim() || !param_key?.trim()) {
    return res.status(400).json({ error: 'cell_address and param_key are required' });
  }
  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_EXCEL_MAPPING} (machine_type_name, cell_address, param_key, description, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [machine_type_name || null, cell_address.trim(), param_key.trim(), description || null, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Mapping already exists for this machine_type_name + cell_address' });
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/mappings/:id */
router.put('/mappings/:id', isAdmin, flushSds, async (req, res) => {
  const { machine_type_name, cell_address, param_key, description, sort_order, is_active } = req.body;
  try {
    const result = await engPool.query(
      `UPDATE ${TABLES.SDS_EXCEL_MAPPING}
       SET machine_type_name=$1, cell_address=$2, param_key=$3, description=$4, sort_order=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [machine_type_name || null, cell_address, param_key, description || null, sort_order ?? 0, is_active ?? true, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Mapping not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Mapping conflict: duplicate cell_address for this machine type' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/admin/mappings/:id */
router.delete('/mappings/:id', isAdmin, flushSds, async (req, res) => {
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_EXCEL_MAPPING} WHERE id=$1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SDS Parameters ────────────────────────────────────────────────────────────

/**
 * GET /api/sds/v2/admin/parameters?cn=&machine_type_name=
 * cn=null (or omit) → machine-type config (cn IS NULL)
 * cn=C31-01234     → per-record data
 */
router.get('/parameters', async (req, res) => {
  const { cn, machine_type_name } = req.query;
  if (!machine_type_name?.trim()) return res.status(400).json({ error: 'machine_type_name is required' });
  try {
    const isNull = !cn || cn === 'null';
    let result;
    if (isNull) {
      result = await engPool.query(
        `SELECT id, machine_type_name, param_key, param_value, updated_by, updated_at
         FROM ${TABLES.SDS_PARAMETER}
         WHERE cn IS NULL AND machine_type_name = $1
         ORDER BY param_key`,
        [machine_type_name.trim()]
      );
    } else {
      result = await engPool.query(
        `SELECT id, cn, machine_type_name, param_key, param_value, updated_by, updated_at
         FROM ${TABLES.SDS_PARAMETER}
         WHERE cn = $1 AND machine_type_name = $2
         ORDER BY param_key`,
        [cn.trim(), machine_type_name.trim()]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sds/v2/admin/parameters — upsert a single parameter
 * Body: { cn, machine_type_name, param_key, param_value }
 * cn null/omitted → machine config row
 */
router.put('/parameters', isAdmin, flushSds, async (req, res) => {
  const { cn, machine_type_name, param_key, param_value } = req.body;
  if (!machine_type_name?.trim() || !param_key?.trim()) {
    return res.status(400).json({ error: 'machine_type_name and param_key are required' });
  }
  const cnVal = cn && cn !== 'null' ? cn.trim() : null;
  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key)
       DO UPDATE SET param_value = EXCLUDED.param_value,
                     updated_by  = EXCLUDED.updated_by,
                     updated_at  = NOW()
       RETURNING *`,
      [cnVal, machine_type_name.trim(), param_key.trim(), param_value ?? null, req.user?.empno || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sds/v2/admin/parameters/bulk — upsert multiple parameters at once
 * Body: { cn, machine_type_name, params: [{ param_key, param_value }, ...] }
 */
router.put('/parameters/bulk', isAdmin, flushSds, async (req, res) => {
  const { cn, machine_type_name, params } = req.body;
  if (!machine_type_name?.trim()) return res.status(400).json({ error: 'machine_type_name is required' });
  if (!Array.isArray(params) || !params.length) return res.status(400).json({ error: 'params array is required' });

  const cnVal = cn && cn !== 'null' ? cn.trim() : null;
  const updatedBy = req.user?.empno || null;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const saved = [];
    for (const { param_key, param_value } of params) {
      if (!param_key?.trim()) continue;
      const r = await client.query(
        `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key)
         DO UPDATE SET param_value = EXCLUDED.param_value,
                       updated_by  = EXCLUDED.updated_by,
                       updated_at  = NOW()
         RETURNING id, param_key, param_value`,
        [cnVal, machine_type_name.trim(), param_key.trim(), param_value ?? null, updatedBy]
      );
      saved.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.json({ saved, count: saved.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/** DELETE /api/sds/v2/admin/parameters/:id */
router.delete('/parameters/:id', isAdmin, flushSds, async (req, res) => {
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_PARAMETER} WHERE id=$1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Parameter not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Machine Tool Config (sds_machine_tool) ────────────────────────────────────

/**
 * GET /api/sds/v2/admin/machine-tools/combos
 * Distinct (machine_type, process_code) pairs with row count.
 */
router.get('/machine-tools/combos', async (req, res) => {
  const { machine_type } = req.query;
  try {
    let sql = `SELECT machine_type, process_code, COUNT(*)::int AS tool_count
               FROM ${TABLES.SDS_V2_MACHINE_TOOL}`;
    const params = [];
    if (machine_type?.trim()) {
      params.push(machine_type.trim());
      sql += ` WHERE machine_type = $1`;
    }
    sql += ` GROUP BY machine_type, process_code ORDER BY machine_type, process_code`;
    const result = await engPool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/admin/machine-tools?machine_type=&process_code=
 * Rows for a specific (machine_type, process_code) combo, ordered by tool_number.
 */
router.get('/machine-tools', async (req, res) => {
  const { machine_type, process_code } = req.query;
  try {
    let sql = `SELECT id, machine_type, process_code, tool_number, tool_drawing_no
               FROM ${TABLES.SDS_V2_MACHINE_TOOL}`;
    const params = [];
    const where = [];
    if (machine_type?.trim()) { params.push(machine_type.trim()); where.push(`machine_type = $${params.length}`); }
    if (process_code?.trim()) { params.push(String(process_code).trim()); where.push(`process_code = $${params.length}`); }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY machine_type, process_code, LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`;
    const result = await engPool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sds/v2/admin/machine-tools/bulk
 * Replaces all rows for a (machine_type, process_code) combo.
 * Body: { machine_type, process_code, rows: [{ tool_number, tool_drawing_no }] }
 * Rows with empty tool_drawing_no are skipped (treated as clearing the slot).
 */
router.put('/machine-tools/bulk', isAdmin, flushSds, async (req, res) => {
  const { machine_type, process_code, rows } = req.body;
  if (!machine_type?.trim() || !process_code?.trim()) {
    return res.status(400).json({ error: 'machine_type and process_code are required' });
  }
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM ${TABLES.SDS_V2_MACHINE_TOOL} WHERE machine_type = $1 AND process_code = $2`,
      [machine_type.trim(), String(process_code).trim()]
    );
    const saved = [];
    for (const { tool_number, tool_drawing_no } of rows) {
      if (!tool_number?.trim() || !tool_drawing_no?.trim()) continue;
      const r = await client.query(
        `INSERT INTO ${TABLES.SDS_V2_MACHINE_TOOL} (machine_type, process_code, tool_number, tool_drawing_no)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [machine_type.trim(), String(process_code).trim(), tool_number.trim(), tool_drawing_no.trim()]
      );
      saved.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.json({ saved, count: saved.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/sds/v2/admin/machine-tools/combo?machine_type=&process_code=
 * Delete all rows for a specific (machine_type, process_code) combo.
 */
router.delete('/machine-tools/combo', isAdmin, flushSds, async (req, res) => {
  const { machine_type, process_code } = req.query;
  if (!machine_type?.trim() || !process_code?.trim()) {
    return res.status(400).json({ error: 'machine_type and process_code are required' });
  }
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_V2_MACHINE_TOOL}
       WHERE machine_type = $1 AND process_code = $2 RETURNING id`,
      [machine_type.trim(), String(process_code).trim()]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Machine Code Mapping (sds_machine_code) ──────────────────────────────────

/** GET /api/sds/v2/admin/machine-codes */
router.get('/machine-codes', async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT id, machine_code, machine_name, machine_type_code, remark, updated_at
       FROM ${TABLES.SDS_MACHINE_CODE} ORDER BY machine_code`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sds/v2/admin/machine-codes */
router.post('/machine-codes', isAdmin, async (req, res) => {
  const { machine_code, machine_name, machine_type_code, remark } = req.body;
  if (!machine_code?.trim()) return res.status(400).json({ error: 'machine_code is required' });
  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.SDS_MACHINE_CODE} (machine_code, machine_name, machine_type_code, remark)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [machine_code.trim().toUpperCase(), machine_name?.trim() || null, machine_type_code?.trim() || null, remark?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'machine_code already exists' });
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/machine-codes/:id */
router.put('/machine-codes/:id', isAdmin, async (req, res) => {
  const { machine_code, machine_name, machine_type_code, remark } = req.body;
  try {
    const result = await engPool.query(
      `UPDATE ${TABLES.SDS_MACHINE_CODE}
       SET machine_code=$1, machine_name=$2, machine_type_code=$3, remark=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [machine_code?.trim().toUpperCase(), machine_name?.trim() || null, machine_type_code?.trim() || null, remark?.trim() || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'machine_code already exists' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sds/v2/admin/machine-codes/:id */
router.delete('/machine-codes/:id', isAdmin, async (req, res) => {
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.SDS_MACHINE_CODE} WHERE id=$1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CN Production History ─────────────────────────────────────────────────────

function normalizeToPcCn(raw) {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  const variants = new Set();
  // Already 6-digit numeric
  if (/^\d{6}(-C)?$/.test(s)) {
    const base = s.replace(/-C$/, '');
    variants.add(base);
    variants.add(base + '-C');
    return [...variants];
  }
  // Cxx-xxxxx format (with optional -C suffix)
  const m = s.match(/^[A-Z](\d{2})-0*(\d+)(-C)?$/);
  if (m) {
    const itemRaw = m[2].replace(/^0+/, '') || '0';
    const item4 = itemRaw.padStart(4, '0').slice(-4);
    const base = m[1] + item4;
    variants.add(base);
    variants.add(base + '-C');
  }
  // Fallback: include raw
  if (!variants.size) variants.add(s);
  return [...variants];
}

/** GET /api/sds/v2/admin/production-summary
 *  Returns aggregated production counts for ALL CNs, grouped by (machine, process, part_type).
 *  part_type is derived from control_no prefix:
 *    3x = ball, 2x = race, 1x|5x = body, 6x = sleeve, 4x = spherical
 */
router.get('/production-summary', async (req, res) => {
  const PART_TYPE_CASE = `CASE
    WHEN control_no::text ~ '^3' THEN 'ball'
    WHEN control_no::text ~ '^2' THEN 'race'
    WHEN control_no::text ~ '^[15]' THEN 'body'
    WHEN control_no::text ~ '^6' THEN 'sleeve'
    WHEN control_no::text ~ '^4' THEN 'spherical'
    WHEN control_no::text ~ '^9' THEN 'mecha'
    ELSE 'other'
  END`;
  try {
    const [prodResult, resolver] = await Promise.all([
      maqPool.query(
        `SELECT machine, wc, process, proc_name,
                ${PART_TYPE_CASE} AS part_type,
                COUNT(*)::int AS production_count,
                COUNT(DISTINCT control_no)::int AS cn_count,
                MAX(comp_date) AS last_date
         FROM ${TABLES.LPB_PC_PRODUCTION}
         GROUP BY machine, wc, process, proc_name, part_type
         ORDER BY machine, wc, process`
      ),
      buildMachineResolver(),
    ]);

    const rows = prodResult.rows.map(r => {
      return {
        machine_name: resolver.nameOf(r.machine),
        machine_type_code: resolver.typeCodeOf(r.machine),
        wc: r.wc || null,
        process: r.process,
        proc_name: r.proc_name,
        part_type: r.part_type,
        production_count: r.production_count,
        cn_count: r.cn_count,
        last_date: r.last_date,
      };
    }).sort((a, b) =>
      (a.machine_name || '').localeCompare(b.machine_name || '') || (a.wc || '').localeCompare(b.wc || '') || (a.process || '').localeCompare(b.process || '')
    );

    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/admin/cn-history?cn= */
router.get('/cn-history', async (req, res) => {
  const { cn } = req.query;
  if (!cn?.trim()) return res.status(400).json({ error: 'cn is required' });
  const variants = normalizeToPcCn(cn);
  try {
    const [prodResult, resolver] = await Promise.all([
      maqPool.query(
        `SELECT machine, process, proc_name,
                COUNT(*)::int AS production_count,
                MAX(comp_date) AS last_date
         FROM ${TABLES.LPB_PC_PRODUCTION}
         WHERE control_no = ANY($1)
         GROUP BY machine, process, proc_name
         ORDER BY process, machine`,
        [variants]
      ),
      buildMachineResolver(),
    ]);

    // Aggregate by (machine_name, machine_type_code, process, proc_name)
    const agg = {};
    for (const r of prodResult.rows) {
      const name = resolver.nameOf(r.machine);
      const typeCode = resolver.typeCodeOf(r.machine);
      const key = `${name}||${typeCode}||${r.process}`;
      if (!agg[key]) {
        agg[key] = { machine_name: name, machine_type_code: typeCode, process: r.process, proc_name: r.proc_name, production_count: 0, last_date: null };
      }
      agg[key].production_count += r.production_count;
      if (!agg[key].last_date || r.last_date > agg[key].last_date) agg[key].last_date = r.last_date;
    }
    const rows = Object.values(agg).sort((a, b) =>
      (a.machine_name || '').localeCompare(b.machine_name || '') || (a.process || '').localeCompare(b.process || '')
    );
    res.json({ rows, searched_variants: variants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Audit Config ─────────────────────────────────────────────────────────────

const DEFAULT_AUDIT_PROCESS_CODES = ['1011','1012','1021','1022','1041','1042','1061','1062','1101','1102','1181','1182','1241'];
// Mecha = C95 (Mechanical Parts) + C99 (Others) — the two C9x classes that have
// real grinding production (process 1101/1102 on SGM machines, verified 2026-06-09).
// Other C9x are excluded by design: C90 forging blank, C91 ball retainer (NO
// production at all), C96 tooling/fixtures, C97 fastener blank, C98 others — none
// have ground production. Broaden via the audit config UI if needed. The frontend
// Mecha card (prefix 'C9') picks up both C95 and C99 rows.
// A4% = Spherical (A41–A49) — added 2026-06-13 when spherical entered the SDS
// coverage scope (OD GRIND 1011 on OC machines); frontend Spherical card = prefix 'A4'.
// NOTE: the DB row sds_audit_config.sub_class_patterns OVERRIDES this list — when
// adding a class here, UPDATE the DB row too or the change is invisible.
const DEFAULT_AUDIT_SUB_CLASSES   = ['C1%','C2%','C3%','C5%','C6%','C95%','C99%','A4%'];

async function ensureAuditConfigTable() {
  await engPool.query(`
    CREATE TABLE IF NOT EXISTS sds_audit_config (
      key         TEXT PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getAuditConfig() {
  await ensureAuditConfigTable();
  const res = await engPool.query(`SELECT key, value FROM sds_audit_config`);
  const cfg = { process_codes: DEFAULT_AUDIT_PROCESS_CODES, sub_class_patterns: DEFAULT_AUDIT_SUB_CLASSES };
  for (const row of res.rows) cfg[row.key] = row.value;
  return cfg;
}

/** GET /api/sds/v2/admin/audit/process-master
 *  Returns all process codes from rodpc master table for dropdown options.
 */
router.get('/audit/process-master', isAdmin, async (req, res) => {
  try {
    const result = await rodpcPool.query(
      `SELECT process_code, process_eng FROM rodpc.kzwmaq_eng_process
       WHERE process_code IS NOT NULL AND process_code <> ''
       ORDER BY process_code`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Audit Process Master]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/admin/audit/config */
router.get('/audit/config', isAdmin, async (req, res) => {
  try {
    const cfg = await getAuditConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    console.error('[Audit Config GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/audit/config */
router.put('/audit/config', isAdmin, async (req, res) => {
  try {
    const { process_codes, sub_class_patterns } = req.body;
    await ensureAuditConfigTable();
    if (Array.isArray(process_codes)) {
      const codes = [...new Set(process_codes.map(c => String(c).trim()).filter(Boolean))];
      await engPool.query(
        `INSERT INTO sds_audit_config (key, value, updated_at) VALUES ('process_codes', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(codes)]
      );
    }
    if (Array.isArray(sub_class_patterns)) {
      const patterns = [...new Set(sub_class_patterns.map(p => String(p).trim()).filter(Boolean))];
      await engPool.query(
        `INSERT INTO sds_audit_config (key, value, updated_at) VALUES ('sub_class_patterns', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(patterns)]
      );
    }
    const cfg = await getAuditConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    console.error('[Audit Config PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Visible Machines Config ───────────────────────────────────────────────────

/** GET /api/sds/v2/admin/visible-machines — load saved machine visibility list.
 *  Public read (display config only, like /machine-types) so the SDS PDF picker — used by
 *  non-admin operators — can keep grouped machines split/combined consistently with admin.
 *  The PUT below stays isAdmin. */
router.get('/visible-machines', async (req, res) => {
  try {
    await ensureAuditConfigTable();
    const r = await engPool.query(`SELECT value FROM sds_audit_config WHERE key='visible_machines'`);
    res.json({ visible_machines: r.rows[0]?.value ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/visible-machines — save machine visibility list to DB
 *  Body: { visible_machines: string[] } or { visible_machines: null } to show all
 */
router.put('/visible-machines', isAdmin, async (req, res) => {
  try {
    const { visible_machines } = req.body;
    await ensureAuditConfigTable();
    if (visible_machines === null || visible_machines === undefined) {
      await engPool.query(`DELETE FROM sds_audit_config WHERE key='visible_machines'`);
    } else {
      const names = [...new Set(visible_machines.map(n => String(n).trim()).filter(Boolean))];
      await engPool.query(
        `INSERT INTO sds_audit_config (key, value, updated_at) VALUES ('visible_machines', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(names)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Audit: Data Integrity ────────────────────────────────────────────────────

/** GET /api/sds/v2/admin/audit/data-integrity */
router.get('/audit/data-integrity', isAdmin, async (req, res) => {
  try {
    const cfg = await getAuditConfig();
    const targetProcessCodes  = cfg.process_codes;
    const subClassPatterns     = cfg.sub_class_patterns;

    if (!subClassPatterns.length) {
      return res.json({ itemCounts: [], totals: { raceTotal: 0, ballTotal: 0, grandTotal: 0 }, noProcessPlan: [], missingTooling: [], config: cfg });
    }

    // Build safe WHERE fragments — values come from DB only, validated as text patterns
    const buildWhere = (alias) => subClassPatterns
      .map((_, idx) => `${alias ? alias + '.' : ''}sub_class LIKE $${idx + 1}`).join(' OR ');
    const subClassWhere    = `(${buildWhere('i')})`;   // for queries with alias i
    const subClassWhereRaw = `(${buildWhere('')})`;    // for simple single-table queries

    // 1. Count Enabled Items by sub_class — COUNT(DISTINCT control_no) so the
    //    figure is genuinely "unique CNs" (one part counted once) rather than rows.
    const countsResult = await maqPool.query(
      `SELECT sub_class, COUNT(DISTINCT control_no) AS count FROM lpb.eng_item WHERE ${subClassWhereRaw} AND condition = 'Enable' GROUP BY sub_class ORDER BY sub_class`,
      subClassPatterns
    );

    const itemCounts = countsResult.rows.map(r => ({ sub_class: r.sub_class, count: parseInt(r.count) }));
    const raceTotal = itemCounts.filter(r => r.sub_class.startsWith('C2')).reduce((sum, r) => sum + r.count, 0);
    const ballTotal = itemCounts.filter(r => r.sub_class.startsWith('C3')).reduce((sum, r) => sum + r.count, 0);
    const grandTotal = itemCounts.reduce((sum, r) => sum + r.count, 0);

    // 2. Critical: No Process Plan
    const noProcessPlanResult = await maqPool.query(
      `SELECT i.control_no, i.sub_class
       FROM lpb.eng_item i
       WHERE ${subClassWhere} AND i.condition = 'Enable'
         AND NOT EXISTS (SELECT 1 FROM lpb.eng_process_info pi WHERE pi.process_plan_no = i.control_no)
       ORDER BY i.control_no`,
      subClassPatterns
    );

    // 3. Warning: Missing Tooling in configured Process Codes
    let missingRows = [];
    if (targetProcessCodes.length > 0) {
      const pcOffset = subClassPatterns.length + 1;
      const missingToolingResult = await maqPool.query(
        `SELECT i.control_no, i.sub_class, pi.process_code, pi.wc
         FROM lpb.eng_item i
         JOIN lpb.eng_process_info pi ON pi.process_plan_no = i.control_no
         LEFT JOIN lpb.eng_r_pi_tool rpt ON (rpt.process_plan_no = pi.process_plan_no AND rpt.process_code = pi.process_code)
         WHERE ${subClassWhere} AND i.condition = 'Enable'
           AND pi.process_code = ANY($${pcOffset})
           AND rpt.tool_dwg_no IS NULL
         ORDER BY i.control_no, pi.seq_no`,
        [...subClassPatterns, targetProcessCodes]
      );
      missingRows = missingToolingResult.rows;
    }

    // Enrich with Machine Model
    const allCns = [...new Set([...noProcessPlanResult.rows.map(r => r.control_no), ...missingRows.map(r => r.control_no)])];
    let modelMap = {}, mtcMap = {};
    if (allCns.length > 0) {
      const prodRes = await rodpcPool.query(
        `SELECT control_no, model FROM rodpc.kzwmaq_eng_production WHERE control_no = ANY($1)`,
        [allCns]
      );
      modelMap = prodRes.rows.reduce((acc, row) => { acc[row.control_no] = row.model; return acc; }, {});
      const models = [...new Set(prodRes.rows.map(r => r.model))];
      if (models.length > 0) {
        const mtcRes = await engPool.query(
          `SELECT machine_type_name, machine_type_code FROM sds_machine_type_code WHERE machine_type_name = ANY($1)`,
          [models]
        );
        mtcMap = mtcRes.rows.reduce((acc, row) => { acc[row.machine_type_name] = row.machine_type_code; return acc; }, {});
      }
    }

    const enrich = (row) => ({
      ...row,
      machine_name: modelMap[row.control_no] || null,
      machine_type_code: mtcMap[modelMap[row.control_no]] || null,
    });

    res.json({
      itemCounts,
      totals: { raceTotal, ballTotal, grandTotal },
      noProcessPlan: noProcessPlanResult.rows.map(enrich),
      missingTooling: missingRows.map(enrich),
      config: cfg,
    });
  } catch (err) {
    console.error('[Audit API Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/admin/audit/machine-identity
 * Cross-checks the machine identity chain (machine_code → name → type_code → type_name)
 * against the single sources of truth: rodpc.m_machine (name) + sds_machine_type_code
 * (type_code). Surfaces drift so SDS + Tooling Select stay aligned. Read-only.
 */
router.get('/audit/machine-identity', isAdmin, async (req, res) => {
  // Grinding WCs that require an SDS setup sheet (exclude 05 turning, 32 surface grind).
  const SCOPE_WC = ['09', '29', '30', '37'];
  try {
    const [rodpcRes, sdsRes, dictRes, prodRes] = await Promise.all([
      rodpcPool.query(`SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine`).catch(() => ({ rows: [] })),
      engPool.query(`SELECT machine_code, machine_name, machine_type_code FROM ${TABLES.SDS_MACHINE_CODE}`),
      engPool.query(`SELECT machine_type_name, machine_type_code, is_active FROM ${TABLES.SDS_MACHINE_TYPE_CODE}`),
      maqPool.query(
        `SELECT DISTINCT machine, wc FROM ${TABLES.LPB_PC_PRODUCTION}
         WHERE machine IS NOT NULL AND machine <> '' AND wc = ANY($1) AND comp_date >= '2023-01-01'`,
        [SCOPE_WC]
      ).catch(() => ({ rows: [] })),
    ]);

    const rodpcCodes = new Set(rodpcRes.rows.map(r => r.machine_code));
    const baseName = new Map();
    for (const r of rodpcRes.rows) if (r.m_model) baseName.set(r.machine_code, r.m_model);

    // dict: name → active codes; code → name (active rows)
    const activeCodesByName = new Map();
    const nameByCode = new Map();
    for (const r of dictRes.rows) {
      const code = String(r.machine_type_code);
      nameByCode.set(code, r.machine_type_name);
      if (r.is_active && r.machine_type_name) {
        if (!activeCodesByName.has(r.machine_type_name)) activeCodesByName.set(r.machine_type_name, []);
        activeCodesByName.get(r.machine_type_name).push(code);
      }
    }
    const codeByName = (name) => {
      const codes = activeCodesByName.get(name);
      return codes && codes.length ? codes.slice().sort()[0] : null;
    };

    const overrideName = new Map(), overrideType = new Map();
    for (const r of sdsRes.rows) {
      if (r.machine_name) overrideName.set(r.machine_code, r.machine_name);
      if (r.machine_type_code) overrideType.set(r.machine_code, r.machine_type_code);
    }
    const nameOf = (code) => overrideName.get(code) || baseName.get(code) || code;

    // CHECK 1 — bridge code not in rodpc master (cannot be sourced)
    const bridgeNotInRodpc = sdsRes.rows
      .filter(r => !rodpcCodes.has(r.machine_code))
      .map(r => ({ machine_code: r.machine_code, machine_name: r.machine_name }));

    // CHECK 2 — override type_code that doesn't resolve in the dictionary
    const typeCodeUnresolved = sdsRes.rows
      .filter(r => r.machine_type_code && !nameByCode.has(String(r.machine_type_code)))
      .map(r => ({ machine_code: r.machine_code, machine_type_code: r.machine_type_code }));

    // CHECK 3 — dictionary names with >1 active code (name→code non-deterministic)
    const dictDuplicateActiveNames = [...activeCodesByName.entries()]
      .filter(([name, codes]) => codes.length > 1 && name !== 'no data')
      .map(([name, codes]) => ({ machine_type_name: name, active_codes: codes.sort() }));

    // CHECK 4 — in-scope production machines whose resolved name has no type_code
    //           (needs a dictionary entry or an override) — actionable SDS gaps
    const productionUnresolved = [];
    const seen = new Set();
    for (const r of prodRes.rows) {
      if (seen.has(r.machine)) continue;
      seen.add(r.machine);
      const resolvedName = nameOf(r.machine);
      const typeCode = overrideType.has(r.machine) ? overrideType.get(r.machine) : codeByName(resolvedName);
      if (!typeCode) {
        productionUnresolved.push({ machine_code: r.machine, wc: r.wc, resolved_name: resolvedName });
      }
    }
    productionUnresolved.sort((a, b) => a.machine_code.localeCompare(b.machine_code));

    const checks = { bridgeNotInRodpc, typeCodeUnresolved, dictDuplicateActiveNames, productionUnresolved };
    const issueCount = Object.values(checks).reduce((n, arr) => n + arr.length, 0);

    res.json({
      ok: issueCount === 0,
      summary: {
        bridgeRows: sdsRes.rows.length,
        rodpcMachines: rodpcCodes.size,
        dictActiveTypes: activeCodesByName.size,
        scopeWc: SCOPE_WC,
        issueCount,
        counts: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.length])),
      },
      checks,
    });
  } catch (err) {
    console.error('[Audit machine-identity]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Template CSS Config ───────────────────────────────────────────────────────

const DEFAULT_CSS_CONFIG = {
  'font-size-base':       '5.3pt',
  'font-size-title':      '7pt',
  'font-size-section':    '9pt',
  'font-size-badge':      '4.5pt',
  'height-row-normal':    '3.65mm',
  'height-row-sep':       '0.84mm',
  'height-row-img':       '21.9mm',
  'width-params-panel':   '26.13%',
  'width-tooling-panel':  '54.60%',
  'width-grinding-panel': '19.27%',
  'color-border-outer':   '#000000',
  'color-border-inner':   '#aaaaaa',
  'color-badge-bg':       '#1a3a8c',
  'color-value-red':      '#cc0000',
  'color-header-bg':      '#e0e0e0',
  'color-sep-bg':         '#f0f0f0',
};

async function ensureTemplateCssTable() {
  await engPool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLES.SDS_TEMPLATE_CSS_CONFIG} (
      id          SERIAL PRIMARY KEY,
      config_key  TEXT NOT NULL UNIQUE,
      config_value TEXT NOT NULL,
      description TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/** GET /api/sds/v2/admin/template-config
 *  Returns all CSS config rows merged with defaults, plus machine-type list.
 */
router.get('/template-config', isAdmin, async (req, res) => {
  try {
    await ensureTemplateCssTable();
    const r = await engPool.query(
      `SELECT config_key, config_value, description, updated_at FROM ${TABLES.SDS_TEMPLATE_CSS_CONFIG} ORDER BY config_key`
    );
    const stored = Object.fromEntries(r.rows.map(row => [row.config_key, row]));
    const configs = Object.entries(DEFAULT_CSS_CONFIG).map(([key, defaultVal]) => ({
      config_key:   key,
      config_value: stored[key]?.config_value ?? defaultVal,
      default_value: defaultVal,
      description:  stored[key]?.description ?? null,
      updated_at:   stored[key]?.updated_at ?? null,
      is_modified:  !!stored[key] && stored[key].config_value !== defaultVal,
    }));
    res.json({ configs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/template-config
 *  Body: { configs: [{ config_key, config_value }] }
 *  Upserts rows; flushes SDS cache AND headless CSS cache so PDFs pick up changes immediately.
 */
router.put('/template-config', isAdmin, flushSds, async (req, res) => {
  const { configs } = req.body;
  if (!Array.isArray(configs) || !configs.length) {
    return res.status(400).json({ error: 'configs array required' });
  }
  try {
    await ensureTemplateCssTable();
    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      for (const { config_key, config_value } of configs) {
        if (!config_key || config_value === undefined) continue;
        // Reset to default: delete the override row
        if (config_value === null) {
          await client.query(
            `DELETE FROM ${TABLES.SDS_TEMPLATE_CSS_CONFIG} WHERE config_key = $1`, [config_key]
          );
        } else {
          await client.query(
            `INSERT INTO ${TABLES.SDS_TEMPLATE_CSS_CONFIG} (config_key, config_value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
            [config_key, String(config_value).trim()]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    // Flush the headless controller's CSS cache so the next PDF uses new values
    if (typeof headlessController.flushCssCache === 'function') headlessController.flushCssCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/admin/template-config/common-params
 *  Returns sds_parameter rows where cn IS NULL (machine-level config), optionally
 *  filtered by machine_type_name. Also returns sds_excel_mapping rows.
 */
router.get('/template-config/common-params', isAdmin, async (req, res) => {
  const { machine_type_name } = req.query;
  try {
    const paramQ = machine_type_name
      ? await engPool.query(
          `SELECT machine_type_name, param_key, param_value FROM ${TABLES.SDS_PARAMETER}
           WHERE cn IS NULL AND machine_type_name = $1 ORDER BY param_key`,
          [machine_type_name]
        )
      : await engPool.query(
          `SELECT machine_type_name, param_key, param_value FROM ${TABLES.SDS_PARAMETER}
           WHERE cn IS NULL ORDER BY machine_type_name, param_key`
        );

    const mappingQ = machine_type_name
      ? await engPool.query(
          `SELECT id, cell_address, param_key, machine_type_name FROM ${TABLES.SDS_EXCEL_MAPPING}
           WHERE machine_type_name = $1 OR machine_type_name IS NULL ORDER BY cell_address`,
          [machine_type_name]
        )
      : await engPool.query(
          `SELECT id, cell_address, param_key, machine_type_name FROM ${TABLES.SDS_EXCEL_MAPPING}
           ORDER BY machine_type_name NULLS FIRST, cell_address`
        );

    // Split params into regular (row_*) and GW (gw_row_*)
    const params    = paramQ.rows.filter(r => !r.param_key.startsWith('gw_'));
    const gwParams  = paramQ.rows.filter(r => r.param_key.startsWith('gw_'));

    res.json({
      params,
      gw_params: gwParams,
      mappings:  mappingQ.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/admin/template-grid
 *  Returns the Excel-like blank-template grid layout (cells, borders, fills)
 *  stored as a single JSON blob under config_key 'grid-layout'. null if never saved.
 */
router.get('/template-grid', isAdmin, async (req, res) => {
  try {
    await ensureTemplateCssTable();
    const r = await engPool.query(
      `SELECT config_value, updated_at FROM ${TABLES.SDS_TEMPLATE_CSS_CONFIG}
       WHERE config_key = 'grid-layout' LIMIT 1`
    );
    let grid = null;
    if (r.rows[0]?.config_value) {
      try { grid = JSON.parse(r.rows[0].config_value); } catch (_) { grid = null; }
    }
    res.json({ grid, updated_at: r.rows[0]?.updated_at ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/admin/template-grid/from-xlsx
 *  Parses sds_template.xlsx into the editor grid model (A1:AV56) so the editor
 *  exactly mirrors the real Excel template — column widths, row heights, borders,
 *  fills (and merge ranges). Used by the "Import xlsx" action / first-load default.
 */
router.get('/template-grid/from-xlsx', isAdmin, async (req, res) => {
  try {
    const grid = await parseSdsXlsxGrid();
    res.json({ grid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/template-grid
 *  Body: { grid: { rows, cols, borders, fills, ... } }
 *  Upserts the grid layout JSON. Stored in sds_template_css_config.
 */
router.put('/template-grid', isAdmin, async (req, res) => {
  const { grid } = req.body;
  if (!grid || typeof grid !== 'object' || Array.isArray(grid)) {
    return res.status(400).json({ error: 'grid object required' });
  }
  try {
    await ensureTemplateCssTable();
    const json = JSON.stringify(grid);
    await engPool.query(
      `INSERT INTO ${TABLES.SDS_TEMPLATE_CSS_CONFIG} (config_key, config_value, description, updated_at)
       VALUES ('grid-layout', $1, 'Excel-like blank template grid (borders/fills)', NOW())
       ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
      [json]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
