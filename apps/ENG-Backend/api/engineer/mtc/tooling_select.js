'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('./fixtureLogic');
const { engPool } = require('../../../instance/eng_db');

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

// ── Cache: tableExists + validColumns (cleared on create-table) ────────────
const _tableCache = new Map();   // tableName → true
const _colCache   = new Map();   // tableName → Set<string>

async function tableExists(tableName) {
  if (!/^tooling_[a-z0-9_]+$/.test(tableName)) return false;
  if (_tableCache.has(tableName)) return _tableCache.get(tableName);
  const r = await engPool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  const exists = r.rows.length > 0;
  _tableCache.set(tableName, exists);
  return exists;
}

// ── ดึง valid columns สำหรับตาราง เพื่อป้องกัน SQL injection ผ่าน field names
async function getValidColumns(tableName) {
  if (_colCache.has(tableName)) return _colCache.get(tableName);
  const r = await engPool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  const cols = new Set(r.rows.map(row => row.column_name));
  _colCache.set(tableName, cols);
  return cols;
}

// POST /api/tooling-select/search
router.post('/search', async (req, res) => {
  try {
    const { cnNumber } = req.body;
    if (!cnNumber || !String(cnNumber).trim())
      return res.status(400).json({ success: false, error: 'cnNumber is required' });
    const result = await findFixtures(cnNumber);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    console.error('Tooling search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DYNAMIC RULES ──────────────────────────────────────────────────────────

router.get('/rules', async (req, res) => {
  try {
    const r = await engPool.query(
      'SELECT * FROM mtc_selection_rules WHERE is_active=true ORDER BY machine_name, tool_category'
    );
    res.json({ success: true, rules: r.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/rules', async (req, res) => {
  const { machine_name, tool_category, rule_name, source_field, operator,
          offset_value, target_tool_table, target_tool_field,
          tolerance_plus, tolerance_minus } = req.body;
  try {
    const r = await engPool.query(
      `INSERT INTO mtc_selection_rules
       (machine_name,tool_category,rule_name,source_field,operator,offset_value,
        target_tool_table,target_tool_field,tolerance_plus,tolerance_minus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [machine_name, tool_category, rule_name, source_field, operator,
       offset_value, target_tool_table, target_tool_field, tolerance_plus, tolerance_minus]
    );
    res.json({ success: true, rule: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/rules/:id', async (req, res) => {
  try {
    await engPool.query('UPDATE mtc_selection_rules SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/init-db', async (req, res) => {
  res.json({ success: true, message: 'init-db not implemented' });
});

// ── TABLES LIST ────────────────────────────────────────────────────────────

// GET /api/tooling-select/tables
router.get('/tables', async (req, res) => {
  try {
    const r = await engPool.query(`
      SELECT t.table_name,
        array_agg(c.column_name::TEXT ORDER BY c.ordinal_position)
          FILTER (WHERE c.column_name NOT IN ('id','tooling_name','tooling_no','machine','created_at','updated_at')) AS data_cols
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_name = t.table_name AND c.table_schema = 'public'
      WHERE t.table_schema = 'public'
        AND t.table_name LIKE 'tooling_%'
        AND t.table_name != 'ti_list'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `);
    res.json({ success: true, tables: r.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/tooling-select/tooling-names/:tableName
router.get('/tooling-names/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid table' });
  try {
    const r = await engPool.query(
      `SELECT DISTINCT tooling_name FROM ${tableName}
       WHERE tooling_name IS NOT NULL ORDER BY tooling_name`
    );
    res.json({ success: true, names: r.rows.map(row => row.tooling_name) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── CREATE TABLE ───────────────────────────────────────────────────────────

// POST /api/tooling-select/create-table
router.post('/create-table', async (req, res) => {
  const { machineName, dimCount } = req.body;
  if (!machineName)
    return res.status(400).json({ success: false, error: 'machineName required' });

  const tableName = 'tooling_' +
    machineName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  if (!/^tooling_[a-z0-9_]+$/.test(tableName))
    return res.status(400).json({ success: false, error: 'Invalid machine name' });

  if (await tableExists(tableName))
    return res.status(400).json({ success: false, error: `Table ${tableName} already exists` });

  const count = Math.min(Math.max(parseInt(dimCount) || 6, 1), 26);
  const dimCols = Array.from({ length: count }, (_, i) => `dim_${ALPHA[i]} NUMERIC`).join(', ');

  try {
    await engPool.query(`
      CREATE TABLE ${tableName} (
        id SERIAL PRIMARY KEY,
        tooling_name TEXT,
        tooling_no   TEXT,
        ${dimCols},
        machine TEXT
      )
    `);
    _tableCache.set(tableName, true);
    _colCache.delete(tableName);
    res.json({
      success: true,
      tableName,
      dimCount: count,
      lastDim: `dim_${ALPHA[count - 1]}`
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── INVENTORY CRUD ─────────────────────────────────────────────────────────

// GET /api/tooling-select/inventory/:tableName
router.get('/inventory/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid table' });
  try {
    const r = await engPool.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
    res.json({ success: true, data: r.rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/tooling-select/inventory/:tableName  (insert)
router.post('/inventory/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid table' });

  const data = req.body;
  try {
    const validCols = await getValidColumns(tableName);
    const fields = Object.keys(data).filter(
      f => f !== 'id' && f !== 'created_at' && f !== 'updated_at'
         && data[f] !== null && data[f] !== ''
         && validCols.has(f)
    );
    if (fields.length === 0)
      return res.status(400).json({ success: false, error: 'No valid data provided' });

    const cols = fields.join(', ');
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const r = await engPool.query(
      `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`,
      fields.map(f => data[f])
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// PUT /api/tooling-select/inventory/:tableName/:id  (update)
router.put('/inventory/:tableName/:id', async (req, res) => {
  const { tableName, id } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid table' });

  const data = req.body;
  try {
    const validCols = await getValidColumns(tableName);
    const fields = Object.keys(data).filter(
      f => f !== 'id' && f !== 'created_at' && f !== 'updated_at' && validCols.has(f)
    );
    if (fields.length === 0)
      return res.status(400).json({ success: false, error: 'No valid fields to update' });

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = [...fields.map(f => data[f]), id];

    const r = await engPool.query(
      `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// DELETE /api/tooling-select/inventory/:tableName/:id
router.delete('/inventory/:tableName/:id', async (req, res) => {
  const { tableName, id } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid table' });
  try {
    const r = await engPool.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
      [id]
    );
    if (r.rowCount === 0)
      return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, deletedId: r.rows[0].id });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;

