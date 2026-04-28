'use strict';

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));

const { engPool } = require('../../instance/eng_db');
const FormulaService = require('../../api/engineer/mtc/services/FormulaService');

afterEach(() => jest.clearAllMocks());

// ── validateFormula ───────────────────────────────────────────────────────────

describe('FormulaService.validateFormula', () => {
  it('evaluates a valid constant formula', () => {
    const result = FormulaService.validateFormula('2 + 2');
    expect(result).toEqual({ valid: true, result: 4 });
  });

  it('evaluates formula using context variables', () => {
    const result = FormulaService.validateFormula('odAft / 2', { odAft: 30 });
    expect(result).toEqual({ valid: true, result: 15 });
  });

  it('returns invalid for bad syntax', () => {
    const result = FormulaService.validateFormula('???');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('supports ceil(x) single-arg', () => {
    const r = FormulaService.validateFormula('ceil(1.2)');
    expect(r.valid).toBe(true);
    expect(r.result).toBe(2);
  });

  it('supports floor(x) single-arg', () => {
    const r = FormulaService.validateFormula('floor(1.9)');
    expect(r.valid).toBe(true);
    expect(r.result).toBe(1);
  });

  it('supports round(x) single-arg', () => {
    const r = FormulaService.validateFormula('round(1.5)');
    expect(r.valid).toBe(true);
    expect(r.result).toBe(2);
  });

  it('round to 1dp via power-of-10 workaround', () => {
    // 1.15 * 10 = 11.5 exactly in IEEE 754 → round(11.5) = 12 → 12/10 = 1.2
    const r = FormulaService.validateFormula('round(1.15 * 10) / 10');
    expect(r.valid).toBe(true);
    expect(r.result).toBeCloseTo(1.2, 5);
  });

  it('supports sqrt, abs, max, min', () => {
    expect(FormulaService.validateFormula('sqrt(9)').result).toBe(3);
    expect(FormulaService.validateFormula('abs(-5)').result).toBe(5);
    expect(FormulaService.validateFormula('max(3, 7)').result).toBe(7);
    expect(FormulaService.validateFormula('min(3, 7)').result).toBe(3);
  });

  it('supports ternary conditional', () => {
    const r = FormulaService.validateFormula('isYBall ? 1 : 0', { isYBall: 1 });
    expect(r.valid).toBe(true);
    expect(r.result).toBe(1);
  });
});

// ── calculateMachineParams ────────────────────────────────────────────────────

describe('FormulaService.calculateMachineParams', () => {
  const CONTEXT = { odAft: 30, idAft: 20, wAft: 12 };

  it('returns error when no formulas found for machine', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });
    const result = await FormulaService.calculateMachineParams('UNKNOWN', CONTEXT);
    expect(result.error).toMatch(/no formulas/i);
  });

  it('calculates params and groups by tool_category', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        { tool_category: 'WORK DRIVER', param_key: 'wd_A', formula: 'odAft / 2' },
        { tool_category: 'WORK DRIVER', param_key: 'wd_B', formula: 'wd_A + 1' }, // uses prev result
      ],
    });

    const result = await FormulaService.calculateMachineParams('KS400B', CONTEXT);

    expect(result['WORK DRIVER']).toBeDefined();
    expect(result['WORK DRIVER'].wd_A).toBe(15);
    expect(result['WORK DRIVER'].wd_B).toBe(16); // sequential: wd_A (15) + 1
  });

  it('groups params with no category at top level', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        { tool_category: null, param_key: 'limit_A', formula: 'odAft * 0.5' },
      ],
    });

    const result = await FormulaService.calculateMachineParams('KS400B', CONTEXT);
    expect(result.limit_A).toBe(15);
    expect(result['WORK DRIVER']).toBeUndefined();
  });

  it('returns error when a formula fails to evaluate', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [
        { tool_category: 'TEST', param_key: 'bad_param', formula: 'undefinedVar + 1' },
      ],
    });

    const result = await FormulaService.calculateMachineParams('KS400B', {});
    expect(result.error).toBeDefined();
  });

  it('returns error on DB failure', async () => {
    engPool.query.mockRejectedValueOnce(new Error('DB down'));
    const result = await FormulaService.calculateMachineParams('KS400B', CONTEXT);
    expect(result.error).toBeDefined();
  });

  it('includes original context in _raw', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [{ tool_category: 'TEST', param_key: 'x', formula: '1' }],
    });

    const result = await FormulaService.calculateMachineParams('KS400B', CONTEXT);
    expect(result._raw).toMatchObject(CONTEXT);
  });
});
