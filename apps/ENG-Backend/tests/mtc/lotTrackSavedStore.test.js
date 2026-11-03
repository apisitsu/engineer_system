'use strict';

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const store = require('../../api/engineer/mtc/lot_track/savedStore');

const lots = (n, prefix = 'T') => Array.from({ length: n }, (_, i) => ({ lotNo: `${prefix}${i + 1}`, controlNo: null }));
const insertCalls = () => engPool.query.mock.calls.filter(([sql]) => /INSERT INTO lot_track_saved/.test(sql));
const updateCalls = () => engPool.query.mock.calls.filter(([sql]) => /UPDATE lot_track_saved/.test(sql));

beforeEach(() => {
  engPool.query.mockReset();
  engPool.query.mockResolvedValue({ rows: [{ id: 1, empno: 'LE485', name: 'x', lots: [], updated_at: new Date() }], rowCount: 1 });
});

describe('saved-track lot cap', () => {
  it('is 50', () => {
    expect(store.MAX_LOTS).toBe(50);
  });

  it('saves exactly 50 lots', async () => {
    await store.createSaved('LE485', 'x', lots(50));
    expect(JSON.parse(insertCalls()[0][1][2])).toHaveLength(50);
  });

  it('refuses 51 lots on create instead of silently dropping the 51st', async () => {
    await expect(store.createSaved('LE485', 'x', lots(51))).rejects.toMatchObject({ code: 'too_many_lots', max: 50, count: 51 });
    expect(insertCalls()).toHaveLength(0);
  });

  it('refuses 51 lots on update and never writes', async () => {
    await expect(store.updateSaved('LE485', 2, { lots: lots(51) })).rejects.toMatchObject({ code: 'too_many_lots' });
    expect(updateCalls()).toHaveLength(0);
  });

  it('counts a lot once however often it is listed — duplicates do not eat the cap', async () => {
    const raw = [...lots(50), { lotNo: 't1', controlNo: null }, { lotNo: 'T2', controlNo: '' }];
    await store.createSaved('LE485', 'x', raw);
    expect(JSON.parse(insertCalls()[0][1][2])).toHaveLength(50);
  });

  it('an update that does not touch lots (rename only) is never refused', async () => {
    await store.updateSaved('LE485', 2, { name: 'renamed' });
    expect(updateCalls()).toHaveLength(1);
  });

  it('the error message says how many and what to do', async () => {
    await expect(store.createSaved('LE485', 'x', lots(61))).rejects.toThrow(/at most 50 lots \(this one has 61\)/);
  });
});
