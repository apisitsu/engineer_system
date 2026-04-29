'use strict';

// Mock DB pool before requiring the controller
jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));
jest.mock('../../api/engineer/mtc/services/FormulaService', () => ({
  validateFormula: jest.fn(),
}));

const { engPool } = require('../../instance/eng_db');
const FormulaService = require('../../api/engineer/mtc/services/FormulaService');
const {
  getMachineNames,
  getFormulasByMachine,
  createFormula,
  updateFormula,
  deleteFormula,
} = require('../../api/engineer/mtc/controllers/formulaController');

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  params: {},
  query: {},
  body: {},
  user: null,
  ...overrides,
});

// ── getMachineNames ───────────────────────────────────────────────────────────

describe('getMachineNames', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns sorted machine name list', async () => {
    engPool.query.mockResolvedValueOnce({
      rows: [{ machine_name: 'KS400B' }, { machine_name: 'KS03A' }],
    });
    const res = mockRes();
    await getMachineNames(mockReq(), res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      machines: ['KS400B', 'KS03A'],
    });
  });

  it('returns 500 on DB error', async () => {
    engPool.query.mockRejectedValueOnce(new Error('connection lost'));
    const res = mockRes();
    await getMachineNames(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getFormulasByMachine ──────────────────────────────────────────────────────

describe('getFormulasByMachine', () => {
  const FORMULA_ROW = {
    id: 1, machine_name: 'KS400B', tool_category: 'WORK DRIVER',
    tooling_type: 'WORK DRIVER', param_key: 'wd_A', formula: 'odAft / 2',
  };

  afterEach(() => jest.clearAllMocks());

  it('returns all active formulas when no tooling_type given', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [FORMULA_ROW] });
    const req = mockReq({ params: { machineName: 'KS400B' }, query: {} });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    const [sql, params] = engPool.query.mock.calls[0];
    expect(sql).not.toContain('ILIKE');
    expect(params).toEqual(['KS400B']);
    expect(res.json).toHaveBeenCalledWith({ success: true, formulas: [FORMULA_ROW] });
  });

  it('filters using needle ILIKE containing COALESCE(tooling_type, tool_category) when tooling_type given', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [FORMULA_ROW] });
    const req = mockReq({
      params: { machineName: 'KS400B' },
      query: { tooling_type: 'WORK DRIVER' },
    });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    const [sql, params] = engPool.query.mock.calls[0];
    expect(sql).toContain('ILIKE');
    expect(sql).toContain('COALESCE(tooling_type, tool_category)');
    expect(params).toEqual(['KS400B', 'WORK DRIVER']);
    expect(res.json).toHaveBeenCalledWith({ success: true, formulas: [FORMULA_ROW] });
  });

  it('trims whitespace from tooling_type before querying', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });
    const req = mockReq({
      params: { machineName: 'KS400B' },
      query: { tooling_type: '  WORK DRIVER  ' },
    });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    const [, params] = engPool.query.mock.calls[0];
    expect(params[1]).toBe('WORK DRIVER');
  });

  it('falls back to tool_category ILIKE when tooling_type column missing (error 42703)', async () => {
    const colMissingErr = new Error('column "tooling_type" does not exist');
    colMissingErr.code = '42703';
    engPool.query
      .mockRejectedValueOnce(colMissingErr)   // first attempt fails
      .mockResolvedValueOnce({ rows: [FORMULA_ROW] }); // fallback succeeds

    const req = mockReq({
      params: { machineName: 'KS400B' },
      query: { tooling_type: 'WORK DRIVER' },
    });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    expect(engPool.query).toHaveBeenCalledTimes(2);
    const [fallbackSql, fallbackParams] = engPool.query.mock.calls[1];
    expect(fallbackSql).toContain('ILIKE');
    expect(fallbackSql).toContain('tool_category');
    expect(fallbackSql).not.toContain('COALESCE');
    expect(fallbackParams).toEqual(['KS400B', 'WORK DRIVER']);
    expect(res.json).toHaveBeenCalledWith({ success: true, formulas: [FORMULA_ROW] });
  });

  it('does NOT retry fallback for non-42703 DB errors', async () => {
    const dbErr = new Error('connection lost');
    dbErr.code = '08006';
    engPool.query.mockRejectedValueOnce(dbErr);

    const req = mockReq({
      params: { machineName: 'KS400B' },
      query: { tooling_type: 'WORK DRIVER' },
    });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    expect(engPool.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns empty formulas array when no match found', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });
    const req = mockReq({
      params: { machineName: 'KS400B' },
      query: { tooling_type: 'NONEXISTENT TOOL' },
    });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, formulas: [] });
  });

  it('returns 500 on unexpected DB error (no tooling_type)', async () => {
    engPool.query.mockRejectedValueOnce(new Error('timeout'));
    const req = mockReq({ params: { machineName: 'KS400B' }, query: {} });
    const res = mockRes();

    await getFormulasByMachine(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });
});

