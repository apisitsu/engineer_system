'use strict';

// Unit tests for services/machineHistory — the factory-plan "was this CN actually
// produced on this machine, sustainedly?" gate that SOFTENS a size-limit exclusion
// in searchService (type:'limit' → type:'limit_note') and splits the SDS coverage
// report's over-limit rows into `limit_excluded` (anomaly) vs `limit_softened`
// (worklist).
//
// The load-bearing properties pinned here:
//   (a) a produced floor code resolves to its machine's DISPLAY identifier
//       (machine_group when it has one, else machine_name);
//   (b) sds_machine_code overrides the rodpc.m_machine base name;
//   (c) EVIDENCE BAR — a single old one-off does NOT soften; >= MIN_LOTS lots, or
//       ANY lot within RECENT_MONTHS, does;
//   (d) FAILS CLOSED — any DB error yields an EMPTY set, so the caller keeps the
//       hard limit rather than softening a design rule on missing evidence.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));
jest.mock('../../instance/instance', () => ({ pool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const { maqPool } = require('../../instance/maq_db');
const { pool: rodpcPool } = require('../../instance/instance');
const engQ = engPool.query;
const maqQ = maqPool.query;
const rodQ = rodpcPool.query;

const machineHistory = require('../../api/engineer/mtc/services/machineHistory');
const { MIN_LOTS } = machineHistory;

const daysAgo = (d) => { const t = new Date(); t.setDate(t.getDate() - d); return t.toISOString(); };
const yearsAgo = (y) => { const t = new Date(); t.setFullYear(t.getFullYear() - y); return t.toISOString(); };

// Route each mocked query to a canned result by matching a keyword in the SQL.
function wire({ rodpc = [], sdsCode = [], group = [], prod = [] } = {}) {
  const pick = (sql) => {
    if (/m_machine/.test(sql)) return { rows: rodpc };
    if (/sds_machine_code/.test(sql)) return { rows: sdsCode };
    if (/sds_machine_type_code/.test(sql)) return { rows: group };
    if (/pc_production/.test(sql)) return { rows: prod };
    return { rows: [] };
  };
  engQ.mockImplementation((sql) => Promise.resolve(pick(sql)));
  maqQ.mockImplementation((sql) => Promise.resolve(pick(sql)));
  rodQ.mockImplementation((sql) => Promise.resolve(pick(sql)));
}

afterEach(() => {
  jest.clearAllMocks();
  machineHistory._clearCache();
});

describe('producedMachineNames', () => {
  it('softens on sustained history (>= MIN_LOTS lots)', async () => {
    wire({
      rodpc: [{ machine_code: 'IDG-03', name: 'KS-03A' }],
      prod: [{ machine: 'IDG-03', n: MIN_LOTS, last_date: yearsAgo(3) }],
    });
    expect([...await machineHistory.producedMachineNames('C31-00190')]).toEqual(['KS-03A']);
  });

  it('softens on a RECENT lot even below MIN_LOTS', async () => {
    wire({
      rodpc: [{ machine_code: 'IDG-03', name: 'KS-03A' }],
      prod: [{ machine: 'IDG-03', n: 1, last_date: daysAgo(30) }],
    });
    expect([...await machineHistory.producedMachineNames('C31-00190')]).toEqual(['KS-03A']);
  });

  it('does NOT soften on a single ancient one-off', async () => {
    wire({
      rodpc: [{ machine_code: 'IDG-03', name: 'KS-03A' }],
      prod: [{ machine: 'IDG-03', n: 1, last_date: yearsAgo(3) }],
    });
    expect((await machineHistory.producedMachineNames('C31-00190')).size).toBe(0);
  });

  it('resolves to the GROUP label when the machine belongs to a group', async () => {
    wire({
      rodpc: [{ machine_code: 'SPG-01', name: 'KS-400B1' }],
      group: [{ machine_type_name: 'KS-400B1', machine_group: 'KS-400B1/B2/B7' }],
      prod: [{ machine: 'SPG-01', n: 20, last_date: daysAgo(10) }],
    });
    expect([...await machineHistory.producedMachineNames('310190')]).toEqual(['KS-400B1/B2/B7']);
  });

  it('sds_machine_code overrides the rodpc base name', async () => {
    wire({
      rodpc: [{ machine_code: 'VSG-02', name: 'TSG300W' }],          // stale factory spelling
      sdsCode: [{ machine_code: 'VSG-02', machine_name: 'HAMAI 5B' }], // curated override
      prod: [{ machine: 'VSG-02', n: 8, last_date: daysAgo(5) }],
    });
    expect([...await machineHistory.producedMachineNames('C31-00190')]).toEqual(['HAMAI 5B']);
  });

  it('ignores a produced code that maps to no known machine', async () => {
    wire({
      rodpc: [{ machine_code: 'IDG-03', name: 'KS-03A' }],
      prod: [{ machine: 'ZZZ-99', n: 99, last_date: daysAgo(1) }],
    });
    expect((await machineHistory.producedMachineNames('C31-00190')).size).toBe(0);
  });

  it('FAILS CLOSED — a production-query error yields an empty set', async () => {
    engQ.mockResolvedValue({ rows: [] });
    rodQ.mockResolvedValue({ rows: [{ machine_code: 'IDG-03', name: 'KS-03A' }] });
    maqQ.mockRejectedValue(new Error('maqdb down'));
    expect((await machineHistory.producedMachineNames('C31-00190')).size).toBe(0);
  });

  it('caches per CN — a second call does not re-query', async () => {
    wire({
      rodpc: [{ machine_code: 'IDG-03', name: 'KS-03A' }],
      prod: [{ machine: 'IDG-03', n: 5, last_date: daysAgo(20) }],
    });
    await machineHistory.producedMachineNames('C31-00190');
    const after = maqQ.mock.calls.length;
    await machineHistory.producedMachineNames('310190'); // same CN, item-no form
    expect(maqQ.mock.calls.length).toBe(after);
  });
});
