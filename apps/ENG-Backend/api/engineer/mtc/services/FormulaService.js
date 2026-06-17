'use strict';

const { Parser } = require('expr-eval');
const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

class FormulaServiceV2 {
  // Dedupe window for the formula error-log DB writes (see logErrorToDb)
  static ERROR_LOG_TTL_MS = 10 * 60 * 1000;

  constructor() {
    this.parser = new Parser();
    this._registerFunctions();
    this._errorLogThrottle = new Map(); // root-cause key → last logged epoch ms
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

  // Evaluate an expression, distinguishing a real failure (a thrown error, or a
  // non-finite NaN/Infinity result from e.g. 0/0, sqrt(-1)) from a valid value.
  // Returns { value, error } — error is non-null only on failure. This replaces
  // the old silent `return null on error` so callers can log/surface what broke.
  _evalChecked(expr, context) {
    try {
      const value = this.parser.evaluate(this._preprocess(expr), context);
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return { value: null, error: `non-finite result (${value})` };
      }
      return { value, error: null };
    } catch (e) {
      return { value: null, error: e.message };
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
  async computeDimensions(machineId, toolingName, inputContext, meta = {}) {
    // Caller may pass pre-loaded formula rows (from tsv2ConfigCache) to avoid a
    // per-tooling DB round-trip; fall back to a direct query when absent.
    const rows = meta.formulaRows ?? (await engPool.query(
      `SELECT output_key, formula_expr, condition_expr
         FROM ${TSV2_TABLES.FORMULA}
        WHERE machine_id = $1 AND tooling_name = $2
        ORDER BY sort_order ASC, id ASC`,
      [machineId, toolingName]
    )).rows;

    // Seed context: A–Z = 0 + all spec inputs
    const context = {};
    for (const ch of ALPHA) context[ch] = 0;
    Object.assign(context, inputContext);

    const defined  = new Set(); // tracks which output_keys are already resolved
    const warnings = [];        // formula/condition evaluation failures (was silent)

    // Audit a failed evaluation: keep a structured record AND log a greppable line
    // so "why wasn't this tool selected?" is traceable instead of a silent null.
    // Warning shape keeps the original `expr`/`error` keys — searchService reads
    // w.error/w.phase when merging into the /search response warnings[].
    const note = (phase, key, expr, error) => {
      const errorData = {
        cn: meta.cn ?? null,
        machine_id: machineId,
        tooling_name: toolingName,
        output_key: key,
        phase,
        expr,
        error,
        user_empno: meta.user_empno ?? null,
      };
      warnings.push(errorData);
      console.warn(
        `[formula] FAILED cn=${meta.cn ?? '?'} machine=${machineId} tooling=${JSON.stringify(toolingName)} ` +
        `key=${key} ${phase} expr=${JSON.stringify(expr)} → ${error}`
      );

      // Persist to DB for Admin monitoring (Fire and forget)
      this.logErrorToDb(errorData).catch(err => console.error('[formula] DB logging failed:', err.message));
    };

    for (const row of rows) {
      // Skip if another row already resolved this key
      if (defined.has(row.output_key)) continue;

      // Evaluate condition if present — skip row when condition is falsy, but
      // distinguish a real evaluation error (logged) from a legitimate false.
      if (row.condition_expr?.trim()) {
        const cond = this._evalChecked(row.condition_expr, context);
        if (cond.error) { note('condition', row.output_key, row.condition_expr, cond.error); continue; }
        if (!cond.value) continue;
      }

      const out = this._evalChecked(row.formula_expr, context);
      if (out.error) { note('formula', row.output_key, row.formula_expr, out.error); continue; }
      context[row.output_key] = out.value;
      defined.add(row.output_key);
    }

    const result = {};
    for (const key of defined) result[key] = context[key];
    // Attach failures non-enumerably (only when present) so callers/tests that
    // iterate or compare the A–Z dims map are unaffected, while searchService can
    // surface them in the /search response.
    if (warnings.length) Object.defineProperty(result, '_warnings', { value: warnings, enumerable: false });
    return result;
  }

  /**
   * Log formula evaluation error to database (fire-and-forget from note()).
   *
   * Flood guard: the coverage report re-searches ~800 CNs every rebuild, so one
   * systematically broken formula row would otherwise insert thousands of
   * identical rows per hour. Dedupe on the ROOT CAUSE (machine+tooling+key+
   * phase+error — not CN) with a 10-min TTL: each distinct failure is recorded
   * at most once per window (first occurrence keeps its cn for context).
   */
  async logErrorToDb(data) {
    const { cn, machine_id, tooling_name, output_key, phase, expr, error, user_empno } = data;

    const throttleKey = `${machine_id}|${tooling_name}|${output_key}|${phase}|${error}`;
    const now = Date.now();
    const last = this._errorLogThrottle.get(throttleKey);
    if (last && now - last < FormulaServiceV2.ERROR_LOG_TTL_MS) return;
    this._errorLogThrottle.set(throttleKey, now);
    // Occasional sweep so the map can't grow unbounded
    if (this._errorLogThrottle.size > 500) {
      for (const [k, t] of this._errorLogThrottle) {
        if (now - t >= FormulaServiceV2.ERROR_LOG_TTL_MS) this._errorLogThrottle.delete(k);
      }
    }

    const sql = `
      INSERT INTO ${TSV2_TABLES.FORMULA_ERROR_LOG}
      (cn, machine_id, tooling_name, output_key, phase, expression, error_message, user_empno)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await engPool.query(sql, [cn, machine_id, tooling_name, output_key, phase, expr, error, user_empno]);
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