// ── createFormula ─────────────────────────────────────────────────────────────

describe('createFormula', () => {
  afterEach(() => jest.clearAllMocks());

  const BASE_BODY = {
    machine_name: 'KS400B',
    tool_category: 'WORK DRIVER',
    tooling_type: 'WORK DRIVER',
    param_key: 'wd_A',
    formula: 'odAft / 2',
    description: 'half OD after',
  };

  it('saves formula and defaults tooling_type to tool_category when omitted', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    const savedRow = { id: 10, ...BASE_BODY };
    engPool.query.mockResolvedValueOnce({ rows: [savedRow] });

    const req = mockReq({
      body: { ...BASE_BODY, tooling_type: undefined }, // omit tooling_type
    });
    const res = mockRes();

    await createFormula(req, res);

    const [, params] = engPool.query.mock.calls[0];
    // params: [machine_name, tool_category, ttVal, param_key, formula, description]
    expect(params[2]).toBe('WORK DRIVER'); // ttVal falls back to tool_category
    expect(res.json).toHaveBeenCalledWith({ success: true, formula: savedRow });
  });

  it('uses explicit tooling_type when provided', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    engPool.query.mockResolvedValueOnce({ rows: [{ id: 11 }] });

    const req = mockReq({ body: { ...BASE_BODY, tooling_type: 'WD_CUSTOM' } });
    const res = mockRes();

    await createFormula(req, res);

    const [, params] = engPool.query.mock.calls[0];
    expect(params[2]).toBe('WD_CUSTOM');
  });

  it('returns 400 when formula syntax is invalid', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: false, error: 'unexpected token' });

    const req = mockReq({ body: { ...BASE_BODY, formula: '??? bad' } });
    const res = mockRes();

    await createFormula(req, res);

    expect(engPool.query).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 500 on DB error', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    engPool.query.mockRejectedValueOnce(new Error('unique violation'));

    const req = mockReq({ body: BASE_BODY });
    const res = mockRes();

    await createFormula(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── updateFormula ─────────────────────────────────────────────────────────────

describe('updateFormula', () => {
  afterEach(() => jest.clearAllMocks());

  it('updates formula and returns updated row', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    const updatedRow = { id: 5, formula: 'odAft * 3', tooling_type: 'WORK DRIVER' };
    engPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });

    const req = mockReq({
      params: { id: '5' },
      body: { formula: 'odAft * 3', tooling_type: 'WORK DRIVER' },
    });
    const res = mockRes();

    await updateFormula(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, formula: updatedRow });
  });

  it('passes tooling_type as second COALESCE param in UPDATE', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    engPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 5 }] });

    const req = mockReq({
      params: { id: '5' },
      body: { tooling_type: 'SUPPORT BLOCK', formula: 'x + 1' },
    });
    const res = mockRes();

    await updateFormula(req, res);

    const [, params] = engPool.query.mock.calls[0];
    // params: [tool_category, tooling_type, param_key, formula, description, id]
    expect(params[1]).toBe('SUPPORT BLOCK');
    expect(params[5]).toBe('5');
  });

  it('returns 404 when formula id not found', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: true });
    engPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req = mockReq({ params: { id: '999' }, body: { formula: 'x + 1' } });
    const res = mockRes();

    await updateFormula(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when updated formula syntax is invalid', async () => {
    FormulaService.validateFormula.mockReturnValueOnce({ valid: false, error: 'bad syntax' });

    const req = mockReq({ params: { id: '5' }, body: { formula: '!!!' } });
    const res = mockRes();

    await updateFormula(req, res);

    expect(engPool.query).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('skips formula validation when formula field is absent', async () => {
    engPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 5 }] });

    const req = mockReq({
      params: { id: '5' },
      body: { description: 'updated desc only' }, // no formula field
    });
    const res = mockRes();

    await updateFormula(req, res);

    expect(FormulaService.validateFormula).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

// ── deleteFormula ─────────────────────────────────────────────────────────────

describe('deleteFormula', () => {
  afterEach(() => jest.clearAllMocks());

  it('soft-deletes by setting is_active = false', async () => {
    engPool.query.mockResolvedValueOnce({});

    const req = mockReq({ params: { id: '7' } });
    const res = mockRes();

    await deleteFormula(req, res);

    const [sql, params] = engPool.query.mock.calls[0];
    expect(sql).toContain('is_active = false');
    expect(params).toEqual(['7']);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 500 on DB error', async () => {
    engPool.query.mockRejectedValueOnce(new Error('lock timeout'));

    const req = mockReq({ params: { id: '7' } });
    const res = mockRes();

    await deleteFormula(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
