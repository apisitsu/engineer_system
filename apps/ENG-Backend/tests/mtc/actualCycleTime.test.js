'use strict';

const { summarizeCycleTime, fetchLatestActualCycleTime } = require('../../api/engineer/mtc/services/actualCycleTime');

describe('summarizeCycleTime', () => {
  it('keeps the latest-non-zero lot\'s own value, keyed by process', () => {
    const out = summarizeCycleTime([{ process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-21' }]);
    expect(out['1011']).toEqual({ ct: 200, lotNo: 'T9051T6', lastDate: '2026-08-21' });
  });

  it('is absent (not 0) for a process whose query row has no cycle_time', () => {
    expect(summarizeCycleTime([])).toEqual({});
  });

  it('defensively drops a non-positive value even if one slips through', () => {
    expect(summarizeCycleTime([{ process: '3091', cycle_time: '0.00', last_date: null }])).toEqual({});
    expect(summarizeCycleTime([{ process: '3091', cycle_time: null, last_date: null }])).toEqual({});
  });

  it('skips a row with no process code rather than crashing', () => {
    expect(summarizeCycleTime([{ process: null, cycle_time: 10 }])).toEqual({});
    expect(summarizeCycleTime([{ process: '', cycle_time: 10 }])).toEqual({});
  });

  it('handles null/undefined input as no history', () => {
    expect(summarizeCycleTime(null)).toEqual({});
    expect(summarizeCycleTime(undefined)).toEqual({});
  });

  it('trims the process code so it matches the Process Info table\'s own key', () => {
    const out = summarizeCycleTime([{ process: ' 1011 ', cycle_time: 10, last_date: null }]);
    expect(Object.keys(out)).toEqual(['1011']);
  });

  it('lotNo is null, not undefined or a throw, when the row carries none', () => {
    expect(summarizeCycleTime([{ process: '1011', cycle_time: 10, last_date: null }])['1011'].lotNo).toBeNull();
  });
});

describe('fetchLatestActualCycleTime', () => {
  const fakePool = (rows) => {
    const calls = [];
    return { calls, query: jest.fn((sql, params) => { calls.push({ sql, params }); return Promise.resolve({ rows }); }) };
  };

  it('converts the CN to item-no form and matches the optional -C suffix', async () => {
    const pool = fakePool([{ process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-20' }]);
    const out = await fetchLatestActualCycleTime(pool, 'C29-04065');
    expect(pool.calls[0].params).toEqual(['294065']);
    expect(pool.calls[0].sql).toMatch(/control_no = \$1 OR control_no LIKE \$1 \|\| '-%'/);
    expect(pool.calls[0].sql).toMatch(/AND cycle_time > 0/);
    expect(out['1011']).toEqual({ ct: 200, lotNo: 'T9051T6', lastDate: '2026-08-20' });
  });

  it('returns {} without querying for a CN shape it cannot parse', async () => {
    const pool = fakePool([]);
    expect(await fetchLatestActualCycleTime(pool, 'garbage')).toEqual({});
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('fails open to {} when the production source errors, never throws', async () => {
    const pool = { query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    await expect(fetchLatestActualCycleTime(pool, 'C29-04065')).resolves.toEqual({});
  });
});
