'use strict';

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));

const { engPool } = require('../../instance/eng_db');
const FormulaService = require('../../api/engineer/mtc/services/FormulaService');

// ── validateFormula (pure — no DB) ───────────────────────────────────────────

describe('FormulaService.validateFormula', () => {
  describe('valid formulas', () => {
    test('simple arithmetic', () => {
      const r = FormulaService.validateFormula('2 + 3');
      expect(r.valid).toBe(true);
      expect(r.result).toBe(5);
    });

    test('formula with variable from context', () => {
      const r = FormulaService.validateFormula('od * 2', { od: 10 });
      expect(r.valid).toBe(true);
      expect(r.result).toBe(20);
    });

    test('ceil with 2 args (custom overload)', () => {
      const r = FormulaService.validateFormula('ceil(10.123, 1)', {});
      expect(r.valid).toBe(true);
      expect(r.result).toBeCloseTo(10.2);
    });

    test('floor with 2 args (custom overload)', () => {
      const r = FormulaService.validateFormula('floor(10.789, 1)', {});
      expect(r.valid).toBe(true);
      expect(r.result).toBeCloseTo(10.7);
    });

    test('round with 2 args (custom overload)', () => {
      const r = FormulaService.validateFormula('round(10.567, 2)', {});
      expect(r.valid).toBe(true);
      expect(r.result).toBeCloseTo(10.57);
    });

    test('logical AND written as "and"', () => {
      const r = FormulaService.validateFormula('1 == 1 and 2 == 2', {});
      expect(r.valid).toBe(true);
      expect(r.result).toBeTruthy();
    });

    test('ternary conditional', () => {
      const r = FormulaService.validateFormula('od > 10 ? 1 : 0', { od: 15 });
      expect(r.valid).toBe(true);
      expect(r.result).toBe(1);
    });

    test('nested math functions', () => {
      const r = FormulaService.validateFormula('round(sqrt(od), 2)', { od: 2 });
      expect(r.valid).toBe(true);
      expect(r.result).toBeCloseTo(1.41);
    });
  });

  describe('invalid formulas', () => {
    test('syntax error returns valid: false', () => {
      const r = FormulaService.validateFormula('od ++ 2');
      expect(r.valid).toBe(false);
      expect(r.error).toBeDefined();
    });

    test('JavaScript && operator not supported', () => {
      const r = FormulaService.validateFormula('od > 0 && od < 100', { od: 50 });
      expect(r.valid).toBe(false);
    });

    test('empty formula string returns valid: false', () => {
      const r = FormulaService.validateFormula('');
      expect(r.valid).toBe(false);
    });
  });
});

// ── calculateMachineParams (DB-dependent) ─────────────────────────────────────

describe('FormulaService.calculateMachineParams', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns categorized results when formulas exist in DB', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        { tool_category: 'WHEEL', param_key: 'w_D', formula: 'od + 5' },
        { tool_category: 'WHEEL', param_key: 'w_T', formula: 'w_D * 0.3' },
      ],
    });

    const result = await FormulaService.calculateMachineParams('KS400B', { od: 20 });

    expect(result.WHEEL).toBeDefined();
    expect(result.WHEEL.w_D).toBe(25);
    expect(result.WHEEL.w_T).toBeCloseTo(7.5);
  });

  test('second formula can reference first formula result (chaining)', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        { tool_category: '-', param_key: 'base', formula: 'od * 2' },
        { tool_category: 'OUT', param_key: 'result', formula: 'base + 1' },
      ],
    });

    const r = await FormulaService.calculateMachineParams('TEST', { od: 10 });
    expect(r.OUT.result).toBe(21);
  });

  test('returns error object when no formulas found for machine', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await FormulaService.calculateMachineParams('UNKNOWN', {});

    expect(result.error).toMatch(/No formulas found/i);
  });

  test('returns error when formula evaluation fails', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [{ tool_category: 'X', param_key: 'bad', formula: 'undefined_var + 1' }],
    });

    const result = await FormulaService.calculateMachineParams('MACHINE', {});
    expect(result.error).toBeDefined();
  });

  test('returns error on DB query failure', async () => {
    engPool.query.mockRejectedValueOnce(new Error('DB connection lost'));

    const result = await FormulaService.calculateMachineParams('KS400B', { od: 20 });

    expect(result.error).toMatch(/Calculation Engine Error/i);
  });
});
