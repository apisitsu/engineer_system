'use strict';

const { engPool } = require('../../../../instance/eng_db');
const FormulaService = require('../services/FormulaService');

// GET /api/mtc/tooling-formula/machines
const getMachines = async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT DISTINCT machine_name FROM tooling_formula ORDER BY machine_name ASC`
    );
    res.json({ success: true, machines: result.rows.map(r => r.machine_name) });
  } catch (err) {
    console.error('toolingFormula getMachines error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/mtc/tooling-formula/:machineName?tooling_name=
const getFormulas = async (req, res) => {
  try {
    const { machineName } = req.params;
    const { tooling_name } = req.query;

    let result;
    if (tooling_name?.trim()) {
      result = await engPool.query(
        `SELECT * FROM tooling_formula
         WHERE machine_name = $1 AND tooling_name = $2
         ORDER BY id ASC`,
        [machineName, tooling_name.trim()]
      );
    } else {
      result = await engPool.query(
        `SELECT * FROM tooling_formula WHERE machine_name = $1 ORDER BY id ASC`,
        [machineName]
      );
    }

    res.json({ success: true, formulas: result.rows });
  } catch (err) {
    console.error('toolingFormula getFormulas error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/mtc/tooling-formula
const create = async (req, res) => {
  try {
    const { machine_name, tooling_name, parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark } = req.body;

    if (!machine_name || !tooling_name || !parameter_name || !formula_value) {
      return res.status(400).json({ success: false, error: 'machine_name, tooling_name, parameter_name and formula_value are required' });
    }

    const result = await engPool.query(
      `INSERT INTO tooling_formula
       (machine_name, tooling_name, parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [machine_name, tooling_name, parameter_name, formula_type || 'expression', formula_value, rounding_rule || 'none', rounding_precision ?? 2, remark || null]
    );

    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    console.error('toolingFormula create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// PUT /api/mtc/tooling-formula/:id
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark } = req.body;

    const result = await engPool.query(
      `UPDATE tooling_formula
       SET parameter_name     = COALESCE($1, parameter_name),
           formula_type       = COALESCE($2, formula_type),
           formula_value      = COALESCE($3, formula_value),
           rounding_rule      = COALESCE($4, rounding_rule),
           rounding_precision = COALESCE($5, rounding_precision),
           remark             = COALESCE($6, remark),
           updated_at         = NOW()
       WHERE id = $7
       RETURNING *`,
      [parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Formula not found' });
    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    console.error('toolingFormula update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// DELETE /api/mtc/tooling-formula/:id
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await engPool.query('DELETE FROM tooling_formula WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Formula not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('toolingFormula remove error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/mtc/tooling-formula/test
const test = async (req, res) => {
  try {
    const { formula, context } = req.body;
    const result = FormulaService.validateFormula(formula, context || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
};

module.exports = { getMachines, getFormulas, create, update, remove, test };
