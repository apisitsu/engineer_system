'use strict';

const { Parser } = require('expr-eval');
const { engPool } = require('../../../../instance/eng_db');

/**
 * FormulaService handles dynamic calculation of tooling parameters
 * using formulas stored in the database.
 */
class FormulaService {
  constructor() {
    this.parser = new Parser({
      operators: {
        // Custom operators or settings can be added here
        add: true, concatenate: true, conditional: true,
        divide: true, factorial: true, multiply: true,
        power: true, remainder: true, subtract: true,
        logical: true, comparison: true, in: true,
      }
    });

    // Add standard Excel/JS math functions to the parser
    this.parser.functions.ceil = (x) => Math.ceil(x);
    this.parser.functions.floor = (x) => Math.floor(x);
    this.parser.functions.round = (x) => Math.round(x);
    this.parser.functions.sqrt = (x) => Math.sqrt(x);
    this.parser.functions.abs = (x) => Math.abs(x);
    this.parser.functions.max = Math.max;
    this.parser.functions.min = Math.min;
  }

  /**
   * Calculate all parameters for a specific machine based on part data
   * @param {string} machineName - Name of the machine (e.g., 'KS400B')
   * @param {Object} context - Part spec data (e.g., { odBf: 20, wAft: 15, ... })
   * @returns {Object} Calculated results
   */
  async calculateMachineParams(machineName, context) {
    try {
      // 1. Fetch formulas for this machine from DB
      const query = `
        SELECT tool_category, param_key, formula 
        FROM mtc_formulas 
        WHERE machine_name = $1 AND is_active = true
        ORDER BY id ASC
      `;
      const res = await engPool.query(query, [machineName]);
      const formulas = res.rows;

      if (formulas.length === 0) {
        return { error: `No formulas found for machine: ${machineName}` };
      }

      // 2. Initialize results with context (part specs)
      const results = { ...context };
      
      // Separate results by category for the final output
      const categorizedOutput = {
        _raw: results // Keep original context in a raw field
      };

      // 3. Process each formula
      let hasFormulaError = false;
      for (const item of formulas) {
        const { tool_category, param_key, formula } = item;

        try {
          // Parse and evaluate formula using the current context (results)
          const expr = this.parser.parse(formula);
          const value = expr.evaluate(results);

          // Update context so subsequent formulas can use this result
          results[param_key] = value;

          // Organize output by category
          if (tool_category && tool_category !== '-') {
            if (!categorizedOutput[tool_category]) categorizedOutput[tool_category] = {};
            categorizedOutput[tool_category][param_key] = value;
          } else {
            // Global machine parameters (like limits)
            categorizedOutput[param_key] = value;
          }
        } catch (evalErr) {
          console.error(`Error evaluating formula for ${machineName}.${param_key}:`, evalErr.message);
          hasFormulaError = true;
        }
      }

      if (hasFormulaError) {
        return { error: `Formula evaluation failed for machine: ${machineName}` };
      }

      return categorizedOutput;
    } catch (err) {
      console.error('FormulaService calculation error:', err.message);
      return { error: 'Calculation Engine Error' };
    }
  }

  /**
   * Admin: Validate a formula without saving
   */
  validateFormula(formula, testContext = {}) {
    try {
      const expr = this.parser.parse(formula);
      const result = expr.evaluate(testContext);
      return { valid: true, result };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

module.exports = new FormulaService();
