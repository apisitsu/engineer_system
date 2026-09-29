'use strict';

const { groupBomChildren } = require('../../api/engineer/mtc/utils/bomComponents');

describe('groupBomChildren', () => {
  it('splits a spherical BOM into ball and race', () => {
    const g = groupBomChildren([
      { child_cn: 'C23-00023', child_pn: '2ABT3-T', qty: '1' },
      { child_cn: 'C31-00016', child_pn: '3ABT3-T', qty: '1' },
    ]);
    expect(g.race).toEqual([{ cn: 'C23-00023', pn: '2ABT3-T', name: null, qty: 1 }]);
    expect(g.ball).toEqual([{ cn: 'C31-00016', pn: '3ABT3-T', name: null, qty: 1 }]);
    expect(g.other).toEqual([]);
  });

  it('classifies every ball and race family, not just C23 / C31', () => {
    const g = groupBomChildren([
      { child_cn: 'C21-00001' }, { child_cn: 'C29-00001' },
      { child_cn: 'C32-00001' }, { child_cn: 'C35-00001' }, { child_cn: 'C39-00001' },
    ]);
    expect(g.race.map((x) => x.cn)).toEqual(['C21-00001', 'C29-00001']);
    expect(g.ball.map((x) => x.cn)).toEqual(['C32-00001', 'C35-00001', 'C39-00001']);
  });

  it('keeps seals, liners, retainers and PM stock out of ball/race', () => {
    const g = groupBomChildren([
      { child_cn: 'C23-00023' }, { child_cn: 'C31-00016' },
      { child_cn: 'C86-00010' }, { child_cn: 'C89-00008' }, { child_cn: 'SM8-00019' },
    ]);
    expect(g.other.map((x) => x.cn)).toEqual(['C86-00010', 'C89-00008', 'SM8-00019']);
    expect(g.ball).toHaveLength(1);
    expect(g.race).toHaveLength(1);
  });

  it('files an unrecognised child under other instead of dropping it', () => {
    expect(groupBomChildren([{ child_cn: 'ZZZ-1' }]).other).toHaveLength(1);
  });

  it('returns empty buckets for no BOM (null, undefined, [])', () => {
    for (const input of [null, undefined, []]) {
      expect(groupBomChildren(input)).toEqual({ ball: [], race: [], other: [] });
    }
  });

  it('lists every member when a bucket holds more than one, sorted by cn', () => {
    const g = groupBomChildren([{ child_cn: 'C25-00900' }, { child_cn: 'C25-00100' }]);
    expect(g.race.map((x) => x.cn)).toEqual(['C25-00100', 'C25-00900']);
  });

  it('tidies name and qty: trims blanks to null, non-numeric qty to null', () => {
    const [r] = groupBomChildren([{ child_cn: 'C23-00023', parts_name: '  ', qty: 'abc' }]).race;
    expect(r.name).toBeNull();
    expect(r.qty).toBeNull();
    expect(groupBomChildren([{ child_cn: 'C23-00023', parts_name: ' OUTER RING ' }]).race[0].name).toBe('OUTER RING');
  });

  it('skips rows with no child_cn', () => {
    expect(groupBomChildren([{ child_cn: '' }, {}, null])).toEqual({ ball: [], race: [], other: [] });
  });
});
