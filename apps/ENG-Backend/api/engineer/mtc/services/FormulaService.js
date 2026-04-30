'use strict';

const { Parser } = require('expr-eval');
const { engPool } = require('../../../../instance/eng_db');

/**
 * FormulaService handles dynamic calculation of tooling parameters
 * using formulas stored in the database.
 */
class FormulaService {
  constructor() {
    this.parser = new Parser();

    // 1. Custom helper functions
    this.parser.functions.round05 = (x) => Math.round(x * 2) / 2;
    this.parser.functions.ceil05  = (x) => Math.ceil(x * 2) / 2;
    this.parser.functions.floor05 = (x) => Math.floor(x * 2) / 2;

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

    // --- NEW: Table Lookup Helper ---
    // lookup(val, v1, v2, v3...) returns the first item in the list >= val
    // Example: lookup(15, 10, 20, 30) => 20
    this.parser.functions.lookup = (val, ...args) => {
      const sorted = args.sort((a, b) => a - b);
      return sorted.find(v => v >= val) ?? args[args.length - 1];
    };
  }

  /**
   * Pre-process formula string to handle common Engineer/JS-style quirks
   */
  _preprocess(formula) {
    if (!formula) return '';
    let f = String(formula).trim();

    // 1. Convert Excel-style "func(v1, v2...)" to lookup(func, v1, v2...)
    // ONLY if there's at least one comma (indicating a list, not arithmetic)
    const lookupRegex = /\b([a-zA-Z0-9_]+)\s*\(([^)]+,[^)]+)\)/g;
    f = f.replace(lookupRegex, (match, varName, list) => {
      const dims = ['W_max', 'odAft', 'idAft', 'T1', 'odBf', 'A', 'B', 'C', 'baseC'];
      if (dims.includes(varName)) return `lookup(${varName}, ${list})`;
      return match;
    });

    // 2. JS Equality and Logic to Engine standard
    f = f.replace(/===/g, ' == ')
         .replace(/!==/g, ' != ')
         .replace(/&&/g, ' and ')
         .replace(/\|\|/g, ' or ');

    // 2. Auto-quote common enum values if they appear unquoted
    // This handles cases like: type == NORMAL
    // Removed 'B' from here because it's a common numeric dimension
    const keywords = ['NORMAL', 'ABR', 'BALL_INNER', 'OD→ID', 'ID→OD', 'Y', 'N'];
    keywords.forEach(k => {
      // Matches unquoted enum value not preceded by a quote or dot
      const regex = new RegExp(`(?<!['".])\\b${k}\\b(?!['"])`, 'g');
      f = f.replace(regex, `"${k}"`);
    });

    // 3. Smart Field Mapping: If keyword appears without "type ==" or similar
    // Also include 'B' here for specific comparison contexts
    const smartKeys = [...keywords, 'B'];
    smartKeys.forEach(k => {
      const regex = new RegExp(`^"${k}"\\s*(\\?|:)`, 'i');
      const regexRaw = new RegExp(`^${k}\\s*(\\?|:)`, 'i'); // for 'B' which isn't quoted yet
      
      if (regex.test(f) || regexRaw.test(f)) {
        let field = 'type';
        if (['Y', 'N', 'B'].includes(k)) field = 'yBall';
        if (k.includes('→')) field = 'process';
        
        if (regex.test(f)) f = f.replace(regex, `${field} == "${k}" $1`);
        else f = f.replace(regexRaw, `${field} == "${k}" $1`);
      }
    });

    return f;
  }

  /**
   * Evaluate a potentially multi-statement formula
   */
  _evaluateMulti(formula, context, silent = false) {
    // 1. Handle "null" in formula
    let rawFormula = String(formula).replace(/\bnull\b/g, '0');
    
    // 2. Resolve namespaced variables like fp_A -> context.fp.A
    for (const key in context) {
      if (typeof context[key] === 'object' && context[key] !== null) {
        for (const subKey in context[key]) {
          const namespaced = `${key}_${subKey}`;
          rawFormula = rawFormula.replace(new RegExp(`\\b${namespaced}\\b`, 'g'), context[key][subKey]);
        }
      }
    }
    
    const parts = rawFormula.split(';');
    // IMPORTANT: Use the enriched context directly
    let currentContext = { ...context }; 
    let lastValue = 0;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      try {
        const assignMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
        if (assignMatch) {
          const varName = assignMatch[1];
          const exprStr = assignMatch[2];
          const processed = this._preprocess(exprStr);
          const expr = this.parser.parse(processed);
          const val = expr.evaluate(currentContext);
          currentContext[varName] = isNaN(val) ? 0 : val;
          lastValue = currentContext[varName];
        } else {
          const processed = this._preprocess(trimmed);
          const expr = this.parser.parse(processed);
          const val = expr.evaluate(currentContext);
          lastValue = isNaN(val) ? 0 : val;
        }
      } catch (e) {
        if (!silent) console.error('Inner Eval Error:', e.message, 'in', trimmed);
        throw e;
      }
    }
    return lastValue;
  }

  /**
   * Enrich context with derived variables and standard aliases
   */
  _enrichContext(base) {
    const ctx = { ...base };
    
    // 1. Math Constants
    ctx.PI = Math.PI;
    ctx.E  = Math.E;

    // 2. Core Dimension Aliases & Math (Aft)
    const odAft = parseFloat(base.odAft || 0);
    const odAftP = parseFloat(base.odAftTolPlus || 0);
    const odAftM = parseFloat(base.odAftTolMinus || 0);
    ctx.odAft_max = odAft + odAftP;
    ctx.odAft_min = odAft + odAftM;

    const idAft = parseFloat(base.idAft || 0);
    const idAftP = parseFloat(base.idTolPlus || base.idAftTolPlus || 0);
    const idAftM = parseFloat(base.idTolMinus || base.idAftTolMinus || 0);
    ctx.idAft_max = idAft + idAftP;
    ctx.idAft_min = idAft + idAftM;
    ctx.idTolPlus = idAftP; // Ensure both names exist
    ctx.idAftTolPlus = idAftP;

    const wAft = parseFloat(base.wAft || 0);
    const wAftP = parseFloat(base.wAftTolPlus || 0);
    const wAftM = parseFloat(base.wAftTolMinus || 0);
    ctx.wAft_max = wAft + wAftP;
    ctx.wAft_min = wAft + wAftM;
    ctx.W_max = ctx.wAft_max; // Alias
    ctx.T1 = wAft;            // Alias (Common in tooling)

    // 3. Before (Bf) Dimensions
    const odBf = parseFloat(base.odBf || 0);
    const odBfP = parseFloat(base.odBfTolPlus || 0);
    const odBfM = parseFloat(base.odBfTolMinus || 0);
    ctx.odBf_max = odBf + odBfP;
    ctx.odBf_min = odBf + odBfM;

    // 4. Smart Logic Flags & String Props
    ctx.isIDtoOD = (base.process === 'ID→OD' || base.isIDtoOD) ? 1 : 0;
    ctx.isYBall  = (base.yBall === 'Y' || base.isYBall) ? 1 : 0;
    ctx.isABR    = (base.type?.includes('ABR') || base.yBall === 'Y' || base.yBall === 'B') ? 1 : 0;

    // 4b. SD — equivalent of calculationLogic.calculateSD(part)
    const _sdRaw = ctx.isYBall ? parseFloat(base.sd || 0) : parseFloat(base.sdAft || 0);
    ctx.sdCalc = (_sdRaw > 0) ? _sdRaw : 0;
    ctx.SD     = ctx.sdCalc;  // alias matching old JS variable name

    // --- String Aliases & Offset ---
    ctx.Dwg     = base.parts_no || base.dwg_no || 'Check Dwg';
    ctx.Type    = base.type    || 'NORMAL';
    ctx.Process = base.process || 'OD→ID';
    ctx.YBall   = base.yBall   || 'N';
    
    // Check for various possible keys for Offset
    ctx.Offset  = parseFloat(base.offset || base.Offset || base.OFFSET || 0);
    ctx.Tol_P   = parseFloat(base.tol_plus || base.Tol_P || 0);
    ctx.Tol_M   = parseFloat(base.tol_minus || base.Tol_M || 0);


    // 5. Tooling Standard Default Aliases (If not already defined)
    const jawA = ctx.isIDtoOD ? odBf : odAft;
    if (ctx.A === undefined) ctx.A = jawA;
    if (ctx.B === undefined) ctx.B = jawA - 0.4;
    
    // 6. Final Wrap
    ctx.part = { ...ctx };
    return ctx;
  }

  /**
   * Calculate parameters for a machine using tooling_formula table.
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

      const ctx = this._enrichContext(context);
      const output = { _raw: context };
      let hasFormulaError = false;

      for (const { tooling_name, parameter_name, formula_value, formula_type, rounding_rule, rounding_precision } of formulas) {
        if (formula_type === 'limit' || !formula_value) continue;

        try {
          let value = this._evaluateMulti(formula_value, ctx);

          if (value != null && typeof value === 'number' && rounding_rule && rounding_rule !== 'none') {
            const prec = rounding_precision ?? 2;
            const factor = Math.pow(10, prec);
            if (rounding_rule === 'ceil')  value = Math.ceil(value  * factor) / factor;
            else if (rounding_rule === 'floor') value = Math.floor(value * factor) / factor;
            else if (rounding_rule === 'round') value = Math.round(value * factor) / factor;
          }

          const pName = String(parameter_name || '').trim();
          ctx[pName] = value;

          if (!output[tooling_name]) output[tooling_name] = {};
          output[tooling_name][pName] = value;
        } catch (evalErr) {
          console.error(`Formula error ${machineName}.${tooling_name}.${parameter_name}:`, evalErr.message);
          ctx[parameter_name] = 0;
          hasFormulaError = true;
        }
      }

      if (hasFormulaError) return { ...output, _error: 'Some formulas failed' };
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
      if (!formula) return { valid: true, result: null };
      const enriched = this._enrichContext(testContext);
      const val = this._evaluateMulti(formula, enriched, true);
      return { valid: true, result: val };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

module.exports = new FormulaService();
