const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const { isAdmin } = require('../../../../middleware/mtcAuth');
const cache = require('../services/agents/CacheAgent');

const router = express.Router();

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
  const { machine_type_name, grinding_area_label, tool_code_filter, is_active } = req.body;
  try {
    const sets = [];
    const vals = [];
    if (machine_type_name !== undefined) { vals.push(machine_type_name); sets.push(`machine_type_name=$${vals.length}`); }
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
router.post('/mappings', isAdmin, async (req, res) => {
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
router.put('/mappings/:id', isAdmin, async (req, res) => {
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
router.delete('/mappings/:id', isAdmin, async (req, res) => {
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
router.put('/parameters', isAdmin, async (req, res) => {
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
router.put('/parameters/bulk', isAdmin, async (req, res) => {
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
router.delete('/parameters/:id', isAdmin, async (req, res) => {
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
router.put('/machine-tools/bulk', isAdmin, async (req, res) => {
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
router.delete('/machine-tools/combo', isAdmin, async (req, res) => {
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

// ── Audit: Data Integrity ────────────────────────────────────────────────────

/** GET /api/sds/v2/admin/audit/data-integrity */
router.get('/audit/data-integrity', isAdmin, async (req, res) => {
  try {
    // 1. Count C2x/C3x Enabled Items
    const countsResult = await maqPool.query(`
      SELECT sub_class, COUNT(*) 
      FROM lpb.eng_item 
      WHERE (sub_class LIKE 'C2%' OR sub_class LIKE 'C3%') AND condition = 'Enable'
      GROUP BY sub_class ORDER BY sub_class
    `);

    const itemCounts = countsResult.rows.map(r => ({ sub_class: r.sub_class, count: parseInt(r.count) }));
    const raceTotal = itemCounts.filter(r => r.sub_class.startsWith('C2')).reduce((sum, r) => sum + r.count, 0);
    const ballTotal = itemCounts.filter(r => r.sub_class.startsWith('C3')).reduce((sum, r) => sum + r.count, 0);

    // 2. Critical: No Process Plan (Routing missing entirely)
    // In LPB, process_plan_no is usually equal to control_no
    const noProcessPlanResult = await maqPool.query(`
      SELECT i.control_no, i.sub_class
      FROM lpb.eng_item i
      WHERE (i.sub_class LIKE 'C2%' OR i.sub_class LIKE 'C3%') 
        AND i.condition = 'Enable'
        AND NOT EXISTS (
          SELECT 1 FROM lpb.eng_process_info pi 
          WHERE pi.process_plan_no = i.control_no
        )
      ORDER BY i.control_no
    `);

    // 3. Warning: Missing Tooling in specific Process Codes
    const targetProcessCodes = ['1011', '1012', '1021', '1022', '1041', '1042', '1061', '1062', '1101', '1102', '1181', '1182', '1241'];
    
    const missingToolingResult = await maqPool.query(`
      SELECT i.control_no, i.sub_class, pi.process_code, pi.wc
      FROM lpb.eng_item i
      JOIN lpb.eng_process_info pi ON pi.process_plan_no = i.control_no
      LEFT JOIN lpb.eng_r_pi_tool rpt ON (rpt.process_plan_no = pi.process_plan_no AND rpt.process_code = pi.process_code)
      WHERE (i.sub_class LIKE 'C2%' OR i.sub_class LIKE 'C3%') 
        AND i.condition = 'Enable'
        AND pi.process_code = ANY($1)
        AND rpt.tool_dwg_no IS NULL
      ORDER BY i.control_no, pi.seq_no
    `, [targetProcessCodes]);

    const missingRows = missingToolingResult.rows;
    
    // Enrich both groups with Machine Model from rodpcPool
    const { pool: rodpcPool } = require('../../../../instance/instance');
    const allCns = [...new Set([...noProcessPlanResult.rows.map(r => r.control_no), ...missingRows.map(r => r.control_no)])];
    
    let modelMap = {};
    let mtcMap = {};

    if (allCns.length > 0) {
      const prodRes = await rodpcPool.query(`
        SELECT control_no, model FROM rodpc.kzwmaq_eng_production 
        WHERE control_no = ANY($1)
      `, [allCns]);
      
      modelMap = prodRes.rows.reduce((acc, row) => {
        acc[row.control_no] = row.model;
        return acc;
      }, {});

      const models = [...new Set(prodRes.rows.map(r => r.model))];
      const mtcRes = await engPool.query(`
        SELECT machine_type_name, machine_type_code FROM sds_machine_type_code
        WHERE machine_type_name = ANY($1)
      `, [models]);

      mtcMap = mtcRes.rows.reduce((acc, row) => {
        acc[row.machine_type_name] = row.machine_type_code;
        return acc;
      }, {});
    }

    const enrich = (row) => ({
      ...row,
      machine_name: modelMap[row.control_no] || null,
      machine_type_code: mtcMap[modelMap[row.control_no]] || null
    });

    res.json({
      itemCounts,
      totals: { raceTotal, ballTotal, grandTotal: raceTotal + ballTotal },
      noProcessPlan: noProcessPlanResult.rows.map(enrich),
      missingTooling: missingRows.map(enrich),
    });
  } catch (err) {
    console.error('[Audit API Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
