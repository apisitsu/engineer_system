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
    this.parser.functions.ceil = (x, n) => {
      if (n === undefined || n === null) return Math.ceil(x);
      const f = Math.pow(10, n); return Math.ceil(x * f) / f;
    };
    this.parser.functions.floor = (x, n) => {
      if (n === undefined || n === null) return Math.floor(x);
      const f = Math.pow(10, n); return Math.floor(x * f) / f;
    };
    this.parser.functions.round = (x, n) => {
      if (n === undefined || n === null) return Math.round(x);
      const f = Math.pow(10, n); return Math.round(x * f) / f;
    };
    this.parser.functions.sqrt = (x) => Math.sqrt(x);
    this.parser.functions.abs = (x) => Math.abs(x);
    this.parser.functions.max = Math.max;
    this.parser.functions.min = Math.min;
  }

  /**
   * Calculate parameters for a machine using tooling_formula table.
   * Formulas are evaluated sequentially with a shared flat context so
   * later formulas can reference results of earlier ones by parameter_name.
   * Output is grouped by tooling_name: { 'JAW': { A, B }, 'BACK PLATE': { A, B }, ... }
   */
  async calculateMachineParams(machineName, context) {
    try {
      const res = await engPool.query(
        `SELECT tooling_name, parameter_name, formula_value, formula_type,
                rounding_rule, rounding_precision
         FROM tooling_formula WHERE machine_name = $1 ORDER BY id ASC`,
        [machineName]
      );
      const formulas = res.rows;

      if (formulas.length === 0) {
        return { error: `No formulas found for machine: ${machineName}` };
      }

      const ctx = { ...context };
      const output = { _raw: context };
      let hasFormulaError = false;

      for (const { tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision } of formulas) {
        if (formula_type === 'limit') continue;

        try {
          const expr = this.parser.parse(formula_value);
          let value = expr.evaluate(ctx);

          if (value != null && typeof value === 'number' && rounding_rule && rounding_rule !== 'none') {
            const prec = rounding_precision ?? 2;
            const factor = Math.pow(10, prec);
            if (rounding_rule === 'ceil')  value = Math.ceil(value  * factor) / factor;
            else if (rounding_rule === 'floor') value = Math.floor(value * factor) / factor;
            else if (rounding_rule === 'round') value = Math.round(value * factor) / factor;
          }

          ctx[parameter_name] = value;

          if (!output[tooling_name]) output[tooling_name] = {};
          output[tooling_name][parameter_name] = value;
        } catch (evalErr) {
          console.error(`Formula error ${machineName}.${tooling_name}.${parameter_name}:`, evalErr.message);
          hasFormulaError = true;
        }
      }

      if (hasFormulaError) return { error: `Formula evaluation failed for machine: ${machineName}` };
      return output;
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
