'use strict';

const actualCycleTime = require('../../api/engineer/mtc/services/actualCycleTime');
const { summarizeCycleTime, groupCycleTimeByMachine, fetchActualCycleTime } = actualCycleTime;

// The floor-code → display-name resolver is cached for 5 minutes across calls (so a real
// search doesn't re-query rodpc/eng every time); clear it between tests so one test's
// fake pool never leaks its result into the next.
beforeEach(() => actualCycleTime._clearCache());

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

  it('keeps the FIRST row seen per process, not the last (caller sorts latest-first)', () => {
    const out = summarizeCycleTime([
      { process: '1011', cycle_time: 200, lot_no: 'NEWEST' },
      { process: '1011', cycle_time: 12, lot_no: 'OLDER' },
    ]);
    expect(out['1011'].lotNo).toBe('NEWEST');
  });
});

describe('groupCycleTimeByMachine', () => {
  const nameOf = (code) => ({ 'CGM-14': 'HI-GRIND-1-D', 'CGM-08': 'HI-GRIND-1-D', 'SBT-12': 'OC-20BR-200' }[code] || code);

  it('keeps each machine\'s OWN latest value, even when two machines share a process', () => {
    const out = groupCycleTimeByMachine([
      { machine: 'CGM-14', process: '1011', cycle_time: 200, lot_no: 'T9051T6' },
      { machine: 'CGM-08', process: '1011', cycle_time: 14, lot_no: 'S1812T5' },
    ], (code) => code); // raw codes, no collapsing
    expect(out['1011']['CGM-14']).toEqual({ ct: 200, lotNo: 'T9051T6', lastDate: null });
    expect(out['1011']['CGM-08']).toEqual({ ct: 14, lotNo: 'S1812T5', lastDate: null });
  });

  it('resolves the floor code to its display name, so two floor units of one type merge', () => {
    // CGM-14 and CGM-08 both resolve to HI-GRIND-1-D — the later lot (first in the array,
    // per the caller's ORDER BY) is the one kept, regardless of which floor unit ran it.
    const out = groupCycleTimeByMachine([
      { machine: 'CGM-14', process: '1011', cycle_time: 200, lot_no: 'T9051T6' },
      { machine: 'CGM-08', process: '1011', cycle_time: 14, lot_no: 'S1812T5' },
    ], nameOf);
    expect(Object.keys(out['1011'])).toEqual(['HI-GRIND-1-D']);
    expect(out['1011']['HI-GRIND-1-D'].ct).toBe(200);
  });

  it('a different machine on the same process stays separate', () => {
    const out = groupCycleTimeByMachine([
      { machine: 'CGM-14', process: '1011', cycle_time: 200, lot_no: 'A' },
      { machine: 'SBT-12', process: '1011', cycle_time: 25, lot_no: 'B' },
    ], nameOf);
    expect(out['1011']['HI-GRIND-1-D'].ct).toBe(200);
    expect(out['1011']['OC-20BR-200'].ct).toBe(25);
  });

  it('falls back to the raw floor code when no resolver is given', () => {
    const out = groupCycleTimeByMachine([{ machine: 'CGM-14', process: '1011', cycle_time: 10 }], null);
    expect(Object.keys(out['1011'])).toEqual(['CGM-14']);
  });

  it('is empty, not a throw, for no rows', () => {
    expect(groupCycleTimeByMachine([], nameOf)).toEqual({});
    expect(groupCycleTimeByMachine(null, nameOf)).toEqual({});
  });
});

describe('fetchActualCycleTime', () => {
  const fakePools = ({ pc = [], rodpc = [], eng = [] } = {}) => {
    const maqCalls = [];
    const maqPool = { query: jest.fn((sql, params) => { maqCalls.push({ sql, params }); return Promise.resolve({ rows: pc }); }) };
    const rodpcPool = { query: jest.fn(() => Promise.resolve({ rows: rodpc })) };
    const engPool = { query: jest.fn(() => Promise.resolve({ rows: eng })) };
    return { maqPool, rodpcPool, engPool, maqCalls };
  };

  it('converts the CN to item-no form and matches the optional -C suffix', async () => {
    const { maqPool, maqCalls } = fakePools({
      pc: [{ machine: 'CGM-14', process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-20' }],
    });
    const out = await fetchActualCycleTime({ maqPool }, 'C29-04065');
    expect(maqCalls[0].params).toEqual(['294065']);
    expect(maqCalls[0].sql).toMatch(/control_no = \$1 OR control_no LIKE \$1 \|\| '-%'/);
    expect(maqCalls[0].sql).toMatch(/AND cycle_time > 0/);
    expect(out.flat['1011']).toEqual({ ct: 200, lotNo: 'T9051T6', lastDate: '2026-08-20' });
    expect(out.byMachine['1011']['CGM-14']).toEqual({ ct: 200, lotNo: 'T9051T6', lastDate: '2026-08-20' });
  });

  it('resolves the per-machine name via the sds_machine_code OVERRIDE (e.g. HI-GRIND/CGM)', async () => {
    const { maqPool, rodpcPool, engPool } = fakePools({
      pc: [{ machine: 'CGM-14', process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-20' }],
      rodpc: [{ machine_code: 'CGM-14', m_model: 'SOME-BASE-NAME' }],      // rodpc's own name
      eng: [{ machine_code: 'CGM-14', machine_name: 'HI-GRIND-1-D' }],     // sds_machine_code wins
    });
    const out = await fetchActualCycleTime({ maqPool, rodpcPool, engPool }, 'C29-04065');
    expect(Object.keys(out.byMachine['1011'])).toEqual(['HI-GRIND-1-D']);
  });

  it('degrades to the raw floor code (never throws) when rodpcPool/engPool are omitted', async () => {
    const { maqPool } = fakePools({
      pc: [{ machine: 'CGM-14', process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-20' }],
    });
    const out = await fetchActualCycleTime({ maqPool }, 'C29-04065');
    expect(Object.keys(out.byMachine['1011'])).toEqual(['CGM-14']);
  });

  it('returns empty flat/byMachine without querying for a CN shape it cannot parse', async () => {
    const { maqPool, maqCalls } = fakePools();
    expect(await fetchActualCycleTime({ maqPool }, 'garbage')).toEqual({ flat: {}, byMachine: {} });
    expect(maqCalls).toHaveLength(0);
  });

  it('fails open to empty maps when the production source errors, never throws', async () => {
    const maqPool = { query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    await expect(fetchActualCycleTime({ maqPool }, 'C29-04065')).resolves.toEqual({ flat: {}, byMachine: {} });
  });

  it('is fail-open (not a throw) when rodpcPool/engPool themselves error', async () => {
    const { maqPool } = fakePools({ pc: [{ machine: 'CGM-14', process: '1011', cycle_time: 10, lot_no: 'X' }] });
    const rodpcPool = { query: jest.fn().mockRejectedValue(new Error('down')) };
    const engPool = { query: jest.fn().mockRejectedValue(new Error('down')) };
    const out = await fetchActualCycleTime({ maqPool, rodpcPool, engPool }, 'C29-04065');
    expect(out.byMachine['1011']['CGM-14'].ct).toBe(10); // degrades to the raw code, still resolves
  });
});
