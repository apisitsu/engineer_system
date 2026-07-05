'use strict';

// kanbanIntake must be FAIL-OPEN: any failure returns { ok:false } and never throws,
// so a board-sync problem can never break the MTC workflow that called it.

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn(), connect: jest.fn() },
}));

const { engPool } = require('../../instance/eng_db');
const kanbanIntake = require('../../api/engineer/mtc/services/kanbanIntake');

// Route queries by SQL content (order-independent). ensureTables() caches its
// DDL promise across tests, so ordered mockResolvedValueOnce would drift — match
// on the statement instead. Each test sets `configRows` / `failOn`.
let configRows;
let failOn; // substring of a SQL to reject (simulates a DB error)
beforeEach(() => {
  configRows = [];
  failOn = null;
  engPool.query.mockImplementation((sql) => {
    if (failOn && sql.includes(failOn)) return Promise.reject(new Error('db down'));
    if (sql.includes('CREATE TABLE')) return Promise.resolve({});
    if (sql.includes('FROM mtc_board_config')) return Promise.resolve({ rows: configRows });
    return Promise.resolve({ rows: [] });
  });
});
afterEach(() => jest.clearAllMocks());

describe('kanbanIntake.syncCard fail-open', () => {
  it('rejects missing source identifiers before touching the DB', async () => {
    const r = await kanbanIntake.syncCard({ sourceType: 'tool_request' }); // no sourceRef
    expect(r).toEqual({ ok: false, reason: 'missing_source' });
  });

  it('no-ops when the source is not configured', async () => {
    configRows = [];
    const r = await kanbanIntake.syncCard({ sourceType: 'tool_request', sourceRef: 1, name: 'x' });
    expect(r).toEqual({ ok: false, reason: 'disabled' });
    expect(engPool.connect).not.toHaveBeenCalled();
  });

  it('no-ops when config is disabled', async () => {
    configRows = [{ source_type: 'tool_request', enabled: false, default_list_id: 5 }];
    const r = await kanbanIntake.syncCard({ sourceType: 'tool_request', sourceRef: 1, name: 'x' });
    expect(r).toEqual({ ok: false, reason: 'disabled' });
  });

  it('no-ops when enabled but no target list resolves', async () => {
    configRows = [{ source_type: 'tool_request', enabled: true, default_list_id: null, stage_list_map: {} }];
    const r = await kanbanIntake.syncCard({ sourceType: 'tool_request', sourceRef: 1, stageKey: 'eng_check', name: 'x' });
    expect(r).toEqual({ ok: false, reason: 'no_target_list' });
    expect(engPool.connect).not.toHaveBeenCalled();
  });

  it('never throws on a DB error — returns { ok:false, reason:\'error\' }', async () => {
    failOn = 'FROM mtc_board_config';
    const r = await kanbanIntake.syncCard({ sourceType: 'tool_request', sourceRef: 1, name: 'x' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('error');
  });
});

describe('kanbanIntake.resolveListId', () => {
  it('prefers the stage map, falls back to default_list_id', () => {
    const cfg = { stage_list_map: { eng_check: 11, draft_man: 12 }, default_list_id: 99 };
    expect(kanbanIntake.resolveListId(cfg, 'draft_man')).toBe(12);
    expect(kanbanIntake.resolveListId(cfg, 'unknown_stage')).toBe(99);
    expect(kanbanIntake.resolveListId({ stage_list_map: {}, default_list_id: null }, 'x')).toBe(null);
  });
});
