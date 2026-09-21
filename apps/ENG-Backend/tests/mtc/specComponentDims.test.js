'use strict';

const { buildComponentUpdates, syncComponentDims, COLUMNS } = require('../../api/engineer/mtc/services/specComponentDims');

const blank = (cn) => ({ cn, sph_od: null, sph_width: null, ball_dia: null, ball_width: null, ball_bore: null, race_od: null, race_width: null, ball_shoulder_dia: null });
const idx = (c) => COLUMNS.indexOf(c) + 1;   // position inside an update row (slot 0 is the cn)

function src(overrides = {}) {
  return {
    ctlByCn: new Map([['410082', 'A41-00082'], ['414303', 'A41-04303']]),
    sphByCtl: new Map([
      ['A41-00082', { control_no: 'A41-00082', sph_design_no: '0132' }],
      ['A41-04303', { control_no: 'A41-04303', sph_design_no: '1197' }],
    ]),
    designs: new Map([
      ['0132', { sph_design_cn: '0132', sph_od: '30.000', sph_width: '12.500', ball_sph_dia: '24.606', ball_width: '16.000', dall_id: '16.000' }],
      ['1197', { sph_design_cn: '1197', sph_od: '23.812', sph_width: '11.230', ball_sph_dia: '19.837', ball_width: '14.270', dall_id: '11.112' }],
    ]),
    kids: new Map([['A41-04303', ['C25-00010', 'C31-00020']]]),
    races: new Map([['C25-00010', { od: '26.9', width: '12.65' }]]),
    balls: new Map([['C31-00020', { shoulder_dia: '20.1' }]]),
    ...overrides,
  };
}

describe('buildComponentUpdates', () => {
  test('a suffix-below-1000 C/N (410082) is filled from its design', () => {
    const [u] = buildComponentUpdates([blank('410082')], src());
    expect(u[0]).toBe('410082');
    expect(u[idx('ball_width')]).toBe(16);
    expect(u[idx('sph_od')]).toBe(30);
    expect(u[idx('race_od')]).toBeNull();          // no race in the BOM -> left alone
  });

  test('race and Y-ball shoulder come from the BOM children', () => {
    const [u] = buildComponentUpdates([blank('414303')], src());
    expect(u[idx('race_od')]).toBe(26.9);
    expect(u[idx('race_width')]).toBe(12.65);
    expect(u[idx('ball_shoulder_dia')]).toBe(20.1);
  });

  test('a value already present is never overwritten', () => {
    const row = { ...blank('414303'), ball_dia: '19.9', race_od: '27' };
    const [u] = buildComponentUpdates([row], src());
    expect(u[idx('ball_dia')]).toBeNull();
    expect(u[idx('race_od')]).toBeNull();
    expect(u[idx('ball_width')]).toBe(14.27);
  });

  test('a row with no eng_sph match, or nothing to add, is skipped', () => {
    expect(buildComponentUpdates([blank('999999')], src())).toEqual([]);
    const full = { cn: '410082', sph_od: 30, sph_width: 12.5, ball_dia: 24.6, ball_width: 16, ball_bore: 16, race_od: 1, race_width: 1, ball_shoulder_dia: 1 };
    expect(buildComponentUpdates([full], src())).toEqual([]);
  });

  test('zero and non-numeric source values are treated as missing', () => {
    const s = src({ designs: new Map([['0132', { sph_od: '0', sph_width: 'x', ball_sph_dia: null, ball_width: '16', dall_id: '' }]]) });
    const [u] = buildComponentUpdates([blank('410082')], s);
    expect(u[idx('sph_od')]).toBeNull();
    expect(u[idx('sph_width')]).toBeNull();
    expect(u[idx('ball_width')]).toBe(16);
  });
});

describe('syncComponentDims', () => {
  test('non-SPH C/Ns are ignored without touching the database', async () => {
    const eng = { query: jest.fn() };
    const r = await syncComponentDims({ engPool: eng, maqPool: { query: jest.fn() } }, ['250010', '614033']);
    expect(r).toEqual({ target: 0, updated: 0 });
    expect(eng.query).not.toHaveBeenCalled();
  });

  test('nothing to fill -> one query, no factory reads', async () => {
    const eng = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const maq = { query: jest.fn() };
    expect(await syncComponentDims({ engPool: eng, maqPool: maq })).toEqual({ target: 0, updated: 0 });
    expect(eng.query).toHaveBeenCalledTimes(1);
    expect(maq.query).not.toHaveBeenCalled();
  });
});
