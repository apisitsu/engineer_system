'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('./logic/fixtureLogic');
const { engPool } = require('../../../instance/eng_db');

// POST /api/tooling-select/search
router.post('/search', async (req, res) => {
  const { cnNumber } = req.body;
  if (!cnNumber || !String(cnNumber).trim()) {
    return res.status(400).json({ success: false, error: 'cnNumber is required' });
  }
  const result = await findFixtures(cnNumber);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

/**
 * --- DYNAMIC RULES API ---
 */

// GET /api/tooling-select/rules
router.get('/rules', async (req, res) => {
  try {
    const result = await engPool.query('SELECT * FROM mtc_selection_rules WHERE is_active = true ORDER BY machine_name, tool_category');
    res.json({ success: true, rules: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tooling-select/rules
router.post('/rules', async (req, res) => {
  const { machine_name, tool_category, rule_name, source_field, operator, offset_value, target_tool_table, target_tool_field, tolerance_plus, tolerance_minus } = req.body;
  try {
    const query = `
      INSERT INTO mtc_selection_rules 
      (machine_name, tool_category, rule_name, source_field, operator, offset_value, target_tool_table, target_tool_field, tolerance_plus, tolerance_minus)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
    const values = [machine_name, tool_category, rule_name, source_field, operator, offset_value, target_tool_table, target_tool_field, tolerance_plus, tolerance_minus];
    const result = await engPool.query(query, values);
    res.json({ success: true, rule: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tooling-select/rules/:id
router.delete('/rules/:id', async (req, res) => {
  try {
    await engPool.query('UPDATE mtc_selection_rules SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialization: /api/tooling-select/init-db
router.post('/init-db', async (req, res) => {
  // ... (existing code)
});

/**
 * --- GENERIC TOOLING MANAGEMENT API ---
 */

// GET /api/tooling-select/inventory/:tableName
router.get('/inventory/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const allowedTables = [
    'tooling_tsg300', 'tooling_ksb22g', 'tooling_ksb80', 'tooling_ks03a', 
    'tooling_ks400b', 'tooling_ks500rd', 'tooling_ks400b5', 'tooling_ks400b6'
  ];

  if (!allowedTables.includes(tableName)) {
    return res.status(400).json({ success: false, error: 'Invalid table name' });
  }

  try {
    const result = await engPool.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tooling-select/inventory/:tableName/:id
router.put('/inventory/:tableName/:id', async (req, res) => {
  const { tableName, id } = req.params;
  const updateData = req.body;

  try {
    const fields = Object.keys(updateData).filter(f => f !== 'id' && f !== 'created_at' && f !== 'updated_at');
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = fields.map(f => updateData[f]);
    values.push(id);

    const query = `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await engPool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
