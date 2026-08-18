'use strict';

/**
 * CRUD for `tooling_partno_map` — the lookup that pins tooling no dimensional formula can
 * select. The SDS PDF (sdsV2HeadlessController.buildValueMap) reads this fresh on every
 * render, so admin edits take effect immediately — no cache flush.
 *
 * TWO KEYS, one of which is required:
 *   parts_no — a fixture chosen by workpiece part number (品番): ROTARY DRESSER 4800-42
 *              on KS-400B5/B6, the KS-H70 grindstone set.
 *   cn       — a fixture chosen per CONTROL NUMBER: FTL-10(I) PUSHER OP1, whose selection
 *              exists only as the shop's per-part record (seeded from lpb.eng_r_pi_tool by
 *              db_migrations/20260817_pusher_op1_cn_map.js).
 *
 * A cn-keyed row leaves parts_no NULL and vice versa — never both, never neither. NULL is
 * required rather than a placeholder: the table's UNIQUE covers parts_no, and many C/Ns
 * share one drawing, so a constant would collide. See .claude/rules/tooling-select.md.
 *
 * Routes (registered in tsv2Routes.js under /api/tooling-select):
 *   GET    /partno-map           ?machine_name=&parts_no=&cn=&tooling_name=  (filters, all optional)
 *   GET    /partno-map/meta      distinct machine_name + tooling_name (for filter dropdowns)
 *   POST   /partno-map           isAdmin
 *   PUT    /partno-map/:id        isAdmin
 *   DELETE /partno-map/:id        isAdmin
 */

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');
const { toDD } = require('../utils/rotaryDwg');

const T = TSV2_TABLES.PARTNO_MAP;

const list = async (req, res) => {
  const { machine_name, parts_no, cn, tooling_name } = req.query;
  const where = [];
  const params = [];
  if (machine_name) { params.push(machine_name); where.push(`machine_name = $${params.length}`); }
  if (tooling_name) { params.push(tooling_name); where.push(`tooling_name = $${params.length}`); }
  if (parts_no)     { params.push(`%${parts_no.trim()}%`); where.push(`parts_no ILIKE $${params.length}`); }
  if (cn)           { params.push(`%${cn.trim()}%`); where.push(`cn ILIKE $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const { rows } = await engPool.query(
      `SELECT * FROM ${T} ${clause}
        ORDER BY machine_name, tooling_name, parts_no NULLS LAST, cn, is_forbidden ASC, tool_dwg_no`,
      params
    );
    res.json({ success: true, rows });
  } catch (err) {
    console.error('partno-map list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const meta = async (_req, res) => {
  try {
    const m = await engPool.query(`SELECT DISTINCT machine_name FROM ${T} ORDER BY machine_name`);
    const t = await engPool.query(`SELECT DISTINCT tooling_name FROM ${T} ORDER BY tooling_name`);
    res.json({
      success: true,
      machines: m.rows.map(r => r.machine_name),
      toolings: t.rows.map(r => r.tooling_name),
    });
  } catch (err) {
    console.error('partno-map meta error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// Exactly one key. Both would make the row match two different parts; neither makes it
// unreachable. Returns { parts_no, cn } with the unused one NULL, or an error string.
const resolveKeys = ({ parts_no, cn }) => {
  const p = parts_no?.trim() || null;
  const c = cn?.trim() || null;
  if (p && c) return { error: 'give either parts_no or cn, not both — a row is keyed by one of them' };
  if (!p && !c) return { error: 'parts_no or cn is required' };
  return { parts_no: p, cn: c };
};

const create = async (req, res) => {
  const { machine_name, tooling_name, tool_dwg_no, is_forbidden, note, source } = req.body;
  const keys = resolveKeys(req.body);
  if (keys.error) return res.status(400).json({ success: false, error: keys.error });
  if (!machine_name?.trim() || !tool_dwg_no?.trim()) {
    return res.status(400).json({ success: false, error: 'machine_name and tool_dwg_no are required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${T} (machine_name, tooling_name, parts_no, cn, tool_dwg_no, is_forbidden, note, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [machine_name.trim(), (tooling_name || 'ROTARY DRESSER').trim(), keys.parts_no, keys.cn,
       toDD(tool_dwg_no), is_forbidden === true, note?.trim() || null, source?.trim() || 'manual']
    );
    res.json({ success: true, row: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'This machine / tooling / part no / DWG mapping already exists' });
    }
    console.error('partno-map create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { machine_name, tooling_name, tool_dwg_no, is_forbidden, note, source } = req.body;
  const keys = resolveKeys(req.body);
  if (keys.error) return res.status(400).json({ success: false, error: keys.error });
  if (!machine_name?.trim() || !tool_dwg_no?.trim()) {
    return res.status(400).json({ success: false, error: 'machine_name and tool_dwg_no are required' });
  }
  try {
    const { rows } = await engPool.query(
      `UPDATE ${T}
          SET machine_name = $1, tooling_name = $2, parts_no = $3, cn = $4, tool_dwg_no = $5,
              is_forbidden = $6, note = $7, source = $8
        WHERE id = $9 RETURNING *`,
      [machine_name.trim(), (tooling_name || 'ROTARY DRESSER').trim(), keys.parts_no, keys.cn,
       toDD(tool_dwg_no), is_forbidden === true, note?.trim() || null, source?.trim() || null, Number(id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'This machine / tooling / part no / DWG mapping already exists' });
    }
    console.error('partno-map update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await engPool.query(`DELETE FROM ${T} WHERE id = $1`, [Number(id)]);
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('partno-map delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = { list, meta, create, update, remove };
