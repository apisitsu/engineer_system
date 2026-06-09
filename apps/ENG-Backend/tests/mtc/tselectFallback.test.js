'use strict';

// searchService pulls in the pg pool — stub it so the fallback module loads clean.
jest.mock('../../api/engineer/mtc/services/searchService', () => ({ search: jest.fn() }));

const fallback = require('../../api/engineer/mtc/services/tselectFallback');

const RESULT = {
  success: true,
  spec: { process: 'OD->ID' },
  results: [
    { machine: 'KS-400B1', tooling: 'CHUCK JAW', matches: [{ tooling_no: '4556-01-0048' }] },
    { machine: 'KS-400B1/B2/B7', tooling: 'LOADER', matches: [{ tooling_no: '4664-02-0010' }] },
    { machine: 'OTHER', tooling: 'X', matches: [{ tooling_no: '9999-99-9999' }] },
  ],
};

describe('directionForProcessCode', () => {
  it('maps OD/ID grind codes', () => {
    expect(fallback.directionForProcessCode('1041')).toBe('OD->ID');
    expect(fallback.directionForProcessCode('1062')).toBe('ID->OD');
  });
  it('returns null for non-grind / unknown codes', () => {
    expect(fallback.directionForProcessCode('1021')).toBeNull();
    expect(fallback.directionForProcessCode(null)).toBeNull();
  });
});

describe('tselectToolsForMachine', () => {
  it('returns matches for an acceptable machine name', () => {
    const out = fallback.tselectToolsForMachine(RESULT, new Set(['KS-400B1']));
    expect(out).toEqual([{ tooling_name: 'CHUCK JAW', tooling_no: '4556-01-0048' }]);
  });

  it('matches via machine_group label too', () => {
    const out = fallback.tselectToolsForMachine(RESULT, new Set(['KS-400B1/B2/B7']));
    expect(out.map(t => t.tooling_name)).toContain('LOADER');
  });

  it('keeps the match when process_code direction agrees with spec', () => {
    const out = fallback.tselectToolsForMachine(RESULT, new Set(['KS-400B1']), { processCode: '1041' });
    expect(out).toHaveLength(1); // 1041 = OD->ID = spec direction
  });

  it('rejects when process_code direction conflicts with spec direction', () => {
    const out = fallback.tselectToolsForMachine(RESULT, new Set(['KS-400B1']), { processCode: '1061' });
    expect(out).toEqual([]); // 1061 = ID->OD, spec is OD->ID → proven conflict
  });

  it('does NOT gate when process_code has no direction (additive safety)', () => {
    const out = fallback.tselectToolsForMachine(RESULT, new Set(['KS-400B1']), { processCode: '1021' });
    expect(out).toHaveLength(1);
  });

  it('does NOT gate when spec direction is missing', () => {
    const noDir = { ...RESULT, spec: { process: '' } };
    const out = fallback.tselectToolsForMachine(noDir, new Set(['KS-400B1']), { processCode: '1061' });
    expect(out).toHaveLength(1);
  });

  it('returns [] for an unsuccessful / empty result', () => {
    expect(fallback.tselectToolsForMachine(null, new Set(['X']))).toEqual([]);
    expect(fallback.tselectToolsForMachine({ success: false }, new Set(['X']))).toEqual([]);
  });
});
