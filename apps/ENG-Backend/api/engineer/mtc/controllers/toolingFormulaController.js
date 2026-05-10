'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const FormulaService = require('../services/FormulaService');
const cache = require('../services/agents/CacheAgent');

// GET /api/mtc/tooling-formula/machines
const getMachines = async (req, res) => {
  try {
    const result = await engPool.query(
      `SELECT DISTINCT machine_name FROM ${TABLES.TOOLING_FORMULA} ORDER BY machine_name ASC`
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
        `SELECT * FROM ${TABLES.TOOLING_FORMULA}
         WHERE machine_name = $1 AND tooling_name = $2
         ORDER BY id ASC`,
        [machineName, tooling_name.trim()]
      );
    } else {
      result = await engPool.query(
        `SELECT * FROM ${TABLES.TOOLING_FORMULA} WHERE machine_name = $1 ORDER BY id ASC`,
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
      `INSERT INTO ${TABLES.TOOLING_FORMULA}
       (machine_name, tooling_name, parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [machine_name, tooling_name, parameter_name, formula_type || 'expression', formula_value, rounding_rule || 'none', rounding_precision ?? 2, remark || null]
    );

    cache.invalidatePrefix('tooling:');
    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    console.error('toolingFormula create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// PUT /api/mtc/tooling-formula/:id
const update = async (req, res) => {
  const { id } = req.params;
  const { parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark } = req.body;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT machine_name, parameter_name FROM ${TABLES.TOOLING_FORMULA} WHERE id = $1`,
      [id]
    );
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Formula not found' });
    }
    const { machine_name: machineName, parameter_name: oldParam } = current.rows[0];

    const result = await client.query(
      `UPDATE ${TABLES.TOOLING_FORMULA}
       SET parameter_name     = COALESCE($1, parameter_name),
           formula_type       = COALESCE($2, formula_type),
           formula_value      = COALESCE($3, formula_value),
           rounding_rule      = COALESCE($4, rounding_rule),
           rounding_precision = COALESCE($5, rounding_precision),
           remark             = $6,
           updated_at         = NOW()
       WHERE id = $7
       RETURNING *`,
      [parameter_name, formula_type, formula_value, rounding_rule, rounding_precision, remark, id]
    );

    const newParam = result.rows[0].parameter_name;

    // Cascade rename to selection rules dims when parameter_name changes
    if (parameter_name && oldParam !== newParam) {
      const normalizedMachine = machineName.toLowerCase().replace(/-/g, '');
      await client.query(
        `UPDATE ${TABLES.MTC_SELECTION_RULES}
         SET dims = (
           SELECT jsonb_agg(
             CASE WHEN elem->>'calc_key' = $1
                  THEN jsonb_set(elem, '{calc_key}', to_jsonb($2::text))
                  ELSE elem
             END
           )
           FROM jsonb_array_elements(dims) AS elem
         )
         WHERE is_active = true
           AND dims IS NOT NULL
           AND LOWER(REPLACE(COALESCE(calc_context, ''), '-', '')) = $3`,
        [oldParam, newParam, normalizedMachine]
      );
    }

    await client.query('COMMIT');
    cache.invalidatePrefix('tooling:');
    res.json({ success: true, formula: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('toolingFormula update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

// DELETE /api/mtc/tooling-formula/:id
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await engPool.query(`DELETE FROM ${TABLES.TOOLING_FORMULA} WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Formula not found' });
    cache.invalidatePrefix('tooling:');
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
