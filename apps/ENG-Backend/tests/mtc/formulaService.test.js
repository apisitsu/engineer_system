'use strict';

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));

const { engPool } = require('../../instance/eng_db');
const FormulaService = require('../../api/engineer/mtc/services/FormulaService');

afterEach(() => jest.clearAllMocks());

// ── testExpression (ad-hoc evaluation, no DB) ─────────────────────────────────
// V2 replacement for the retired V1 `validateFormula`. Returns the raw value and
// THROWS on a parse error (there is no { valid, result } wrapper).

describe('FormulaService.testExpression', () => {
  it('evaluates a valid constant formula', () => {
    expect(FormulaService.testExpression('2 + 2')).toBe(4);
  });

  it('evaluates a formula using context variables', () => {
    expect(FormulaService.testExpression('OD / 2', { OD: 30 })).toBe(15);
  });

  it('seeds unset A–Z labels to 0', () => {
    // No context for A → defaults to 0, so A + 5 === 5
    expect(FormulaService.testExpression('A + 5')).toBe(5);
  });

  it('throws on bad syntax', () => {
    expect(() => FormulaService.testExpression('???')).toThrow();
  });

  it('rewrites ceil(x) to unary ceilN via _preprocess', () => {
    expect(FormulaService.testExpression('ceil(1.2)')).toBe(2);
  });

  it('rewrites floor(x) to unary floorN via _preprocess', () => {
    expect(FormulaService.testExpression('floor(1.9)')).toBe(1);
  });

  it('rewrites round(x) to unary roundN via _preprocess', () => {
    expect(FormulaService.testExpression('round(1.5)')).toBe(2);
  });

  it('supports round(x, n) precision via roundN', () => {
    // round(1.15 * 10) / 10 → roundN(11.5)/10 → 12/10 → 1.2
    expect(FormulaService.testExpression('round(1.15 * 10) / 10')).toBeCloseTo(1.2, 5);
  });

  it('supports nearest-0.5 helpers round05 / ceil05 / floor05', () => {
    expect(FormulaService.testExpression('round05(1.3)')).toBe(1.5);
    expect(FormulaService.testExpression('ceil05(1.1)')).toBe(1.5);
    expect(FormulaService.testExpression('floor05(1.9)')).toBe(1.5);
  });

  it('supports sqrt, abs, max, min', () => {
    expect(FormulaService.testExpression('sqrt(9)')).toBe(3);
    expect(FormulaService.testExpression('abs(-5)')).toBe(5);
    expect(FormulaService.testExpression('max(3, 7)')).toBe(7);
    expect(FormulaService.testExpression('min(3, 7)')).toBe(3);
  });

  it('supports the if(cond, trueVal, falseVal) helper', () => {
    expect(FormulaService.testExpression('if(isBallInner, 18.5 + W - 2, 18.5 + W / 2 + 3)', { isBallInner: 1, W: 10 })).toBe(26.5);
    expect(FormulaService.testExpression('if(isBallInner, 18.5 + W - 2, 18.5 + W / 2 + 3)', { isBallInner: 0, W: 10 })).toBe(26.5);
  });

  it('supports lookup(val, ...) returning first item >= val', () => {
    expect(FormulaService.testExpression('lookup(5, 2, 4, 6, 8)')).toBe(6);
  });
});

// ── computeDimensions (DB-driven per tooling) ─────────────────────────────────
// V2 replacement for the retired V1 `calculateMachineParams`. Reads tooling_formula
// rows for one (machineId, toolingName), evaluates them in sort_order, and returns
// { output_key: value } for every resolved key.

describe('FormulaService.computeDimensions', () => {
  const mkRow = (output_key, formula_expr, condition_expr = null) => ({
    output_key, formula_expr, condition_expr,
  });

  it('queries tooling_formula with machineId and toolingName params', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });

    await FormulaService.computeDimensions(7, 'WORK DRIVER', { OD: 30 });

    expect(engPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = engPool.query.mock.calls[0];
    expect(sql).toMatch(/machine_id\s*=\s*\$1/i);
    expect(sql).toMatch(/tooling_name\s*=\s*\$2/i);
    expect(params).toEqual([7, 'WORK DRIVER']);
  });

  it('returns an empty object when no formula rows exist', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });
    const result = await FormulaService.computeDimensions(1, 'NONE', { OD: 30 });
    expect(result).toEqual({});
  });

  it('computes dimensions and exposes them by output_key', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        mkRow('A', 'OD / 2'),
        mkRow('B', 'A + 1'), // sequential: reads A from the shared context
      ],
    });

    const result = await FormulaService.computeDimensions(1, 'WORK DRIVER', { OD: 30 });

    expect(result.A).toBe(15);
    expect(result.B).toBe(16);
  });

  it('keeps only the FIRST resolved row per output_key', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        mkRow('A', '10'),
        mkRow('A', '99'), // duplicate key — must be ignored
      ],
    });

    const result = await FormulaService.computeDimensions(1, 'JAW', {});
    expect(result.A).toBe(10);
  });

  it('skips a row whose condition_expr is falsy and applies the fallback row', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        mkRow('C', '18.5 + W - 2', 'isBallInner'),     // condition false → skipped
        mkRow('C', '18.5 + W / 2 + 3', null),          // fallback → applied
      ],
    });

    const result = await FormulaService.computeDimensions(1, 'JAW', { W: 10, isBallInner: 0 });
    expect(result.C).toBe(26.5); // 18.5 + 5 + 3
  });

  it('applies the conditional row when its condition_expr is truthy', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        mkRow('C', '18.5 + W - 2', 'isBallInner'),     // condition true → applied
        mkRow('C', '18.5 + W / 2 + 3', null),
      ],
    });

    const result = await FormulaService.computeDimensions(1, 'JAW', { W: 10, isBallInner: 1 });
    expect(result.C).toBe(26.5); // 18.5 + 10 - 2
  });

  it('omits an output_key whose formula has invalid syntax', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        mkRow('A', 'OD / 2'),
        mkRow('B', '('), // parse error → _eval returns null → key not set
      ],
    });

    const result = await FormulaService.computeDimensions(1, 'TEST', { OD: 30 });
    expect(result.A).toBe(15);
    expect(result).not.toHaveProperty('B');
  });

  it('keeps a valid zero-valued result (0 is not treated as a failure)', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [mkRow('A', 'OD - 30')],
    });

    const result = await FormulaService.computeDimensions(1, 'TEST', { OD: 30 });
    expect(result.A).toBe(0);
  });

  it('propagates a DB error', async () => {
    engPool.query.mockRejectedValueOnce(new Error('DB down'));
    await expect(FormulaService.computeDimensions(1, 'TEST', {})).rejects.toThrow('DB down');
  });
});
