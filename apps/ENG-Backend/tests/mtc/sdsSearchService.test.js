'use strict';

// searchByCn takes maqPool / rodpcPool as arguments, so no module mocking is
// needed — inject fakes that resolve every query to an empty rowset. These tests
// pin the CN normalization + part-type routing contract (the bug class fixed in
// 2026-05: raw "C25-0235" silently returning 0 rows / "Unknown CN prefix").

const { searchByCn } = require('../../api/engineer/mtc/services/sdsV2SearchService');

// A pool whose every query returns no rows; records the SQL it was asked to run.
function fakePool() {
  const calls = [];
  return {
    calls,
    query: jest.fn((sql, params) => { calls.push({ sql, params }); return Promise.resolve({ rows: [] }); }),
  };
}

describe('searchByCn — CN normalization & routing', () => {
  it('normalizes a 6-digit item_no to canonical control_no and routes BALL', async () => {
    const maq = fakePool(), rodpc = fakePool();
    const out = await searchByCn('314047', maq, rodpc);
    expect(out.cn).toBe('C31-04047');     // 6-digit → Cxx-0YYYY
    expect(out.item_no).toBe('314047');
    expect(out.part_type).toBe('BALL');
    expect(out.dimension).toBeNull();      // empty rowset → null, not undefined/throw
    // dimension query must use the canonical control_no, never the raw input
    const dimCall = maq.calls.find(c => /eng_ball/i.test(c.sql));
    expect(dimCall.params).toEqual(['C31-04047']);
  });

  it('accepts an already-canonical control_no and routes RACE', async () => {
    const maq = fakePool(), rodpc = fakePool();
    const out = await searchByCn('C25-00235', maq, rodpc);
    expect(out.cn).toBe('C25-00235');
    expect(out.part_type).toBe('RACE');
  });

  it('accepts a short 4-digit suffix (the 2026-05 silent-fail case)', async () => {
    const maq = fakePool(), rodpc = fakePool();
    const out = await searchByCn('C25-0235', maq, rodpc);
    expect(out.cn).toBe('C25-00235');      // reshaped to 5-digit suffix
    expect(out.part_type).toBe('RACE');
  });

  it('routes mecha C9x with NO dimension table and does not throw', async () => {
    const maq = fakePool(), rodpc = fakePool();
    const out = await searchByCn('954047', maq, rodpc);
    expect(out.part_type).toBe('MECHA');
    expect(out.dimension).toBeNull();
    // no dimension query should have been issued for the (table-less) mecha part
    expect(maq.calls.some(c => /eng_ball|eng_race|eng_body|eng_sleeve|eng_sph/i.test(c.sql))).toBe(false);
  });

  it('throws a clear error for an unknown CN prefix', async () => {
    const maq = fakePool(), rodpc = fakePool();
    await expect(searchByCn('824047', maq, rodpc)).rejects.toThrow(/Unknown CN prefix: C82/);
  });
});
