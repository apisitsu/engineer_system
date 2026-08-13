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

describe('kanbanIntake link attachment', () => {
  // A transactional client whose statements we can inspect. The card INSERT has to
  // return a row, since _upsertLink is called with the new card's id.
  const clientFor = (existingLinkRows = []) => {
    const statements = [];
    const client = {
      query: jest.fn((sql, params) => {
        statements.push({ sql, params });
        // Anchored on the column list so it cannot also catch kb_card_membership
        // / kb_card_subscription, whose inserts follow immediately.
        if (/INSERT INTO kb_card\s*\(/.test(sql)) return Promise.resolve({ rows: [{ id: 77, board_id: 9, list_id: 5 }] });
        if (sql.includes('FROM kb_attachment')) return Promise.resolve({ rows: existingLinkRows });
        if (sql.includes('SELECT * FROM kb_card')) return Promise.resolve({ rows: [{ id: 77, board_id: 9, list_id: 5 }] });
        if (sql.includes('COALESCE(MAX(position)')) return Promise.resolve({ rows: [{ pos: 100 }] });
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    return { client, statements };
  };
  const attachInsert = (statements) => statements.find((s) => s.sql.includes('INSERT INTO kb_attachment'));

  beforeEach(() => {
    configRows = [{ source_type: 'sds_approval', enabled: true, default_list_id: 5, stage_list_map: {}, system_u_code: 'LE485' }];
  });

  it('attaches the deep link as a link-type attachment on create', async () => {
    const { client, statements } = clientFor();
    engPool.connect.mockResolvedValue(client);

    const r = await kanbanIntake.syncCard({
      sourceType: 'sds_approval', sourceRef: 'C1||M||1021', name: 'SDS',
      link: { url: '/eng/mtc_eng/sds-v2?cn=C1', name: 'Open SDS C1 — sign' },
    });

    expect(r.ok).toBe(true);
    const ins = attachInsert(statements);
    expect(ins).toBeDefined();
    expect(ins.params).toEqual([77, 'LE485', 'Open SDS C1 — sign', '/eng/mtc_eng/sds-v2?cn=C1',
      JSON.stringify({ url: '/eng/mtc_eng/sds-v2?cn=C1', name: 'Open SDS C1 — sign' })]);
  });

  it('does not duplicate a link that is already on the card', async () => {
    const { client, statements } = clientFor([{ id: 1 }]); // attachment already exists
    engPool.connect.mockResolvedValue(client);

    await kanbanIntake.syncCard({
      sourceType: 'sds_approval', sourceRef: 'C1||M||1021', name: 'SDS',
      link: { url: '/eng/mtc_eng/sds-v2?cn=C1' },
    });

    expect(attachInsert(statements)).toBeUndefined();
  });

  it('skips silently when no link is supplied', async () => {
    const { client, statements } = clientFor();
    engPool.connect.mockResolvedValue(client);

    await kanbanIntake.syncCard({ sourceType: 'sds_approval', sourceRef: 'C1||M||1021', name: 'SDS' });

    expect(attachInsert(statements)).toBeUndefined();
    expect(statements.some((s) => s.sql.includes('FROM kb_attachment'))).toBe(false);
  });
});

describe('kanbanIntake createOnly', () => {
  // A backlog feed re-runs on every report build. Without createOnly it would drag
  // every card that has since progressed back to the first list.
  const clientOn = (existingCard) => {
    const statements = [];
    const client = {
      query: jest.fn((sql, params) => {
        statements.push({ sql, params });
        if (/INSERT INTO kb_card\s*\(/.test(sql)) return Promise.resolve({ rows: [{ id: 88, board_id: 9, list_id: 3 }] });
        if (sql.includes('SELECT * FROM kb_card')) return Promise.resolve({ rows: [existingCard] });
        if (sql.includes('COALESCE(MAX(position)')) return Promise.resolve({ rows: [{ pos: 100 }] });
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    return { client, statements };
  };

  beforeEach(() => {
    configRows = [{ source_type: 'sds_approval', enabled: true, default_list_id: 76, stage_list_map: {}, system_u_code: 'LE485' }];
  });

  it('leaves an existing card where it is instead of moving it', async () => {
    // Link row exists → the card is already on the board, sitting on list 79 (Done).
    engPool.query.mockImplementation((sql) => {
      if (sql.includes('CREATE TABLE')) return Promise.resolve({});
      if (sql.includes('FROM mtc_board_config')) return Promise.resolve({ rows: configRows });
      if (sql.includes('FROM mtc_board_card_link')) return Promise.resolve({ rows: [{ card_id: 55 }] });
      return Promise.resolve({ rows: [] });
    });
    const { client, statements } = clientOn({ id: 55, board_id: 9, list_id: 79 });
    engPool.connect.mockResolvedValue(client);

    const r = await kanbanIntake.syncCard({
      sourceType: 'sds_approval', sourceRef: 'C1||M||1021', name: 'SDS', stageKey: null, createOnly: true,
    });

    expect(r).toEqual({ ok: true, action: 'noop', cardId: 55 });
    expect(statements.some((s) => s.sql.includes('UPDATE kb_card SET list_id'))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it('still creates the card when the job has none', async () => {
    const { client } = clientOn(null);
    engPool.connect.mockResolvedValue(client);

    const r = await kanbanIntake.syncCard({
      sourceType: 'sds_approval', sourceRef: 'C1||M||1021', name: 'SDS', stageKey: null, createOnly: true,
    });

    expect(r).toMatchObject({ ok: true, action: 'created', cardId: 88 });
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
