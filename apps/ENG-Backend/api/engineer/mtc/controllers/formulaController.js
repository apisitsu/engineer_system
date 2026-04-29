'use strict';

const FormulaService = require('../services/FormulaService');
const { engPool } = require('../../../../instance/eng_db');

/**
 * Controller for managing MTC Calculation Formulas
 */

// GET /api/mtc/formulas  (distinct machine names)
const getMachineNames = async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT DISTINCT machine_name FROM mtc_formulas WHERE is_active = true ORDER BY machine_name ASC`
    );
    res.json({ success: true, machines: result.rows.map(r => r.machine_name) });
  } catch (err) {
    console.error('getMachineNames error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// GET /api/mtc/formulas/:machineName?tooling_type=
const getFormulasByMachine = async (req, res) => {
  try {
    const { machineName } = req.params;
    const { tooling_type } = req.query;
    const needle = tooling_type?.trim();

    let result;
    if (needle) {
      // Match rows where needle contains the formula's category/tooling_type as substring.
      // Direction: $2 ILIKE '%' || col || '%'  (needle contains col, not col contains needle)
      // This handles inventory names that are more specific than formula categories,
      // e.g. needle='WORK DRIVER TYPE-A' matches tool_category='WORK DRIVER'.
      // Also handles CALC_COMMON: needle='KS-B22G' matches tooling_type='KS-B22G'.
      try {
        result = await engPool.query(
          `SELECT * FROM mtc_formulas WHERE machine_name = $1 AND is_active = true
           AND $2 ILIKE '%' || COALESCE(tooling_type, tool_category) || '%' ORDER BY id ASC`,
          [machineName, needle]
        );
      } catch (colErr) {
        if (colErr.code === '42703') {
          result = await engPool.query(
            `SELECT * FROM mtc_formulas WHERE machine_name = $1 AND is_active = true
             AND $2 ILIKE '%' || tool_category || '%' ORDER BY id ASC`,
            [machineName, needle]
          );
        } else {
          throw colErr;
        }
      }
    } else {
      result = await engPool.query(
        `SELECT * FROM mtc_formulas WHERE machine_name = $1 AND is_active = true ORDER BY id ASC`,
        [machineName]
      );
    }

    res.json({ success: true, formulas: result.rows });
  } catch (err) {
    console.error('getFormulasByMachine error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/mtc/formulas
const createFormula = async (req, res) => {
  try {
    const { machine_name, tool_category, tooling_type, param_key, formula, description } = req.body;

    const validation = FormulaService.validateFormula(formula);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: 'Invalid formula syntax: ' + validation.error });
    }

    const query = `
      INSERT INTO mtc_formulas (machine_name, tool_category, tooling_type, param_key, formula, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (machine_name, tool_category, param_key)
      DO UPDATE SET formula = EXCLUDED.formula, description = EXCLUDED.description,
                    tooling_type = EXCLUDED.tooling_type, updated_at = NOW()
      RETURNING *
    `;
    const ttVal = tooling_type || tool_category || null;
    const result = await engPool.query(query, [machine_name, tool_category, ttVal, param_key, formula, description]);
    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    console.error('createFormula error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/mtc/formulas/test
const testFormula = async (req, res) => {
  try {
    const { formula, context } = req.body;
    const result = FormulaService.validateFormula(formula, context || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/mtc/formulas/:id
const updateFormula = async (req, res) => {
  try {
    const { id } = req.params;
    const { tool_category, tooling_type, param_key, formula, description } = req.body;

    if (formula) {
      const validation = FormulaService.validateFormula(formula);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: 'Invalid formula syntax: ' + validation.error });
      }
    }

    const query = `
      UPDATE mtc_formulas
      SET tool_category = COALESCE($1, tool_category),
          tooling_type  = COALESCE($2, tooling_type),
          param_key     = COALESCE($3, param_key),
          formula       = COALESCE($4, formula),
          description   = COALESCE($5, description),
          updated_at    = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await engPool.query(query, [tool_category, tooling_type, param_key, formula, description, id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Formula not found' });
    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    console.error('updateFormula error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// DELETE /api/mtc/formulas/:id
const deleteFormula = async (req, res) => {
  try {
    const { id } = req.params;
    await engPool.query('UPDATE mtc_formulas SET is_active = false WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = {
  getMachineNames,
  getFormulasByMachine,
  createFormula,
  updateFormula,
  testFormula,
  deleteFormula
};
