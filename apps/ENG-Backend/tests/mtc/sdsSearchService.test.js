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

  it('gives a SPHERICAL an (empty) component list, and every other type null', async () => {
    const maq = fakePool(), rodpc = fakePool();
    const sph = await searchByCn('A41-00001', maq, rodpc);
    expect(sph.part_type).toBe('SPHERICAL');
    expect(sph.components).toEqual({ ball: [], race: [], other: [] });   // no BOM → empty, not null
    expect((await searchByCn('C25-00235', fakePool(), fakePool())).components).toBeNull();
  });

  it('runs the SPHERICAL component query only for a SPHERICAL', async () => {
    const isComponentQuery = (c) => /ORDER BY b\.child_cn/i.test(c.sql);
    const sph = fakePool(), race = fakePool();
    await searchByCn('A41-00001', sph, fakePool());
    await searchByCn('C25-00235', race, fakePool());
    expect(sph.calls.some(isComponentQuery)).toBe(true);
    expect(race.calls.some(isComponentQuery)).toBe(false);
  });

  it('throws a clear error for an unknown CN prefix', async () => {
    const maq = fakePool(), rodpc = fakePool();
    await expect(searchByCn('824047', maq, rodpc)).rejects.toThrow(/Unknown CN prefix: C82/);
  });
});

describe('searchByCn — actual cycle time (feeds both the page and the PDF)', () => {
  // A pool that answers the planned-ct query and the actual-cycle-time query with fixed
  // rows, everything else empty — so the merge logic is exercised without a real DB.
  function pcPool({ planned = [], actual = [] } = {}) {
    const calls = [];
    return {
      calls,
      query: jest.fn((sql, params) => {
        calls.push({ sql, params });
        if (/FROM lpb\.eng_process_info/i.test(sql)) return Promise.resolve({ rows: planned });
        if (/DISTINCT ON \(process\)/i.test(sql)) return Promise.resolve({ rows: actual });
        return Promise.resolve({ rows: [] });
      }),
    };
  }

  it('attaches the latest-non-zero actual value beside the planned one, keyed by process', async () => {
    const maq = pcPool({
      planned: [{ process_code: '1011', ct: '' }],   // plan is blank, as it often is
      actual: [{ process: '1011', lot_no: 'T9051T6', cycle_time: '200.00', last_date: '2026-08-20' }],
    });
    const out = await searchByCn('C25-00235', maq, fakePool());
    const row = out.process_info.find((r) => r.process_code === '1011');
    expect(row.ct).toBe('');                 // the plan, untouched
    expect(row.actual_ct).toBe(200);          // the real lot
    expect(row.actual_ct_lot).toBe('T9051T6');
  });

  it('is null (not undefined or 0) on a process no lot ever recorded', async () => {
    const maq = pcPool({ planned: [{ process_code: '3091', ct: '' }], actual: [] });
    const out = await searchByCn('C25-00235', maq, fakePool());
    expect(out.process_info[0].actual_ct).toBeNull();
  });

  it('queries pc_production by the canonical CN the rest of the search already resolved', async () => {
    const maq = pcPool();
    await searchByCn('250235', maq, fakePool());   // 6-digit item-no form
    const call = maq.calls.find((c) => /DISTINCT ON \(process\)/i.test(c.sql));
    expect(call.params).toEqual(['250235']);        // fetchLatestActualCycleTime does its own toItemNo
  });
});
