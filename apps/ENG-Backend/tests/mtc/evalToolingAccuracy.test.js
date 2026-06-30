'use strict';

// Unit tests for the pure scoring logic of scripts/eval_tooling_accuracy.js.
// The harness itself needs a live DB; these tests prove the family-alignment and
// hit/miss accounting are correct without one, so a number it prints can be
// trusted. The pure functions don't touch the DB, so we mock both pools (same
// pattern as formulaService.test.js) — requiring the script then opens no real
// connection and the suite exits cleanly on a DB-less box.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn(), end: jest.fn() } }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn(), end: jest.fn() } }));

const { familyOf, predToolNo, resolveToolingFamilies, scoreRecords, pmRag, buildPmReport } =
  require('../../scripts/eval_tooling_accuracy');

// Build a gtByFam map from a flat list of factory tool DWGs (mirrors gtFamiliesFor).
function gt(...dwgs) {
  const m = new Map();
  for (const d of dwgs) {
    const fam = familyOf(d);
    if (!fam) continue;
    if (!m.has(fam)) m.set(fam, new Set());
    m.get(fam).add(d);
  }
  return m;
}

describe('familyOf', () => {
  it('takes the first two dash-segments', () => {
    expect(familyOf('4027-01-0123')).toBe('4027-01');
    expect(familyOf('4866-10-0005-01')).toBe('4866-10');
  });
  it('returns null for non-standard DWGs (e.g. DD#### rotary dresser form)', () => {
    expect(familyOf('DD0226')).toBeNull();
    expect(familyOf('')).toBeNull();
    expect(familyOf(null)).toBeNull();
  });
});

describe('predToolNo', () => {
  it('prefers the tooling_no column', () => {
    expect(predToolNo({ tooling_no: '4027-01-0079', dim_a: 12 })).toBe('4027-01-0079');
  });
  it('falls back to the first DWG-shaped string value', () => {
    expect(predToolNo({ id: 5, code: '4030-02-0010', name: 'COLLET' })).toBe('4030-02-0010');
  });
  it('returns null for an empty/missing row', () => {
    expect(predToolNo(null)).toBeNull();
    expect(predToolNo({ dim_a: 1, label: 'x' })).toBeNull();
  });
});

describe('resolveToolingFamilies', () => {
  it('picks each tooling’s most-voted family and flags shared-family ambiguity', () => {
    const votes = new Map([
      ['KS-B22G||JAW',   new Map([['4027-01', 9], ['4099-99', 1]])], // → 4027-01
      ['KS-B22G||PLUG',  new Map([['4027-01', 5]])],                  // also 4027-01 → ambiguous machine
      ['OC-16A||PUSHER', new Map([['4540-01', 3]])],
    ]);
    const { toolingFamily, ambiguous } = resolveToolingFamilies(votes);
    expect(toolingFamily.get('KS-B22G||JAW')).toBe('4027-01');
    expect(toolingFamily.get('KS-B22G||PLUG')).toBe('4027-01');
    expect(toolingFamily.get('OC-16A||PUSHER')).toBe('4540-01');
    expect(ambiguous.get('KS-B22G')?.has('4027-01')).toBe(true); // two toolings, same family
    expect(ambiguous.has('OC-16A')).toBe(false);
  });
});

