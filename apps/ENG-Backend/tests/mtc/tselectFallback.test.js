'use strict';

// searchService pulls in the pg pool — stub it so the fallback module loads clean.
jest.mock('../../api/engineer/mtc/services/searchService', () => ({ search: jest.fn() }));

const fallback = require('../../api/engineer/mtc/services/tselectFallback');
const searchService = require('../../api/engineer/mtc/services/searchService');

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
    expect(out).toEqual([{ tooling_name: 'CHUCK JAW', tooling_no: '4556-01-0048', isSimilar: false }]);
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

  // Tooling used ON a machine but filed under ANOTHER machine's registry code.
  // 9901-09 CONCENTRICITY MEASURING PIN is the live case: TEMPLATE_B lists it first in
  // every X-100 block, but family 9901 resolves to code 901 = `測定用治具全般`, so the
  // machine-name gate dropped it and X-100's T01 printed a name with no Tool No.
  describe('acceptFamilies (the machine whitelist admits a foreign-machine result)', () => {
    const PIN = {
      success: true,
      spec: { process: 'OD->ID' },
      results: [
        { machine: 'X-100', tooling: 'ARBOR', matches: [{ tooling_no: '4857-01-0014' }] },
        { machine: '測定用治具全般', tooling: 'CONCENTRICITY MEASURING PIN', matches: [{ tooling_no: '9901-09-0005' }] },
        { machine: '測定用治具全般', tooling: 'SPHERICITY MEASURING JIG ASSY', matches: [{ tooling_no: '9901-21-0003' }] },
      ],
    };

    it('admits a foreign-machine tool whose family the config whitelists', () => {
      const out = fallback.tselectToolsForMachine(PIN, new Set(['X-100']), {
        acceptFamilies: new Set(['4857-01', '9901-09']),
      });
      expect(out.map(t => t.tooling_no)).toEqual(['4857-01-0014', '9901-09-0005']);
    });

    it('does NOT admit a foreign-machine tool the config does not whitelist', () => {
      const out = fallback.tselectToolsForMachine(PIN, new Set(['X-100']), {
        acceptFamilies: new Set(['4857-01', '9901-09']),
      });
      // 9901-21 sits on the same foreign machine but is not in this machine's whitelist
      expect(out.map(t => t.tooling_no)).not.toContain('9901-21-0003');
    });

    it('is inert when omitted — the machine-name gate alone still applies', () => {
      const out = fallback.tselectToolsForMachine(PIN, new Set(['X-100']));
      expect(out.map(t => t.tooling_no)).toEqual(['4857-01-0014']);
    });

    it('ignores a non-Set value rather than widening the gate', () => {
      const out = fallback.tselectToolsForMachine(PIN, new Set(['X-100']), {
        acceptFamilies: ['9901-09'],
      });
      expect(out.map(t => t.tooling_no)).toEqual(['4857-01-0014']);
    });

    it('never admits a foreign tool whose number is not a DWG family', () => {
      const odd = {
        success: true,
        spec: { process: 'OD->ID' },
        results: [{ machine: 'OTHER', tooling: 'X', matches: [{ tooling_no: 'MISC-PART' }] }],
      };
      const out = fallback.tselectToolsForMachine(odd, new Set(['X-100']), {
        acceptFamilies: new Set(['4857-01', '']),
      });
      expect(out).toEqual([]);
    });

    it('still admits the machine\'s OWN tools when acceptFamilies is empty', () => {
      const out = fallback.tselectToolsForMachine(PIN, new Set(['X-100']), {
        acceptFamilies: new Set(),
      });
      expect(out.map(t => t.tooling_no)).toEqual(['4857-01-0014']);
    });
  });

  describe('similar_part fallback handling', () => {
    const SIMILAR = {
      success: true,
      spec: { process: '' },
      results: [
        { machine: 'KL-20', tooling: '4030-01_COLLET', overrideBy: 'similar_part',
          matches: [{ tooling_no: '4030-01-1002' }] },
      ],
    };

    it('EXCLUDES similar_part by default (coverage stays confirmed-only)', () => {
      const out = fallback.tselectToolsForMachine(SIMILAR, new Set(['KL-20']));
      expect(out).toEqual([]);
    });

    it('INCLUDES similar_part when includeSimilar is set (Setup Data Sheet), flagged isSimilar', () => {
      const out = fallback.tselectToolsForMachine(SIMILAR, new Set(['KL-20']), { includeSimilar: true });
      expect(out).toEqual([{ tooling_name: '4030-01_COLLET', tooling_no: '4030-01-1002', isSimilar: true }]);
    });
  });

  // The empty-slot SDS PDF fill: when a factory Tool No is blank, T-Select supplies one.
  // A dimensionally-similar PRODUCED part's actual tool (similarRef) must WIN over the raw
  // closest dimensional inventory match (matches[0] = "T-Select #1"). Regression guard for
  // the reported bug "PDF still uses T-Select #1 even though a similar part was detected".
  describe('similarRef preference (SDS PDF empty-slot fill)', () => {
    const WITH_SIMILAR_REF = {
      success: true,
      spec: { process: '' },
      results: [
        { machine: 'KS-03A', tooling: 'CPX SHOE',
          matches: [{ tooling_no: '4559-40-0024' }],          // T-Select #1 (raw dimensional)
          similarRef: { tool_dwg_no: '4559-40-0056', source: 'factory' } }, // produced-twin tool
      ],
    };

    it('prefers similarRef over matches[0] when includeSimilar is set', () => {
      const out = fallback.tselectToolsForMachine(WITH_SIMILAR_REF, new Set(['KS-03A']), { includeSimilar: true });
      expect(out).toEqual([{ tooling_name: 'CPX SHOE', tooling_no: '4559-40-0056', isSimilar: true }]);
    });

    it('falls back to matches[0] when includeSimilar is set but there is no similarRef', () => {
      const noRef = { ...WITH_SIMILAR_REF, results: [{ ...WITH_SIMILAR_REF.results[0], similarRef: undefined }] };
      const out = fallback.tselectToolsForMachine(noRef, new Set(['KS-03A']), { includeSimilar: true });
      expect(out).toEqual([{ tooling_name: 'CPX SHOE', tooling_no: '4559-40-0024', isSimilar: false }]);
    });

    it('ignores similarRef without includeSimilar (coverage report stays confirmed-only)', () => {
      const out = fallback.tselectToolsForMachine(WITH_SIMILAR_REF, new Set(['KS-03A']));
      expect(out).toEqual([{ tooling_name: 'CPX SHOE', tooling_no: '4559-40-0024', isSimilar: false }]);
    });

    it('ignores a similarRef that has no tool_dwg_no (guards against a partial ref row)', () => {
      const emptyRef = { ...WITH_SIMILAR_REF, results: [{ ...WITH_SIMILAR_REF.results[0], similarRef: { source: 'factory' } }] };
      const out = fallback.tselectToolsForMachine(emptyRef, new Set(['KS-03A']), { includeSimilar: true });
      expect(out).toEqual([{ tooling_name: 'CPX SHOE', tooling_no: '4559-40-0024', isSimilar: false }]);
    });
  });
});

