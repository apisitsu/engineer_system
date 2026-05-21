'use strict';

const { Parser } = require('expr-eval');
const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

class FormulaServiceV2 {
  constructor() {
    this.parser = new Parser();
    this._registerFunctions();
  }

  _registerFunctions() {
    const p = this.parser;

    // ── Rounding ────────────────────────────────────────────────────────────
    p.functions.round05 = (x) => Math.round(x * 2) / 2;
    p.functions.ceil05  = (x) => Math.ceil(x * 2) / 2;
    p.functions.floor05 = (x) => Math.floor(x * 2) / 2;

    // roundN / ceilN / floorN — expr-eval treats built-in round/ceil/floor as unary,
    // so _preprocess rewrites round(x,n) → roundN(x,n) before the parser sees it.
    p.functions.roundN = (x, n) => {
      if (n == null) return Math.round(x);
      if (n <= 1) { const f = Math.pow(10, n); return Math.round(x * f) / f; }
      return parseFloat(x.toFixed(n));
    };
    p.functions.ceilN  = (x, n) => {
      if (n == null) return Math.ceil(x);
      const f = Math.pow(10, n); return Math.ceil(x * f) / f;
    };
    p.functions.floorN = (x, n) => {
      if (n == null) return Math.floor(x);
      const f = Math.pow(10, n); return Math.floor(x * f) / f;
    };
    p.functions.ceil  = (x) => Math.ceil(x);
    p.functions.floor = (x) => Math.floor(x);
    p.functions.round = (x) => Math.round(x);

    // ── Math ────────────────────────────────────────────────────────────────
    p.functions.sqrt = (x) => Math.sqrt(x);
    p.functions.abs  = (x) => Math.abs(x);
    p.functions.max  = Math.max;
    p.functions.min  = Math.min;

    // ── Conditional ─────────────────────────────────────────────────────────
    // if(condition, trueValue, falseValue)
    // e.g.  if(isBallInner, 18.5 + W - 2, 18.5 + W/2 + 3)
    p.functions.if = (cond, trueVal, falseVal) => (cond ? trueVal : falseVal);

    // ── Table lookup ─────────────────────────────────────────────────────────
    // lookup(val, v1, v2, …) → first item in list >= val
    p.functions.lookup = (val, ...args) => {
      const sorted = [...args].sort((a, b) => a - b);
      return sorted.find(v => v >= val) ?? args[args.length - 1];
    };
  }

  // Rewrite round(x,n) → roundN(x,n) before expr-eval sees it
  _preprocess(expr) {
    return expr
      .replace(/\bround\s*\(/g, 'roundN(')
      .replace(/\bceil\s*\(/g, 'ceilN(')
      .replace(/\bfloor\s*\(/g, 'floorN(');
  }

  // Safely evaluate an expression; returns null on error
  _eval(expr, context) {
    try {
      return this.parser.evaluate(this._preprocess(expr), context);
    } catch {
      return null;
    }
  }

  /**
   * Evaluate all formula rows for (machineId, toolingName) given input context.
   *
   * Condition column logic:
   *   - Rows are processed in sort_order ASC order.
   *   - If a row has condition_expr, it is evaluated first.
   *     If the condition is falsy, the row is SKIPPED.
   *   - For each output_key, only the FIRST matching (passing) row is applied;
   *     subsequent rows with the same output_key are skipped.
   *   - Rows without condition_expr always run (unless a prior row already set the key).
   *
   * Example:
   *   sort=0  output_key=C  condition="isBallInner"  formula="ceil05(18.5 + W - 2)"
   *   sort=10 output_key=C  condition=""(none)        formula="ceil05(18.5 + W/2 + 3)"
   *   → When isBallInner=1: row 0 matches, row 10 is skipped.
   *   → When isBallInner=0: row 0 fails condition, row 10 applies.
   */
  async computeDimensions(machineId, toolingName, inputContext) {
    const { rows } = await engPool.query(
      `SELECT output_key, formula_expr, condition_expr
         FROM ${TSV2_TABLES.FORMULA}
        WHERE machine_id = $1 AND tooling_name = $2
        ORDER BY sort_order ASC, id ASC`,
      [machineId, toolingName]
    );

    // Seed context: A–Z = 0 + all spec inputs
    const context = {};
    for (const ch of ALPHA) context[ch] = 0;
    Object.assign(context, inputContext);

    const defined = new Set(); // tracks which output_keys are already resolved

    for (const row of rows) {
      // Skip if another row already resolved this key
      if (defined.has(row.output_key)) continue;

      // Evaluate condition if present — skip row when condition fails
      if (row.condition_expr?.trim()) {
        const condResult = this._eval(row.condition_expr, context);
        if (!condResult) continue;
      }

      const val = this._eval(row.formula_expr, context);
      if (val !== null) {
        context[row.output_key] = val;
        defined.add(row.output_key);
      }
    }

    const result = {};
    for (const key of defined) result[key] = context[key];
    return result;
  }

  /**
   * Test a formula string against an ad-hoc context (no DB lookup).
   */
  testExpression(expr, context = {}) {
    const ctx = {};
    for (const ch of ALPHA) ctx[ch] = 0;
    Object.assign(ctx, context);
    return this.parser.evaluate(this._preprocess(expr), ctx);
  }
}

module.exports = new FormulaServiceV2();
