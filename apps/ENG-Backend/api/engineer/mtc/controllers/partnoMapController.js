'use strict';

/**
 * CRUD for `tooling_partno_map` — the Part No → tool DWG lookup used for fixtures that are
 * selected by workpiece part number (品番) instead of a dimensional formula (currently the
 * ROTARY DRESSER 4800-42 on KS-400B5/B6). The SDS PDF (sdsV2HeadlessController.buildValueMap)
 * reads this fresh on every render, so admin edits take effect immediately — no cache flush.
 *
 * Routes (registered in tsv2Routes.js under /api/tooling-select):
 *   GET    /partno-map           ?machine_name=&parts_no=&tooling_name=  (filters, all optional)
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
  const { machine_name, parts_no, tooling_name } = req.query;
  const where = [];
  const params = [];
  if (machine_name) { params.push(machine_name); where.push(`machine_name = $${params.length}`); }
  if (tooling_name) { params.push(tooling_name); where.push(`tooling_name = $${params.length}`); }
  if (parts_no)     { params.push(`%${parts_no.trim()}%`); where.push(`parts_no ILIKE $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const { rows } = await engPool.query(
      `SELECT * FROM ${T} ${clause}
        ORDER BY machine_name, tooling_name, parts_no, is_forbidden ASC, tool_dwg_no`,
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

const create = async (req, res) => {
  const { machine_name, tooling_name, parts_no, tool_dwg_no, is_forbidden, note, source } = req.body;
  if (!machine_name?.trim() || !parts_no?.trim() || !tool_dwg_no?.trim()) {
    return res.status(400).json({ success: false, error: 'machine_name, parts_no and tool_dwg_no are required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${T} (machine_name, tooling_name, parts_no, tool_dwg_no, is_forbidden, note, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [machine_name.trim(), (tooling_name || 'ROTARY DRESSER').trim(), parts_no.trim(),
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
  const { machine_name, tooling_name, parts_no, tool_dwg_no, is_forbidden, note, source } = req.body;
  if (!machine_name?.trim() || !parts_no?.trim() || !tool_dwg_no?.trim()) {
    return res.status(400).json({ success: false, error: 'machine_name, parts_no and tool_dwg_no are required' });
  }
  try {
    const { rows } = await engPool.query(
      `UPDATE ${T}
          SET machine_name = $1, tooling_name = $2, parts_no = $3, tool_dwg_no = $4,
              is_forbidden = $5, note = $6, source = $7
        WHERE id = $8 RETURNING *`,
      [machine_name.trim(), (tooling_name || 'ROTARY DRESSER').trim(), parts_no.trim(),
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
