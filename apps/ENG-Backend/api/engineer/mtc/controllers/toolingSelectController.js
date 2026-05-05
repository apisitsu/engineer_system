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
  const {
    machine_name, tool_category, target_tool_table,
    calc_context, machine_ok_condition,
    dims, result_fields,
    // legacy fields
    rule_name, source_field, operator, offset_value,
    target_tool_field, tolerance_plus, tolerance_minus,
  } = req.body;
  try {
    const r = await engPool.query(
      `INSERT INTO ${TABLES.MTC_SELECTION_RULES}
       (machine_name, tool_category, target_tool_table,
        calc_context, machine_ok_condition, dims, result_fields,
        rule_name, source_field, operator, offset_value,
        target_tool_field, tolerance_plus, tolerance_minus)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        machine_name, tool_category, target_tool_table,
        calc_context || null, machine_ok_condition || null,
        dims ? JSON.stringify(dims) : null,
        result_fields ? JSON.stringify(result_fields) : null,
        rule_name || null, source_field || null, operator || null,
        offset_value || null, target_tool_field || null,
        tolerance_plus || null, tolerance_minus || null,
      ]
    );
    res.json({ success: true, rule: r.rows[0] });
  } catch (err) {
    console.error('Create rule error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/rules/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    machine_name, tool_category, target_tool_table,
    calc_context, machine_ok_condition,
    dims, result_fields,
    rule_name, source_field, operator, offset_value,
    target_tool_field, tolerance_plus, tolerance_minus,
    is_active,
  } = req.body;
  try {
    const r = await engPool.query(
      `UPDATE ${TABLES.MTC_SELECTION_RULES} SET
        machine_name=$1, tool_category=$2, target_tool_table=$3,
        calc_context=$4, machine_ok_condition=$5,
        dims=$6::jsonb, result_fields=$7::jsonb,
        rule_name=$8, source_field=$9, operator=$10, offset_value=$11,
        target_tool_field=$12, tolerance_plus=$13, tolerance_minus=$14,
        is_active=COALESCE($15, is_active)
       WHERE id=$16 RETURNING *`,
      [
        machine_name, tool_category, target_tool_table,
        calc_context || null, machine_ok_condition || null,
        dims ? JSON.stringify(dims) : null,
        result_fields ? JSON.stringify(result_fields) : null,
        rule_name || null, source_field || null, operator || null,
        offset_value || null, target_tool_field || null,
        tolerance_plus || null, tolerance_minus || null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, rule: r.rows[0] });
  } catch (err) {
    console.error('Update rule error:', err.message);
    res.status(500).json({ success: false, error: err.message });
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

// ── Spec Process (Part Specification) CRUD ─────────────────────────────────

router.get('/spec', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT * FROM ${TABLES.SPEC_PROCESS}`;
    let countQuery = `SELECT COUNT(*) FROM ${TABLES.SPEC_PROCESS}`;
    const params = [];

    if (q) {
      query += ` WHERE cn ILIKE $1 OR type ILIKE $1 OR process ILIKE $1`;
      countQuery += ` WHERE cn ILIKE $1 OR type ILIKE $1 OR process ILIKE $1`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY cn LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [dataRes, countRes] = await Promise.all([
      engPool.query(query, dataParams),
      engPool.query(countQuery, params)
    ]);

    res.json({
      success: true,
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Fetch spec error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/spec', isAdmin, async (req, res) => {
  const {
    cn, od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
    od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
    type, yball, process, sd, sd_aft
  } = req.body;

  if (!cn) return res.status(400).json({ success: false, error: 'CN Number is required' });

  try {
    const r = await engPool.query(
      `INSERT INTO ${TABLES.SPEC_PROCESS} (
        cn, od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
        od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
        type, yball, process, sd, sd_aft
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [
        cn, od_bf||0, od_bf_max||0, od_bf_min||0, id_bf||0, id_bf_max||0, id_bf_min||0, w_bf||0, w_bf_max||0, w_bf_min||0,
        od_aft||0, od_aft_max||0, od_aft_min||0, id_aft||0, id_aft_max||0, id_aft_min||0, w_aft||0, w_aft_max||0, w_aft_min||0,
        type, yball, process, sd||0, sd_aft||0
      ]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Create spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/spec/:cn', isAdmin, async (req, res) => {
  const { cn } = req.params;
  const {
    od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
    od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
    type, yball, process, sd, sd_aft
  } = req.body;

  try {
    const r = await engPool.query(
      `UPDATE ${TABLES.SPEC_PROCESS} SET
        od_bf=$1, od_bf_max=$2, od_bf_min=$3, id_bf=$4, id_bf_max=$5, id_bf_min=$6, w_bf=$7, w_bf_max=$8, w_bf_min=$9,
        od_aft=$10, od_aft_max=$11, od_aft_min=$12, id_aft=$13, id_aft_max=$14, id_aft_min=$15, w_aft=$16, w_aft_max=$17, w_aft_min=$18,
        type=$19, yball=$20, process=$21, sd=$22, sd_aft=$23
      WHERE cn=$24 RETURNING *`,
      [
        od_bf||0, od_bf_max||0, od_bf_min||0, id_bf||0, id_bf_max||0, id_bf_min||0, w_bf||0, w_bf_max||0, w_bf_min||0,
        od_aft||0, od_aft_max||0, od_aft_min||0, id_aft||0, id_aft_max||0, id_aft_min||0, w_aft||0, w_aft_max||0, w_aft_min||0,
        type, yball, process, sd||0, sd_aft||0, cn
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Spec not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Update spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/spec/:cn', isAdmin, async (req, res) => {
  const { cn } = req.params;
  try {
    const r = await engPool.query(`DELETE FROM ${TABLES.SPEC_PROCESS} WHERE cn=$1 RETURNING *`, [cn]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Spec not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete spec error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
