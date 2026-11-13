import { sortLots, LOT_SORTS } from './lotTrackSort';

const ok = (lotNo, pct, plan, extra = {}) => ({
  status: 'ok',
  data: {
    header: { lotNo, compPlanDate: plan, entryDate: extra.issued ?? null },
    summary: { pctComplete: pct, remainingSteps: extra.remaining ?? 0 },
    lotUpdatedAt: extra.moved ?? null,
  },
});

const entries = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];
const state = {
  a: ok('LOT10', 40, '2026-11-20'),
  b: ok('LOT2', 90, '2026-11-15'),
  c: { status: 'loading' },
  d: ok('LOT3', 10, null),
};
const keys = (list) => list.map((e) => e.key);

describe('sortLots', () => {
  it('keeps the order added by default, and reverses it on desc', () => {
    expect(keys(sortLots(entries, state))).toEqual(['a', 'b', 'c', 'd']);
    expect(keys(sortLots(entries, state, 'added', 'desc'))).toEqual(['d', 'c', 'b', 'a']);
  });

  it('sorts by progress either way, with lots not yet loaded last', () => {
    expect(keys(sortLots(entries, state, 'pct', 'asc'))).toEqual(['d', 'a', 'b', 'c']);
    expect(keys(sortLots(entries, state, 'pct', 'desc'))).toEqual(['b', 'a', 'd', 'c']);
  });

  it('sorts by plan finish; lots with no date (or not loaded) follow, as added', () => {
    expect(keys(sortLots(entries, state, 'due', 'asc'))).toEqual(['b', 'a', 'c', 'd']);
    expect(keys(sortLots(entries, state, 'due', 'desc'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts lot numbers naturally (LOT2 before LOT10)', () => {
    expect(keys(sortLots(entries, state, 'lot', 'asc'))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('does not change the list it is given', () => {
    const copy = [...entries];
    sortLots(entries, state, 'pct', 'desc');
    expect(entries).toEqual(copy);
  });

  it('every sort has a label', () => {
    Object.values(LOT_SORTS).forEach((s) => expect(s.label).toBeTruthy());
  });
});
