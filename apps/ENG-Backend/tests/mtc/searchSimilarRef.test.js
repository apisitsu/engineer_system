'use strict';

// Unit tests for the informational "Similar" REFERENCE column attachers in
// searchService.js (_attachSimilarRefFromPartnoMap / _attachSimilarRefFromFactoryPlan).
//
// These were the riskiest new code in the 2026-06-28 change yet had no coverage.
// The bug they guard against: a searched part with NO usable dims (OD/ID/W all
// 0/NULL) would score distance 0 against any other dim-less row and surface a
// spurious "exact twin" at 0.00 mm. We mock both pools (same pattern as
// evalToolingAccuracy.test.js) so the JS guard + distance-cap logic is verified
// without a DB — the SQL text itself is irrelevant to these assertions.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() }, default: {} }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const { maqPool } = require('../../instance/maq_db');
const svc = require('../../api/engineer/mtc/services/searchService');

beforeEach(() => jest.clearAllMocks());

describe('_attachSimilarRefFromPartnoMap (curated partno_map)', () => {
  const machineByDisplay = { 'KS-B22G': { machine_name: 'KS-B22G' } };
  const spec = { cn: '310190' };                 // class 31 (ball) — valid 2-digit prefix
  const okCtx = { OD: 10, ID: 5, W: 2 };

  it('attaches a reference when the nearest twin is within SIMILAR_DIST_MAX (0.2)', async () => {
    const results = [{ machine: 'KS-B22G', tooling: 'JAW', matches: [{}] }];
    engPool.query.mockResolvedValueOnce({ rows: [
      { tooling_name: 'JAW', tool_dwg_no: '4027-01-0079', ref_cn: '310180', parts_no: 'PN1', dist: 0.1 },
    ] });
    await svc._attachSimilarRefFromPartnoMap(results, machineByDisplay, spec, okCtx);
    expect(results[0].similarRef).toMatchObject({
      tool_dwg_no: '4027-01-0079', ref_cn: '310180', parts_no: 'PN1',
      distance: 0.1, source: 'partno_map',
    });
  });

  it('does NOT attach when the nearest twin is beyond the 0.2 mm cap', async () => {
    const results = [{ machine: 'KS-B22G', tooling: 'JAW', matches: [{}] }];
    engPool.query.mockResolvedValueOnce({ rows: [
      { tooling_name: 'JAW', tool_dwg_no: '4027-01-0079', ref_cn: '310180', parts_no: 'PN1', dist: 0.3 },
    ] });
    await svc._attachSimilarRefFromPartnoMap(results, machineByDisplay, spec, okCtx);
    expect(results[0].similarRef).toBeUndefined();
  });

  it('NULL-dim guard: skips entirely (no query) when searched dims are all 0', async () => {
    const results = [{ machine: 'KS-B22G', tooling: 'JAW', matches: [{}] }];
    await svc._attachSimilarRefFromPartnoMap(results, machineByDisplay, spec, { OD: 0, ID: 0, W: 0 });
    expect(engPool.query).not.toHaveBeenCalled();
    expect(results[0].similarRef).toBeUndefined();
  });
});

describe('_attachSimilarRefFromFactoryPlan (generic lpb.eng_r_pi_tool)', () => {
  const spec = { cn: '310190' };                 // ball class → has a dim table
  const okCtx = { OD: 10, ID: 5, W: 2 };
  const ballMatch = [{ tooling_no: '4866-10-0005' }]; // family 4866-10

  it('attaches a factory reference within the 0.2 mm cap', async () => {
    const results = [{ machine: 'KS-B80', tooling: 'PLUG', matches: ballMatch }];
    maqPool.query.mockResolvedValueOnce({ rows: [
      { fam: '4866-10', ref_cn: 'C31-00180', tool_dwg_no: '4866-10-0009', dist: 0.05 },
    ] });
    await svc._attachSimilarRefFromFactoryPlan(results, spec, okCtx);
    expect(results[0].similarRef).toMatchObject({
      tool_dwg_no: '4866-10-0009', ref_cn: 'C31-00180', distance: 0.05, source: 'factory',
    });
  });

  it('does NOT attach when the factory twin is beyond the 0.2 mm cap', async () => {
    const results = [{ machine: 'KS-B80', tooling: 'PLUG', matches: ballMatch }];
    maqPool.query.mockResolvedValueOnce({ rows: [
      { fam: '4866-10', ref_cn: 'C31-00180', tool_dwg_no: '4866-10-0009', dist: 0.5 },
    ] });
    await svc._attachSimilarRefFromFactoryPlan(results, spec, okCtx);
    expect(results[0].similarRef).toBeUndefined();
  });

  it('NULL-dim guard: skips entirely (no query) when searched dims are all 0', async () => {
    const results = [{ machine: 'KS-B80', tooling: 'PLUG', matches: ballMatch }];
    await svc._attachSimilarRefFromFactoryPlan(results, spec, { OD: 0, ID: 0, W: 0 });
    expect(maqPool.query).not.toHaveBeenCalled();
    expect(results[0].similarRef).toBeUndefined();
  });

  it('skips a class with no factory dim table (e.g. body class 50) before querying', async () => {
    const results = [{ machine: 'X', tooling: 'Y', matches: ballMatch }];
    await svc._attachSimilarRefFromFactoryPlan(results, { cn: '500190' }, okCtx);
    expect(maqPool.query).not.toHaveBeenCalled();
    expect(results[0].similarRef).toBeUndefined();
  });
});
