'use strict';

const { fetchPartMaterials, shapeMaterial, sheetMaterial } = require('../../api/engineer/mtc/services/partMaterial');

const fakePool = (rows) => {
  const calls = [];
  return { calls, query: jest.fn((sql, params) => { calls.push({ sql, params }); return Promise.resolve({ rows }); }) };
};

describe('shapeMaterial', () => {
  it('builds the SDS material object from a result row', () => {
    expect(shapeMaterial({
      item_cn: 'PM1-02487', item_pn: '10BA001905',
      as400name: '410 (AMS5613)', mate_code: 'M4A', procument_spec: 'AMS5613',
    })).toEqual({
      material: '410 (AMS5613)', mate_code: 'M4A', procument_spec: 'AMS5613',
      raw_control_no: 'PM1-02487', raw_parts_no: '10BA001905',
    });
  });

  it('is null when the BOM child has no eng_item row (nothing to report)', () => {
    expect(shapeMaterial({ item_cn: null, as400name: 'X' })).toBeNull();
    expect(shapeMaterial(null)).toBeNull();
    expect(shapeMaterial(undefined)).toBeNull();
  });

  it('keeps the raw part but nulls the grade when eng_mcode has no match', () => {
    const m = shapeMaterial({ item_cn: 'C82-00009', item_pn: '7ABT3-01', as400name: null });
    expect(m.material).toBeNull();
    expect(m.raw_control_no).toBe('C82-00009');
  });
});

describe('sheetMaterial — what the sheet prints in Material', () => {
  const own = { material: '440C (AMS5630/QQ-S-763)' };

  it('prints the part\'s own grade for anything that is not a spherical', () => {
    expect(sheetMaterial(own, null)).toBe('440C (AMS5630/QQ-S-763)');
  });

  it('is null when a non-spherical has no material', () => {
    expect(sheetMaterial(null, null)).toBeNull();
    expect(sheetMaterial({ material: null }, null)).toBeNull();
  });

  it('prints the RACE grade for a spherical, ignoring the ball', () => {
    const c = { ball: [{ material: '440C' }], race: [{ material: '410 (AMS5613)' }] };
    expect(sheetMaterial({ material: null }, c)).toBe('410 (AMS5613)');
  });

  it('joins distinct grades when a spherical has several races, once each', () => {
    const c = { race: [{ material: '410' }, { material: '17-4PH' }, { material: '410' }] };
    expect(sheetMaterial(null, c)).toBe('410 / 17-4PH');
  });

  it('is null (not the ball\'s grade) when the race has none or the BOM is empty', () => {
    expect(sheetMaterial(null, { ball: [{ material: '440C' }], race: [{ material: null }] })).toBeNull();
    expect(sheetMaterial(null, { ball: [], race: [], other: [] })).toBeNull();
  });

  it('does not let a spherical fall back to its own raw-material object', () => {
    // SPH's own `material` object exists (raw_control_no = a BOM child) but has no grade; the
    // components branch must win even when the race grade is absent.
    expect(sheetMaterial({ material: 'SHOULD-NOT-PRINT' }, { race: [] })).toBeNull();
  });
});

describe('fetchPartMaterials', () => {
  it('asks once for every distinct CN and maps each result by part_cn', async () => {
    const pool = fakePool([
      { part_cn: 'C23-00023', item_cn: 'PM1-02487', item_pn: '10BA001905', as400name: '410 (AMS5613)' },
      { part_cn: 'C31-00016', item_cn: null },
    ]);
    const out = await fetchPartMaterials(pool, ['C23-00023', 'C31-00016', 'C23-00023', '', null]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.calls[0].params).toEqual([['C23-00023', 'C31-00016']]);   // deduped, blanks dropped
    expect(out.get('C23-00023').material).toBe('410 (AMS5613)');
    expect(out.get('C31-00016')).toBeNull();
  });

  it('prefers the PM (raw-material) child over any other BOM child', async () => {
    const pool = fakePool([]);
    await fetchPartMaterials(pool, ['C23-00023']);
    // the race's TFE liner (C82-) must not win just because it sorts first
    expect(pool.calls[0].sql).toMatch(/ORDER BY \(child_cn LIKE 'PM%'\) DESC, child_cn/);
  });

  it('returns null entries (not a throw) when nothing comes back', async () => {
    const out = await fetchPartMaterials(fakePool([]), ['C23-00023']);
    expect(out.get('C23-00023')).toBeNull();
  });

  it('does not query at all for no CNs', async () => {
    const pool = fakePool([]);
    const out = await fetchPartMaterials(pool, []);
    expect(pool.query).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });
});
