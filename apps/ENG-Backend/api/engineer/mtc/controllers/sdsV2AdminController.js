const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

const router = express.Router();

// ── Machine Type Codes ───────────────────────────────────────────────────────

/** GET /api/sds/v2/admin/machine-types */
router.get('/machine-types', async (req, res) => {
  const { search } = req.query;
  try {
    let sql = `SELECT id, machine_type_code, machine_type_name, grinding_area_label, tool_code_filter, is_active, created_at
               FROM ${TABLES.SDS_MACHINE_TYPE_CODE}`;
    const params = [];
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` WHERE machine_type_name ILIKE $1 OR machine_type_code ILIKE $1`;
    }
    sql += ' ORDER BY machine_type_code';
    const result = await engPool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/admin/machine-types/:id */
router.put('/machine-types/:id', async (req, res) => {
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
    const result = await engPool.query(
      `UPDATE ${TABLES.SDS_MACHINE_TYPE_CODE} SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Machine type not found' });
    res.json(result.rows[0]);
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
router.post('/mappings', async (req, res) => {
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
router.put('/mappings/:id', async (req, res) => {
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
router.delete('/mappings/:id', async (req, res) => {
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
router.put('/parameters', async (req, res) => {
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
router.put('/parameters/bulk', async (req, res) => {
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
router.delete('/parameters/:id', async (req, res) => {
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

module.exports = router;
