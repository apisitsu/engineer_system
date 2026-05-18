'use strict';

const { Parser } = require('expr-eval');
const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

/**
 * Keys produced by _enrichContext — single source of truth for the /rules/validate endpoint.
 * Keep in sync with _enrichContext() method below.
 */
const ENRICHED_CONTEXT_KEYS = new Set([
  'odAft', 'odAftTolPlus', 'odAftTolMinus',
  'idAft', 'idTolPlus', 'idAftTolPlus', 'idTolMinus', 'idAftTolMinus',
  'wAft', 'wAftTolPlus', 'wAftTolMinus',
  'odBf', 'odBfTolPlus', 'odBfTolMinus',
  'idBf', 'idBfTolPlus', 'idBfTolMinus',
  'odAft_max', 'odAft_min', 'idAft_max', 'idAft_min',
  'wAft_max', 'wAft_min', 'W_max', 'T1',
  'odBf_max', 'odBf_min', 'idBf_max', 'idBf_min',
  'isIDtoOD', 'isYBall', 'isABR', 'isBallInner', 'isInner', 'sdCalc', 'SD',
  'Dwg', 'Type', 'Process', 'YBall', 'Offset', 'Tol_P', 'Tol_M', 'PI', 'E',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
]);

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

    // expr-eval v2 treats round/ceil/floor as built-in UNARY functions —
    // overriding .functions.round changes the implementation but not the parser
    // grammar, so round(x, n) fails with "Expected )".
    // Fix: _preprocess rewrites round( → roundN(  before the parser sees it.
    // These N-variants are pure custom functions → expr-eval accepts N args.
    this.parser.functions.roundN = (x, n) => {
      if (n === undefined || n === null) return Math.round(x);
      // n<=1: match legacy Math.round(x*10)/10 pattern (multiply before rounding)
      // n>=2: match legacy parseFloat(x.toFixed(n)) pattern
      if (n <= 1) { const f = Math.pow(10, n); return Math.round(x * f) / f; }
      return parseFloat(x.toFixed(n));
    };
    // roundStr: always uses parseFloat(x.toFixed(n)) — for formulas that match legacy toFixed behavior at n=1
    this.parser.functions.roundStr = (x, n) => {
      if (n === undefined || n === null) return Math.round(x);
      return parseFloat(x.toFixed(n));
    };
    this.parser.functions.ceilN = (x, n) => {
      if (n === undefined || n === null) return Math.ceil(x);
      const f = Math.pow(10, n); return Math.ceil(x * f) / f;
    };
    this.parser.functions.floorN = (x, n) => {
      if (n === undefined || n === null) return Math.floor(x);
      const f = Math.pow(10, n); return Math.floor(x * f) / f;
    };
    // Keep single-arg overrides for backward compat with any formula not rewritten
    this.parser.functions.ceil  = (x) => Math.ceil(x);
    this.parser.functions.floor = (x) => Math.floor(x);
    this.parser.functions.round = (x) => Math.round(x);
    
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

    // 0a. Rewrite round/ceil/floor to N-variants BEFORE any other processing.
    // expr-eval v2 parses these as built-in unary operators — the parser grammar
    // rejects a second argument even when parser.functions.round is overridden.
    // roundN/ceilN/floorN are pure custom functions that accept (x, n).
    f = f.replace(/\bround\s*\(/g, 'roundN(')
         .replace(/\bceil\s*\(/g,  'ceilN(')
         .replace(/\bfloor\s*\(/g, 'floorN(');

    // 0. Normalize arrow variants to ASCII -> (handles → and => used interchangeably in DB)
    f = f.replace(/→/g, '->');
    f = f.replace(/=>/g, '->');

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
    // 'Y' and 'N' intentionally excluded: they alias to ctx.Y/ctx.N (A–Z defaults = 0).
    // Auto-quoting them silently converts dimension variable usage to string literals → result 0.
    const keywords = ['NORMAL', 'ABR', 'BALL_INNER', 'OD->ID', 'ID->OD'];
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
        if (k.includes('->')) field = 'process';
        
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
        const assignMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*=(?!=)\s*(.*)$/);
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
    // id_aft_min in spec can store large positive non-tolerance values for ID-grind parts;
    // minus tolerance must be ≤ 0, so cap it to avoid corrupting idAft_min context.
    const idAftM = Math.min(0, parseFloat(base.idTolMinus || base.idAftTolMinus || 0));
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

    const idBf = parseFloat(base.idBf || 0);
    const idBfP = parseFloat(base.idBfTolPlus || 0);
    const idBfM = parseFloat(base.idBfTolMinus || 0);
    ctx.idBf_max = idBf + idBfP;
    ctx.idBf_min = idBf + idBfM;

    // 4. Smart Logic Flags & String Props
    ctx.isIDtoOD    = (base.process === 'ID->OD' || base.isIDtoOD) ? 1 : 0;
    ctx.isYBall     = (base.yBall === 'Y' || base.isYBall) ? 1 : 0;
    ctx.isABR       = (base.type?.includes('ABR') || base.yBall === 'Y' || base.yBall === 'B') ? 1 : 0;
    ctx.isBallInner = (base.type?.includes('ABR') || base.type?.includes('BALL_INNER')) ? 1 : 0;
    // isInner: used by KS400B6 formulas — matches adaptDynamicKS400B6 logic
    ctx.isInner     = (base.type?.toUpperCase().includes('INNER') || base.yBall === 'Y') ? 1 : 0;

    // 4b. SD — equivalent of calculationLogic.calculateSD(part)
    const _sdRaw = ctx.isYBall ? parseFloat(base.sd || 0) : parseFloat(base.sdAft || 0);
    ctx.sdCalc = (_sdRaw > 0) ? _sdRaw : 0;
    ctx.SD     = ctx.sdCalc;  // alias matching old JS variable name

    // --- String Aliases & Offset ---
    ctx.Dwg     = base.parts_no || base.dwg_no || 'Check Dwg';
    ctx.Type    = base.type    || 'NORMAL';
    ctx.Process = base.process || 'OD->ID';
    ctx.YBall   = base.yBall   || 'N';
    
    // Check for various possible keys for Offset
    ctx.Offset  = parseFloat(base.offset || base.Offset || base.OFFSET || 0);
    ctx.Tol_P   = parseFloat(base.tol_plus || base.Tol_P || 0);
    ctx.Tol_M   = parseFloat(base.tol_minus || base.Tol_M || 0);


    // 5. Tooling Standard Default Aliases (If not already defined)
    // A–Z default to 0; each machine defines its own params via tooling_formula rows.
    // KS-B22G / KS-B80 use hardcoded SQL (machineQueryService) — not this context.
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(k => {
      if (ctx[k] === undefined) ctx[k] = 0;
    });
    
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
         FROM ${TABLES.TOOLING_FORMULA} WHERE machine_name = $1 ORDER BY id ASC`,
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
            else if (rounding_rule === 'round') {
              // prec<=1: match legacy Math.round(x*10)/10; prec>=2: match legacy parseFloat(toFixed)
              value = prec <= 1 ? Math.round(value * factor) / factor : parseFloat(value.toFixed(prec));
            }
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

const instance = new FormulaService();
instance.ENRICHED_CONTEXT_KEYS = ENRICHED_CONTEXT_KEYS;
module.exports = instance;