describe('safeSearch caching', () => {
  // safeSearch persists results to the tselect_cn_cache DB table (survives restarts),
  // so without clearing it a prior run's rows would be served on the next run and the
  // searchService mock would never be called. clearPersisted() resets both the
  // in-memory Map and the DB rows, keeping each test hermetic.
  beforeEach(async () => {
    searchService.search.mockReset();
    await fallback.clearPersisted();
  });
  afterAll(() => fallback.clearPersisted());

  it('does NOT cache a thrown (transient) error — the next call retries', async () => {
    searchService.search
      .mockRejectedValueOnce(new Error('db blip'))
      .mockResolvedValueOnce({ success: true, results: [] });

    const first = await fallback.safeSearch('ERRCN-001');
    expect(first).toBeNull();                                  // error → null
    const second = await fallback.safeSearch('ERRCN-001');     // same CN, retried
    expect(second).toEqual({ success: true, results: [] });
    expect(searchService.search).toHaveBeenCalledTimes(2);     // not served from cache
  });

  it('caches a successful result — the second call is served from cache', async () => {
    searchService.search.mockResolvedValueOnce({ success: true, results: ['x'] });

    const first  = await fallback.safeSearch('OKCN-001');
    const second = await fallback.safeSearch('OKCN-001');
    expect(second).toBe(first);                                // same object reference
    expect(searchService.search).toHaveBeenCalledTimes(1);     // 2nd hit cache
  });

  it('caches a legitimate "spec not found" answer too', async () => {
    searchService.search.mockResolvedValueOnce({ success: false, error: 'Part spec not found' });

    await fallback.safeSearch('NOSPEC-001');
    const second = await fallback.safeSearch('NOSPEC-001');
    expect(second).toEqual({ success: false, error: 'Part spec not found' });
    expect(searchService.search).toHaveBeenCalledTimes(1);     // stable answer, cached
  });
});
