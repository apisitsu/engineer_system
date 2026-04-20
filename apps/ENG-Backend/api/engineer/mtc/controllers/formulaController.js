'use strict';

const FormulaService = require('../services/FormulaService');
const { engPool } = require('../../../../instance/eng_db');

/**
 * Controller for managing MTC Calculation Formulas
 */

// GET /api/mtc/formulas/:machineName
const getFormulasByMachine = async (req, res) => {
  try {
    const { machineName } = req.params;
    const query = `SELECT * FROM mtc_formulas WHERE machine_name = $1 AND is_active = true ORDER BY id ASC`;
    const result = await engPool.query(query, [machineName]);
    res.json({ success: true, formulas: result.rows });
  } catch (err) {
    console.error('getFormulasByMachine error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// POST /api/mtc/formulas
const createFormula = async (req, res) => {
  try {
    const { machine_name, tool_category, param_key, formula, description } = req.body;
    
    // 1. Validate syntax
    const validation = FormulaService.validateFormula(formula);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: 'Invalid formula syntax: ' + validation.error });
    }

    // 2. Save to DB
    const query = `
      INSERT INTO mtc_formulas (machine_name, tool_category, param_key, formula, description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (machine_name, tool_category, param_key) 
      DO UPDATE SET formula = EXCLUDED.formula, description = EXCLUDED.description, updated_at = NOW()
      RETURNING *
    `;
    const result = await engPool.query(query, [machine_name, tool_category, param_key, formula, description]);
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
  getFormulasByMachine,
  createFormula,
  testFormula,
  deleteFormula
};
