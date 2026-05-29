'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');
const formulaService = require('../services/formulaService');

// GET /api/tooling-select-v2/machines/:machineId/formulas?tooling_name=
const list = async (req, res) => {
  const { machineId } = req.params;
  const { tooling_name } = req.query;
  try {
    let query, params;
    if (tooling_name?.trim()) {
      query = `SELECT * FROM ${TSV2_TABLES.FORMULA}
                WHERE machine_id = $1 AND tooling_name = $2
                ORDER BY sort_order ASC, id ASC`;
      params = [Number(machineId), tooling_name.trim()];
    } else {
      query = `SELECT * FROM ${TSV2_TABLES.FORMULA}
                WHERE machine_id = $1
                ORDER BY tooling_name ASC, sort_order ASC, id ASC`;
      params = [Number(machineId)];
    }
    const { rows } = await engPool.query(query, params);
    res.json({ success: true, formulas: rows });
  } catch (err) {
    console.error('tsv2 formula list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/tooling-select-v2/machines/:machineId/toolings — distinct tooling names
const listToolings = async (req, res) => {
  const { machineId } = req.params;
  try {
    const { rows } = await engPool.query(
      `SELECT DISTINCT tooling_name FROM ${TSV2_TABLES.FORMULA}
        WHERE machine_id = $1 ORDER BY tooling_name ASC`,
      [Number(machineId)]
    );
    res.json({ success: true, toolings: rows.map(r => r.tooling_name) });
  } catch (err) {
    console.error('tsv2 formula toolings error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const create = async (req, res) => {
  const { machineId } = req.params;
  const { tooling_name, output_key, formula_expr, condition_expr, sort_order, description } = req.body;
  if (!tooling_name?.trim() || !output_key?.trim() || !formula_expr?.trim()) {
    return res.status(400).json({ success: false, error: 'tooling_name, output_key, formula_expr are required' });
  }
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${TSV2_TABLES.FORMULA}
         (machine_id, tooling_name, output_key, formula_expr, condition_expr, sort_order, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [Number(machineId), tooling_name.trim(), output_key.trim().toUpperCase(),
       formula_expr.trim(), condition_expr?.trim() || null,
       sort_order ?? 0, description || null]
    );
    res.json({ success: true, formula: rows[0] });
  } catch (err) {
    console.error('tsv2 formula create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { tooling_name, output_key, formula_expr, condition_expr, sort_order, description } = req.body;
  try {
    const { rows } = await engPool.query(
      `UPDATE ${TSV2_TABLES.FORMULA}
          SET tooling_name   = COALESCE($1, tooling_name),
              output_key     = COALESCE($2, output_key),
              formula_expr   = COALESCE($3, formula_expr),
              condition_expr = $4,
              sort_order     = COALESCE($5, sort_order),
              description    = $6,
              updated_at     = NOW()
        WHERE id = $7 RETURNING *`,
      [tooling_name?.trim() || null, output_key?.trim()?.toUpperCase() || null,
       formula_expr?.trim() || null, condition_expr?.trim() || null,
       sort_order ?? null, description || null, Number(id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, formula: rows[0] });
  } catch (err) {
    console.error('tsv2 formula update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await engPool.query(
      `DELETE FROM ${TSV2_TABLES.FORMULA} WHERE id = $1`, [Number(id)]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('tsv2 formula delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/tooling-select-v2/formula/test
const test = async (req, res) => {
  const { formula_expr, context } = req.body;
  if (!formula_expr?.trim()) {
    return res.status(400).json({ success: false, error: 'formula_expr is required' });
  }
  try {
    const result = formulaService.testExpression(formula_expr.trim(), context || {});
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = { list, listToolings, create, update, remove, test };
