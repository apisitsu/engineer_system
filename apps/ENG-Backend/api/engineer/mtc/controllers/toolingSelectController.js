'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('../services/fixtureLogic');
const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

// ── Role Authorization Middleware ──────────────────────────────────────────
const isAdmin = (req, res, next) => {
  const dept = req.user?.department || req.user?.u_department || req.user?.userDepartment;
  const role = req.user?.role || req.user?.u_role;

  if (dept === 'AD' || role === 'AD') {
    next();
  } else {
    return res.status(403).json({ success: false, error: 'Access denied: Admin only' });
  }
};

// ── Cache & Whitelist ──────────────────────────────────────────────────────
const _tableCache = new Map();   // tableName → true
const _colCache = new Map();   // tableName → Set<string>

// Hardcoded whitelist of tables allowed to be accessed dynamically
const ALLOWED_TABLES = new Set([
  'tooling_ksb22g',
  'tooling_ksb80',
  'tooling_tsg300',
  'tooling_ks03a',
  'tooling_ks400b',
  'tooling_ks500rd',
  'tooling_ks400b5',
  'tooling_ks400b6'
]);

async function tableExists(tableName) {
  if (!/^tooling_[a-z0-9_]+$/.test(tableName)) return false;
  // If not in our hardcoded allowed list, check if it's a dynamic table we recognize
  if (!ALLOWED_TABLES.has(tableName)) {
    // Check DB to see if it exists and follows our naming convention
    if (_tableCache.has(tableName)) return _tableCache.get(tableName);
    const r = await engPool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [tableName]
    );
    const exists = r.rows.length > 0;
    _tableCache.set(tableName, exists);
    if (!exists) return false;
  }
  return true;
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
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('Tooling search error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── DYNAMIC RULES ──────────────────────────────────────────────────────────

router.get('/rules', async (req, res) => {
  try {
    const r = await engPool.query(
      `SELECT * FROM ${TABLES.MTC_SELECTION_RULES} WHERE is_active=true ORDER BY machine_name, tool_category`
    );
    res.json({ success: true, rules: r.rows });
  } catch (err) {
    console.error('Fetch rules error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/rules', isAdmin, async (req, res) => {
  const { machine_name, tool_category, rule_name, source_field, operator,
    offset_value, target_tool_table, target_tool_field,
    tolerance_plus, tolerance_minus } = req.body;
  try {
    const r = await engPool.query(
      `INSERT INTO ${TABLES.MTC_SELECTION_RULES}
       (machine_name,tool_category,rule_name,source_field,operator,offset_value,
        target_tool_table,target_tool_field,tolerance_plus,tolerance_minus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [machine_name, tool_category, rule_name, source_field, operator,
        offset_value, target_tool_table, target_tool_field, tolerance_plus, tolerance_minus]
    );
    res.json({ success: true, rule: r.rows[0] });
  } catch (err) {
    console.error('Create rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.delete('/rules/:id', isAdmin, async (req, res) => {
  try {
    await engPool.query(`UPDATE ${TABLES.MTC_SELECTION_RULES} SET is_active=false WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
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
        AND t.table_name != $1
      GROUP BY t.table_name
      ORDER BY t.table_name
    `, [TABLES.TI_LIST]);
    res.json({ success: true, tables: r.rows });
  } catch (err) {
    console.error('Fetch tables error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/tooling-select/tooling-names/:tableName
router.get('/tooling-names/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const r = await engPool.query(
      `SELECT DISTINCT tooling_name FROM ${tableName}
       WHERE tooling_name IS NOT NULL ORDER BY tooling_name`
    );
    res.json({ success: true, names: r.rows.map(row => row.tooling_name) });
  } catch (err) {
    console.error('Fetch tooling names error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── CREATE TABLE ───────────────────────────────────────────────────────────

// POST /api/tooling-select/create-table
router.post('/create-table', isAdmin, async (req, res) => {
  const { machineName, dimCount } = req.body;
  if (!machineName)
    return res.status(400).json({ success: false, error: 'machineName required' });

  const tableName = 'tooling_' +
    machineName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  if (!/^tooling_[a-z0-9_]+$/.test(tableName))
    return res.status(400).json({ success: false, error: 'Invalid machine name format' });

  if (await tableExists(tableName))
    return res.status(400).json({ success: false, error: `Table already exists` });

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
  } catch (err) {
    console.error('Create table error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── INVENTORY CRUD ─────────────────────────────────────────────────────────

// GET /api/tooling-select/inventory/:tableName
router.get('/inventory/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const r = await engPool.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Fetch inventory error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/tooling-select/inventory/:tableName  (insert)
router.post('/inventory/:tableName', isAdmin, async (req, res) => {
  const { tableName } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });

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
  } catch (err) {
    console.error('Insert inventory error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /api/tooling-select/inventory/:tableName/:id  (update)
router.put('/inventory/:tableName/:id', isAdmin, async (req, res) => {
  const { tableName, id } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });

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
  } catch (err) {
    console.error('Update inventory error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// DELETE /api/tooling-select/inventory/:tableName/:id
router.delete('/inventory/:tableName/:id', isAdmin, async (req, res) => {
  const { tableName, id } = req.params;
  if (!await tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const r = await engPool.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
      [id]
    );
    if (r.rowCount === 0)
      return res.status(404).json({ success: false, error: 'Record not found' });
    res.json({ success: true, deletedId: r.rows[0].id });
  } catch (err) {
    console.error('Delete inventory error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;