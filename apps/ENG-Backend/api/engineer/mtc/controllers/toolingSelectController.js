'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('../services/fixtureLogic');
const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const inventoryService = require('../services/inventoryService');
const tableAdminService = require('../services/tableAdminService');

// ── Role Authorization Middleware ──────────────────────────────────────────
const isAdmin = (req, res, next) => {
  const dept = req.user?.department || req.user?.u_department || req.user?.userDepartment;
  const role = req.user?.role || req.user?.u_role;
  if (dept === 'AD' || role === 'AD') return next();
  return res.status(403).json({ success: false, error: 'Access denied: Admin only' });
};

// ── Search ─────────────────────────────────────────────────────────────────

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

// ── Rules ──────────────────────────────────────────────────────────────────

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
    await engPool.query(
      `UPDATE ${TABLES.MTC_SELECTION_RULES} SET is_active=false WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Table Management ───────────────────────────────────────────────────────

router.get('/tables', async (req, res) => {
  try {
    const tables = await tableAdminService.listToolingTables();
    res.json({ success: true, tables });
  } catch (err) {
    console.error('Fetch tables error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.get('/tooling-names/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const names = await inventoryService.getToolingNames(tableName);
    res.json({ success: true, names });
  } catch (err) {
    console.error('Fetch tooling names error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/create-table', isAdmin, async (req, res) => {
  const { machineName, dimCount } = req.body;
  if (!machineName)
    return res.status(400).json({ success: false, error: 'machineName required' });
  try {
    const result = await tableAdminService.createTable(machineName, dimCount);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Create table error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// ── Inventory CRUD ─────────────────────────────────────────────────────────

router.get('/inventory/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const data = await inventoryService.listRecords(tableName);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Fetch inventory error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/inventory/:tableName', isAdmin, async (req, res) => {
  const { tableName } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const data = await inventoryService.insertRecord(tableName, req.body);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Insert inventory error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.put('/inventory/:tableName/:id', isAdmin, async (req, res) => {
  const { tableName, id } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const data = await inventoryService.updateRecord(tableName, id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Update inventory error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.delete('/inventory/:tableName/:id', isAdmin, async (req, res) => {
  const { tableName, id } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const deletedId = await inventoryService.deleteRecord(tableName, id);
    res.json({ success: true, deletedId });
  } catch (err) {
    console.error('Delete inventory error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
