'use strict';

const express = require('express');
const router = express.Router();
const { findFixtures } = require('../services/fixtureLogic');
const { invalidateCache } = require('../services/ToolingOrchestrator');
const cache = require('../services/agents/CacheAgent');
const monitor = require('../services/agents/MonitorAgent');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const inventoryService = require('../services/inventoryService');
const tableAdminService = require('../services/tableAdminService');
const { invalidateMachineConfigCache } = require('../services/machineQueryService');
const { isAdmin } = require('../../../../middleware/mtcAuth');
const FormulaService = require('../services/FormulaService');
const { MACHINE_TABLE_CONFIG } = require('../services/machineTableConfig');
const { searchByCn } = require('../services/sdsV2SearchService');

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
    cache.invalidatePrefix('tooling:');
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
    cache.invalidatePrefix('tooling:');
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
    cache.invalidatePrefix('tooling:');
    res.json({ success: true });
  } catch (err) {
    console.error('Delete rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Rules Health Check ─────────────────────────────────────────────────────
// Sourced from FormulaService — single source of truth.
const { ENRICHED_CONTEXT_KEYS } = FormulaService;

router.get('/rules/validate', async (req, res) => {
  try {
    const [rulesRes, formulaRes, sdsNamesRes] = await Promise.all([
      engPool.query(
        `SELECT id, machine_name, tool_category, calc_context, dims
         FROM ${TABLES.MTC_SELECTION_RULES}
         WHERE is_active = true AND dims IS NOT NULL AND jsonb_array_length(dims) > 0`
      ),
      engPool.query(`SELECT DISTINCT machine_name, parameter_name FROM ${TABLES.TOOLING_FORMULA}`),
      engPool.query(
        `SELECT DISTINCT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
         WHERE is_active = true AND machine_type_name IS NOT NULL`
      ),
    ]);

    const formulaMap = {};
    for (const row of formulaRes.rows) {
      const key = row.machine_name.toLowerCase().replace(/-/g, '');
      if (!formulaMap[key]) formulaMap[key] = new Set();
      formulaMap[key].add(row.parameter_name);
    }

    const issues = [];
    for (const rule of rulesRes.rows) {
      const dims = Array.isArray(rule.dims) ? rule.dims : [];
      const normalizedCtx = (rule.calc_context || '').toLowerCase().replace(/-/g, '');
      const validKeys = new Set([...ENRICHED_CONTEXT_KEYS, ...(formulaMap[normalizedCtx] || [])]);

      for (const dim of dims) {
        if (dim.calc_key && !validKeys.has(dim.calc_key)) {
          issues.push({
            rule_id:       rule.id,
            machine_name:  rule.machine_name,
            tool_category: rule.tool_category,
            calc_context:  rule.calc_context,
            bad_calc_key:  dim.calc_key,
            tool_field:    dim.tool_field,
          });
        }
      }
    }

    // Build valid formula keys per calc_context (used by frontend repair dropdowns)
    const validKeysByContext = {};
    for (const rule of rulesRes.rows) {
      if (rule.calc_context && !validKeysByContext[rule.calc_context]) {
        const normalizedCtx = rule.calc_context.toLowerCase().replace(/-/g, '');
        validKeysByContext[rule.calc_context] = [...(formulaMap[normalizedCtx] || [])].sort();
      }
    }

    // Expose enriched-context keys for frontend audit dropdowns (exclude single A–Z letters)
    const enriched_context_keys = [...ENRICHED_CONTEXT_KEYS]
      .filter(k => k.length > 1)
      .sort();

    // Cross-system machine name sync check: Tooling Select (tooling_formula) ↔ SDS (sds_machine_type_code)
    const formulaNames = new Set(formulaRes.rows.map(r => r.machine_name));
    const sdsNames     = new Set(sdsNamesRes.rows.map(r => r.machine_type_name));
    const in_formula_not_sds = [...formulaNames].filter(n => !sdsNames.has(n)).sort();
    const in_sds_not_formula = [...sdsNames].filter(n => !formulaNames.has(n)).sort();

    res.json({
      success: true,
      total_rules_checked: rulesRes.rows.length,
      issue_count: issues.length,
      issues,
      valid_keys_by_context: validKeysByContext,
      enriched_context_keys,
      machine_sync: {
        ok: in_formula_not_sds.length === 0 && in_sds_not_formula.length === 0,
        in_formula_not_sds,
        in_sds_not_formula,
      },
    });
  } catch (err) {
    console.error('Validate rules error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Inventory Columns (for Selection Rule validation) ─────────────────────

router.get('/columns/:tableName', async (req, res) => {
  const { tableName } = req.params;
  if (!await inventoryService.tableExists(tableName))
    return res.status(400).json({ success: false, error: 'Invalid or unauthorized table' });
  try {
    const r = await engPool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [tableName]
    );
    res.json({ success: true, columns: r.rows.map(row => row.column_name) });
  } catch (err) {
    console.error('Fetch columns error:', err.message);
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
    cache.invalidatePrefix('tooling:');
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
    cache.invalidatePrefix('tooling:');
    res.json({ success: true, deletedId });
  } catch (err) {
    console.error('Delete inventory error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// ── Spec Process (Part Specification) CRUD ─────────────────────────────────

router.get('/spec', async (req, res) => {
  try {
    const { q } = req.query;
    const safePage  = Math.max(1, parseInt(req.query.page)  || 1);
    const safeLimit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset    = (safePage - 1) * safeLimit;
    let query = `SELECT * FROM ${TABLES.SPEC_PROCESS}`;
    let countQuery = `SELECT COUNT(*) FROM ${TABLES.SPEC_PROCESS}`;
    const params = [];

    if (q) {
      query += ` WHERE cn ILIKE $1 OR type ILIKE $1 OR process ILIKE $1`;
      countQuery += ` WHERE cn ILIKE $1 OR type ILIKE $1 OR process ILIKE $1`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY cn LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, safeLimit, offset];

    const [dataRes, countRes] = await Promise.all([
      engPool.query(query, dataParams),
      engPool.query(countQuery, params)
    ]);

    res.json({
      success: true,
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: safePage,
      limit: safeLimit,
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
    invalidateCache(cn);
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
    invalidateCache(cn);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete spec error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Spec: Sync from Factory ───────────────────────────────────────────────

// ── Derivation rules: process_code → grinding type ───────────────────────
// Source: lpb.eng_process_info.process_code, sorted by seq_no ascending.
// The first code that matches either set determines process direction.
// Add more codes as confirmed from factory DB.

const ID_GRIND_PROCESS_CODES = new Set([
  '1061', '1062',          // ID Grind (rough / finish)
  // add others as confirmed, e.g. '1021', '1022'
]);

const OD_GRIND_PROCESS_CODES = new Set([
  '1041', '1042',          // OD Grind (rough / finish)
  // add others as confirmed, e.g. '1011', '1012', '1101', '1102'
]);

// CN class codes where yBall = 'Y' (verified from DB: class 35 only)
// DB query: SELECT LEFT(cn,2), yball, COUNT(*) FROM tooling_spec_process
//           WHERE yball <> 'N' GROUP BY LEFT(cn,2), yball
// Handles both old 6-digit (350611 → class 35) and new format (C35-00611 → C35)
const YBALL_Y_CLASSES = new Set(['35']); // → C35-xxxxx series

function deriveProcess(processInfo) {
  const sorted = [...(processInfo || [])].sort((a, b) => (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0));
  for (const row of sorted) {
    const code = String(row.process_code || '');
    if (ID_GRIND_PROCESS_CODES.has(code)) return 'ID->OD';
    if (OD_GRIND_PROCESS_CODES.has(code)) return 'OD->ID';
  }
  return null;
}

function deriveYBall(cn) {
  const s = String(cn || '').trim().toUpperCase();
  // Normalize to 2-digit class code: '350611' → '35', 'C35-00611' → '35'
  const classCode = /^\d{6}$/.test(s) ? s.slice(0, 2) : s.slice(1, 3);
  return YBALL_Y_CLASSES.has(classCode) ? 'Y' : 'N';
}

/**
 * Map raw lpb.* dimension row → proposed tooling_spec_process values.
 * Handles common column naming patterns (od/od_bf, tolerances _max/_min/_h/_l).
 * Returns null for fields not found in factory data.
 */
function mapFactoryDimToSpec(dim) {
  const d = dim || {};
  const pf = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const findTol = (base, sign) => {
    for (const key of [`${base}_${sign}`, `${base}_tol_${sign}`, `${base}${sign.toUpperCase()}`])
      if (d[key] !== undefined) return pf(d[key]);
    return null;
  };

  return {
    od_aft:     pf(d.od)    ?? pf(d.od_aft),
    id_aft:     pf(d.id)    ?? pf(d.id_aft),
    w_aft:      pf(d.w)     ?? pf(d.w_aft),
    od_aft_max: findTol('od', 'max') ?? findTol('od', 'h') ?? pf(d.od_aft_max),
    od_aft_min: findTol('od', 'min') ?? findTol('od', 'l') ?? pf(d.od_aft_min),
    id_aft_max: findTol('id', 'max') ?? findTol('id', 'h') ?? pf(d.id_aft_max),
    id_aft_min: findTol('id', 'min') ?? findTol('id', 'l') ?? pf(d.id_aft_min),
    w_aft_max:  findTol('w',  'max') ?? findTol('w',  'h') ?? pf(d.w_aft_max),
    w_aft_min:  findTol('w',  'min') ?? findTol('w',  'l') ?? pf(d.w_aft_min),
    od_bf:      pf(d.od_bf),
    id_bf:      pf(d.id_bf),
    w_bf:       pf(d.w_bf),
    od_bf_max:  findTol('od_bf', 'max') ?? findTol('od_bf', 'h') ?? pf(d.od_bf_max),
    od_bf_min:  findTol('od_bf', 'min') ?? findTol('od_bf', 'l') ?? pf(d.od_bf_min),
    id_bf_max:  findTol('id_bf', 'max') ?? findTol('id_bf', 'h') ?? pf(d.id_bf_max),
    id_bf_min:  findTol('id_bf', 'min') ?? findTol('id_bf', 'l') ?? pf(d.id_bf_min),
    w_bf_max:   findTol('w_bf',  'max') ?? findTol('w_bf',  'h') ?? pf(d.w_bf_max),
    w_bf_min:   findTol('w_bf',  'min') ?? findTol('w_bf',  'l') ?? pf(d.w_bf_min),
    sd:         pf(d.sd),
    sd_aft:     pf(d.sd_aft),
  };
}

// GET /api/tooling-select/spec/factory-preview/:cn
// Returns factory dimension data + proposed spec mapping for admin review
router.get('/spec/factory-preview/:cn', isAdmin, async (req, res) => {
  const cn = req.params.cn.trim().toUpperCase();
  try {
    const searchData = await searchByCn(cn, maqPool, rodpcPool);
    const dim = searchData.dimension || {};
    const proposed = mapFactoryDimToSpec(dim);

    // Derive special fields
    const derived_yball   = deriveYBall(searchData.cn); // use normalized CN from factory
    const derived_process = deriveProcess(searchData.process_info || []);

    // Merge into proposed (only set when derivation produces a value)
    proposed.yball   = derived_yball;
    proposed.process = derived_process; // null = "not configured — check process_info below"

    const existingRes = await engPool.query(
      `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`, [cn]
    );
    const existing = existingRes.rows[0] || null;

    const synced_fields = Object.entries(proposed)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);

    // Process info summary for admin verification (seq_no + process_code)
    const process_info_summary = (searchData.process_info || [])
      .sort((a, b) => (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0))
      .map(r => ({ seq_no: r.seq_no, process_code: r.process_code, process_name: r.process_name || r.process_eng || null }));

    const derived_config_status = {
      yball_prefix_used: YBALL_Y_PREFIXES.has(cn.slice(0, 3)) ? 'Y' : (YBALL_B_PREFIXES.has(cn.slice(0, 3)) ? 'B' : 'N'),
      process_codes_configured: ID_GRIND_PROCESS_CODES.size > 0 || OD_GRIND_PROCESS_CODES.size > 0,
    };

    res.json({
      success: true,
      cn: searchData.cn,
      part_type: searchData.part_type,
      factory_columns: Object.keys(dim).filter(k => k !== 'control_no'),
      proposed,
      existing,
      synced_fields,
      manual_fields: ['type'],
      derived_fields: { yball: derived_yball, process: derived_process },
      process_info_summary,
      derived_config_status,
    });
  } catch (err) {
    console.error('Factory preview error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/tooling-select/spec/sync/:cn
// Upserts dimension data; never overwrites type/yball/process on existing rows
router.post('/spec/sync/:cn', isAdmin, async (req, res) => {
  const cn = req.params.cn.trim().toUpperCase();
  const v = req.body.confirmed_values || {};

  try {
    const existingRes = await engPool.query(
      `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`, [cn]
    );

    const vals = [
      v.od_bf  ||0, v.od_bf_max  ||0, v.od_bf_min  ||0,
      v.id_bf  ||0, v.id_bf_max  ||0, v.id_bf_min  ||0,
      v.w_bf   ||0, v.w_bf_max   ||0, v.w_bf_min   ||0,
      v.od_aft ||0, v.od_aft_max ||0, v.od_aft_min ||0,
      v.id_aft ||0, v.id_aft_max ||0, v.id_aft_min ||0,
      v.w_aft  ||0, v.w_aft_max  ||0, v.w_aft_min  ||0,
      v.sd     ||0, v.sd_aft     ||0,
    ];

    const yball  = v.yball  || null;
    const process = v.process || null;

    let r;
    if (existingRes.rows.length === 0) {
      r = await engPool.query(
        `INSERT INTO ${TABLES.SPEC_PROCESS} (
          cn,
          od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
          od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
          type, yball, process, sd, sd_aft
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
        RETURNING *`,
        [cn, ...vals, null, yball || 'N', process]
      );
    } else {
      // Update dimensions + derived fields; preserve type; only update yball/process if derived value is provided
      const setParts = [
        'od_bf=$1, od_bf_max=$2, od_bf_min=$3, id_bf=$4, id_bf_max=$5, id_bf_min=$6, w_bf=$7, w_bf_max=$8, w_bf_min=$9',
        'od_aft=$10, od_aft_max=$11, od_aft_min=$12, id_aft=$13, id_aft_max=$14, id_aft_min=$15, w_aft=$16, w_aft_max=$17, w_aft_min=$18',
        'sd=$19, sd_aft=$20',
      ];
      const updateVals = [...vals, cn];
      let paramIdx = 22;
      if (yball)  { setParts.push(`yball=$${paramIdx++}`);   updateVals.splice(-1, 0, yball); }
      if (process){ setParts.push(`process=$${paramIdx++}`); updateVals.splice(-1, 0, process); }

      r = await engPool.query(
        `UPDATE ${TABLES.SPEC_PROCESS} SET ${setParts.join(', ')} WHERE cn=$21 RETURNING *`,
        updateVals
      );
    }

    const preserved = existingRes.rows.length > 0
      ? ['type', ...(!yball ? ['yball'] : []), ...(!process ? ['process'] : [])]
      : [];

    invalidateCache(cn);
    res.json({
      success: true,
      data: r.rows[0],
      action: existingRes.rows.length === 0 ? 'created' : 'updated',
      preserved,
    });
  } catch (err) {
    console.error('Sync spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Normalize: 6-digit item_no (310016) → CN format (C31-00016); CN format passes through.
function normalizeCn(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (/^\d{6}$/.test(s)) {
    const cls = s.slice(0, 2);
    const pfx = cls >= '41' && cls <= '49' ? 'A' : 'C';
    return `${pfx}${cls}-0${s.slice(2)}`;
  }
  return s;
}

// CN 3-char prefix → lpb dimension table (mirrors PART_TYPE_MAP in sdsV2SearchService)
const PREFIX_TABLE_MAP = {
  C31: TABLES.LPB_ENG_BALL,  C32: TABLES.LPB_ENG_BALL,  C33: TABLES.LPB_ENG_BALL,
  C34: TABLES.LPB_ENG_BALL,  C35: TABLES.LPB_ENG_BALL,  C37: TABLES.LPB_ENG_BALL,
  C38: TABLES.LPB_ENG_BALL,  C39: TABLES.LPB_ENG_BALL,
  C21: TABLES.LPB_ENG_RACE,  C22: TABLES.LPB_ENG_RACE,  C23: TABLES.LPB_ENG_RACE,
  C24: TABLES.LPB_ENG_RACE,  C25: TABLES.LPB_ENG_RACE,  C26: TABLES.LPB_ENG_RACE,
  C27: TABLES.LPB_ENG_RACE,  C28: TABLES.LPB_ENG_RACE,  C29: TABLES.LPB_ENG_RACE,
  C11: TABLES.LPB_ENG_BODY,  C12: TABLES.LPB_ENG_BODY,  C13: TABLES.LPB_ENG_BODY,
  C14: TABLES.LPB_ENG_BODY,  C15: TABLES.LPB_ENG_BODY,  C16: TABLES.LPB_ENG_BODY,
  C17: TABLES.LPB_ENG_BODY,  C18: TABLES.LPB_ENG_BODY,  C19: TABLES.LPB_ENG_BODY,
  C51: TABLES.LPB_ENG_BODY,  C52: TABLES.LPB_ENG_BODY,  C53: TABLES.LPB_ENG_BODY,
  C54: TABLES.LPB_ENG_BODY,  C55: TABLES.LPB_ENG_BODY,  C56: TABLES.LPB_ENG_BODY,
  C57: TABLES.LPB_ENG_BODY,  C58: TABLES.LPB_ENG_BODY,  C59: TABLES.LPB_ENG_BODY,
  C61: TABLES.LPB_ENG_SLEEVE, C62: TABLES.LPB_ENG_SLEEVE, C63: TABLES.LPB_ENG_SLEEVE,
  C64: TABLES.LPB_ENG_SLEEVE, C69: TABLES.LPB_ENG_SLEEVE,
  A41: TABLES.LPB_ENG_SPH,   A42: TABLES.LPB_ENG_SPH,   A43: TABLES.LPB_ENG_SPH,
  A44: TABLES.LPB_ENG_SPH,   A48: TABLES.LPB_ENG_SPH,   A49: TABLES.LPB_ENG_SPH,
};

// POST /api/tooling-select/spec/sync-new
// Inserts spec rows for CNs that exist in factory (lpb.*) but not yet in tooling_spec_process.
// Uses direct maqPool queries (no rodpcPool dependency) so it works even when rodpc is down.
router.post('/spec/sync-new', isAdmin, async (req, res) => {
  try {
    // 1. All distinct CNs from each lpb dimension table (query separately — graceful per-table failure)
    const dimTables = [...new Set(Object.values(PREFIX_TABLE_MAP))];
    const tableResults = await Promise.allSettled(
      dimTables.map(t => maqPool.query(`SELECT DISTINCT control_no FROM ${t} LIMIT 20000`))
    );

    const tableStatus = dimTables.map((t, i) => {
      const r = tableResults[i];
      if (r.status === 'fulfilled') return { table: t, ok: true, count: r.value.rows.length };
      console.error(`[sync-new] table ${t} failed:`, r.reason?.message);
      return { table: t, ok: false, error: r.reason?.message };
    });

    const allFactoryCns = [...new Set(
      tableResults
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value.rows.map(row => normalizeCn(row.control_no)))
        .filter(cn => cn && PREFIX_TABLE_MAP[cn.slice(0, 3)])
    )].sort();

    console.log(`[sync-new] factory CNs found: ${allFactoryCns.length}, tables:`, tableStatus.map(s => `${s.table}=${s.ok ? s.count : 'ERR'}`).join(', '));

    // 2. All CNs already in spec
    const specRes  = await engPool.query(`SELECT cn FROM ${TABLES.SPEC_PROCESS}`);
    const existing = new Set(specRes.rows.map(r => r.cn?.trim().toUpperCase()));

    // 3. New CNs only (no cap — process all at once)
    const newCns = allFactoryCns.filter(cn => !existing.has(cn));
    console.log(`[sync-new] existing spec: ${existing.size}, new to insert: ${newCns.length}`);

    if (newCns.length === 0) {
      return res.json({ success: true, total_found: 0, synced: 0, failed: 0, errors: [], table_status: tableStatus });
    }

    // 4. Bulk-fetch dims: one query per factory table (not one per CN)
    const byTable = {};
    for (const cn of newCns) {
      const tbl = PREFIX_TABLE_MAP[cn.slice(0, 3)];
      if (!byTable[tbl]) byTable[tbl] = [];
      byTable[tbl].push(cn);
    }
    const dimRowsMap = {};
    await Promise.all(
      Object.entries(byTable).map(async ([tbl, cns]) => {
        try {
          const r = await maqPool.query(`SELECT * FROM ${tbl} WHERE control_no = ANY($1)`, [cns]);
          for (const row of r.rows) {
            const key = row.control_no?.trim().toUpperCase();
            if (key) dimRowsMap[key] = row;
          }
        } catch (e) {
          console.error(`[sync-new] dim fetch failed for ${tbl}:`, e.message);
        }
      })
    );

    // 5. Bulk-fetch process codes: pi_item → plan_nos → process_info
    const cnToPlanNos = {};
    try {
      const piRes = await maqPool.query(
        `SELECT control_no, process_plan_no FROM ${TABLES.LPB_ENG_R_PI_ITEM} WHERE control_no = ANY($1)`,
        [newCns]
      );
      for (const row of piRes.rows) {
        const cn = row.control_no?.trim().toUpperCase();
        if (!cnToPlanNos[cn]) cnToPlanNos[cn] = [];
        cnToPlanNos[cn].push(row.process_plan_no);
      }
    } catch (e) {
      console.error('[sync-new] pi_item fetch failed:', e.message);
    }

    const allPlanNos = [...new Set(Object.values(cnToPlanNos).flat())];
    const planToProcs = {};
    if (allPlanNos.length > 0) {
      try {
        const procRes = await maqPool.query(
          `SELECT process_plan_no, seq_no, process_code FROM ${TABLES.LPB_ENG_PROCESS_INFO} WHERE process_plan_no = ANY($1)`,
          [allPlanNos]
        );
        for (const row of procRes.rows) {
          if (!planToProcs[row.process_plan_no]) planToProcs[row.process_plan_no] = [];
          planToProcs[row.process_plan_no].push(row);
        }
      } catch (e) {
        console.error('[sync-new] process_info fetch failed:', e.message);
      }
    }

    // 6. Build value rows
    const COLS = 24;
    const rows = newCns.map(cn => {
      const proposed = mapFactoryDimToSpec(dimRowsMap[cn] || {});
      proposed.yball   = deriveYBall(cn);
      const procRows   = (cnToPlanNos[cn] || []).flatMap(pno => planToProcs[pno] || []);
      proposed.process = deriveProcess(procRows);
      return [
        cn,
        proposed.od_bf   ||0, proposed.od_bf_max  ||0, proposed.od_bf_min  ||0,
        proposed.id_bf   ||0, proposed.id_bf_max  ||0, proposed.id_bf_min  ||0,
        proposed.w_bf    ||0, proposed.w_bf_max   ||0, proposed.w_bf_min   ||0,
        proposed.od_aft  ||0, proposed.od_aft_max ||0, proposed.od_aft_min ||0,
        proposed.id_aft  ||0, proposed.id_aft_max ||0, proposed.id_aft_min ||0,
        proposed.w_aft   ||0, proposed.w_aft_max  ||0, proposed.w_aft_min  ||0,
        proposed.sd      ||0, proposed.sd_aft     ||0,
        null, proposed.yball || 'N', proposed.process,
      ];
    });

    // 7. Multi-row INSERT in chunks of 2000 (24 params × 2000 = 48000 < pg 65535 limit)
    let synced = 0, failed = 0;
    const errors = [];
    const CHUNK_ROWS = 2000;

    for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
      const chunk = rows.slice(i, i + CHUNK_ROWS);
      const placeholders = chunk.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      try {
        const result = await engPool.query(
          `INSERT INTO ${TABLES.SPEC_PROCESS}
           (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
            od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
            sd, sd_aft, type, yball, process)
           VALUES ${placeholders}`,
          chunk.flat()
        );
        synced += result.rowCount;
      } catch (e) {
        console.error(`[sync-new] chunk insert failed (rows ${i}-${i + chunk.length}):`, e.message);
        // Fallback: insert one-by-one to identify which CNs caused the error
        for (let j = 0; j < chunk.length; j++) {
          try {
            await engPool.query(
              `INSERT INTO ${TABLES.SPEC_PROCESS}
               (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
                od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
                sd, sd_aft, type, yball, process)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
              chunk[j]
            );
            synced++;
          } catch (e2) {
            failed++;
            errors.push({ cn: chunk[j][0], error: e2.message });
          }
        }
      }
    }

    console.log(`[sync-new] done: synced=${synced}, failed=${failed}`);
    res.json({ success: true, total_found: newCns.length, synced, failed, errors, table_status: tableStatus });
  } catch (err) {
    console.error('sync-new spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Machine Table Config (static display config for legacy machines) ──────
router.get('/machine-table-config', (req, res) => {
  res.json({ success: true, configs: MACHINE_TABLE_CONFIG });
});

// ── Machine Config (Phase 1/2) ────────────────────────────────────────────
// GET /api/tooling-select/machine-config
router.get('/machine-config', async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT * FROM ${TABLES.MTC_MACHINE_CONFIG} ORDER BY id`
    );
    res.json({ success: true, configs: result.rows });
  } catch (err) {
    console.error('machine-config GET error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/tooling-select/machine-config  (isAdmin)
router.post('/machine-config', isAdmin, async (req, res) => {
  const { machine_key, machine_name, display_name, ok_flag_key, conditions, use_dynamic_rules } = req.body;
  if (!machine_key || !machine_name) {
    return res.status(400).json({ success: false, error: 'machine_key and machine_name are required' });
  }
  try {
    const result = await engPool.query(
      `INSERT INTO ${TABLES.MTC_MACHINE_CONFIG}
       (machine_key, machine_name, display_name, ok_flag_key, conditions, use_dynamic_rules)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [machine_key, machine_name, display_name || machine_name, ok_flag_key || null,
       JSON.stringify(conditions || []), use_dynamic_rules || false]
    );
    invalidateMachineConfigCache();
    cache.invalidatePrefix('tooling:');
    res.json({ success: true, config: result.rows[0] });
  } catch (err) {
    console.error('machine-config POST error:', err.message);
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'machine_key already exists' });
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /api/tooling-select/machine-config/:id  (isAdmin)
router.put('/machine-config/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { machine_name, display_name, ok_flag_key, conditions, use_dynamic_rules, is_active } = req.body;
  try {
    const result = await engPool.query(
      `UPDATE ${TABLES.MTC_MACHINE_CONFIG}
       SET machine_name       = COALESCE($1, machine_name),
           display_name       = COALESCE($2, display_name),
           ok_flag_key        = COALESCE($3, ok_flag_key),
           conditions         = COALESCE($4, conditions),
           use_dynamic_rules  = COALESCE($5, use_dynamic_rules),
           is_active          = COALESCE($6, is_active),
           updated_at         = NOW()
       WHERE id = $7 RETURNING *`,
      [machine_name, display_name, ok_flag_key,
       conditions !== undefined ? JSON.stringify(conditions) : null,
       use_dynamic_rules !== undefined ? use_dynamic_rules : null,
       is_active !== undefined ? is_active : null,
       id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Config not found' });
    invalidateMachineConfigCache();
    cache.invalidatePrefix('tooling:');
    res.json({ success: true, config: result.rows[0] });
  } catch (err) {
    console.error('machine-config PUT error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// DELETE /api/tooling-select/machine-config/:id  (isAdmin)
router.delete('/machine-config/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await engPool.query(
      `DELETE FROM ${TABLES.MTC_MACHINE_CONFIG} WHERE id=$1 RETURNING id`, [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Config not found' });
    invalidateMachineConfigCache();
    cache.invalidatePrefix('tooling:');
    res.json({ success: true });
  } catch (err) {
    console.error('machine-config DELETE error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Monitor — latency stats + cache info (isAdmin) ───────────────────────────

router.get('/monitor', isAdmin, (req, res) => {
  const stats = monitor.getAllStats();
  const slow  = monitor.slowAgents(2000);
  res.json({
    success: true,
    cache: {
      size:    cache.size(),
      keys:    cache.keys(),
      ttl_ms:  { tooling: cache.TTL.TOOLING, sds: cache.TTL.SDS },
    },
    agents: stats,
    slow_agents: slow,
  });
});

// Admin: manual cache flush (e.g., after bulk DB import)
router.delete('/monitor/cache', isAdmin, (req, res) => {
  const { prefix } = req.query;
  if (prefix) {
    cache.invalidatePrefix(prefix);
    res.json({ success: true, action: `invalidated prefix "${prefix}"` });
  } else {
    cache.invalidatePrefix('tooling:');
    cache.invalidatePrefix('sds:');
    res.json({ success: true, action: 'full cache flush' });
  }
});

module.exports = router;