describe('scoreRecords', () => {
  const toolingFamily = new Map([['M||T', '4027-01']]);

  it('counts a top-1 hit (predicted #1 == a factory tool of that family)', () => {
    const recs = [{ key: 'M||T', pred0: '4027-01-0079', pred1: '4027-01-0080', gtByFam: gt('4027-01-0079') }];
    const s = scoreRecords(recs, toolingFamily).get('M||T');
    expect(s).toEqual({ n: 1, hit1: 1, hit2: 1, none: 0 });
  });

  it('counts a top-2 (not top-1) hit when #2 matches', () => {
    const recs = [{ key: 'M||T', pred0: '4027-01-9999', pred1: '4027-01-0079', gtByFam: gt('4027-01-0079') }];
    const s = scoreRecords(recs, toolingFamily).get('M||T');
    expect(s).toEqual({ n: 1, hit1: 0, hit2: 1, none: 0 });
  });

  it('counts an in-scope miss (factory used the family, prediction is wrong)', () => {
    const recs = [{ key: 'M||T', pred0: '4027-01-1111', pred1: '4027-01-2222', gtByFam: gt('4027-01-0079') }];
    const s = scoreRecords(recs, toolingFamily).get('M||T');
    expect(s).toEqual({ n: 1, hit1: 0, hit2: 0, none: 0 });
  });

  it('counts a "none" when in scope but search returned no tool', () => {
    const recs = [{ key: 'M||T', pred0: null, pred1: null, gtByFam: gt('4027-01-0079') }];
    const s = scoreRecords(recs, toolingFamily).get('M||T');
    expect(s).toEqual({ n: 1, hit1: 0, hit2: 0, none: 1 });
  });

  it('skips out-of-scope CNs (factory did NOT use the tooling’s family)', () => {
    const recs = [{ key: 'M||T', pred0: '4027-01-0079', pred1: null, gtByFam: gt('9999-99-0001') }];
    expect(scoreRecords(recs, toolingFamily).has('M||T')).toBe(false); // not counted at all
  });

  it('skips records whose tooling has no resolved family', () => {
    const recs = [{ key: 'UNKNOWN||T', pred0: '4027-01-0079', pred1: null, gtByFam: gt('4027-01-0079') }];
    expect(scoreRecords(recs, toolingFamily).size).toBe(0);
  });
});

describe('pmRag', () => {
  it('buckets top-1 into 🟢 ≥85 / 🟡 60–85 / 🔴 <60', () => {
    expect(pmRag(100)).toBe('🟢');
    expect(pmRag(85)).toBe('🟢');
    expect(pmRag(84.9)).toBe('🟡');
    expect(pmRag(60)).toBe('🟡');
    expect(pmRag(59.9)).toBe('🔴');
    expect(pmRag(0)).toBe('🔴');
  });
});

describe('buildPmReport', () => {
  const byMachine = new Map([
    ['KVD-300CRII', { n: 14, hit1: 14, hit2: 14, none: 0 }],   // 100% 🟢
    ['KS-B80',      { n: 100, hit1: 73, hit2: 90, none: 2 }],   // 73%  🟡
    ['KS-400B6',    { n: 50, hit1: 20, hit2: 35, none: 5 }],    // 40%  🔴
  ]);
  const byKey = new Map([
    ['KS-400B6||FRONT SHOE', { n: 50, hit1: 20, hit2: 35, none: 5 }], // 40% → critical worklist
    ['KVD-300CRII||CARRIER', { n: 14, hit1: 14, hit2: 14, none: 0 }],
  ]);
  const md = buildPmReport(byMachine, byKey, { generatedAt: '2026-06-28T00:00:00Z', sampleN: 164 });

  it('reports overall RED when any machine is 🔴', () => {
    expect(md).toContain('**Overall:** 🔴 RED');
    expect(md).toContain('**🟢 On-track:** 1 · **🟡 At-risk:** 1 · **🔴 Critical:** 1');
  });
  it('lists machines worst-first with their RAG and accuracy', () => {
    const b6 = md.indexOf('KS-400B6');
    const b80 = md.indexOf('KS-B80');
    const kvd = md.indexOf('| KVD-300CRII |');
    expect(b6).toBeGreaterThan(-1);
    expect(b6).toBeLessThan(b80);   // 40% before 73%
    expect(b80).toBeLessThan(kvd);  // 73% before 100%
    expect(md).toContain('| KVD-300CRII | 🟢 | 100.0% |');
  });
  it('includes a critical worklist of <60% tooling lines', () => {
    expect(md).toContain('🔴 Critical worklist');
    expect(md).toContain('| KS-400B6 | FRONT SHOE | 40.0% | 50 |');
    expect(md).not.toContain('CARRIER | '); // 100% tooling not in worklist
  });
});
