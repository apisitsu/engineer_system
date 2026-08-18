'use strict';

const noJigRule = require('../../api/engineer/mtc/services/noJigRule');

describe('noJigRule — surface grind (1101/1102) needs no fixture above the size threshold', () => {
  describe('appliesTo', () => {
    it('matches the three surface grinders by machine alone (Tooling Select has no process code)', () => {
      for (const m of ['PSG-64', 'GS-64PFII', 'MSG-410']) {
        expect(noJigRule.appliesTo({ machineName: m })).toBe(true);
      }
    });

    it('matches 1101 / 1102 by process code alone', () => {
      expect(noJigRule.appliesTo({ processCode: '1101' })).toBe(true);
      expect(noJigRule.appliesTo({ processCode: '1102' })).toBe(true);
      expect(noJigRule.appliesTo({ processCode: 1102 })).toBe(true);   // numeric tolerated
    });

    it('rejects any other machine or process', () => {
      expect(noJigRule.appliesTo({ machineName: 'KS-B22G' })).toBe(false);
      expect(noJigRule.appliesTo({ processCode: '1161' })).toBe(false);
      expect(noJigRule.appliesTo({ processCode: '110' })).toBe(false);
      expect(noJigRule.appliesTo({ processCode: '11011' })).toBe(false);
    });

    it('requires EVERY supplied identifier to match — a right machine on a wrong process is out', () => {
      expect(noJigRule.appliesTo({ machineName: 'PSG-64', processCode: '1101' })).toBe(true);
      expect(noJigRule.appliesTo({ machineName: 'PSG-64', processCode: '1161' })).toBe(false);
      expect(noJigRule.appliesTo({ machineName: 'KS-B22G', processCode: '1101' })).toBe(false);
    });

    it('with nothing supplied it governs nothing (never fires by default)', () => {
      expect(noJigRule.appliesTo({})).toBe(false);
      expect(noJigRule.appliesTo()).toBe(false);
      expect(noJigRule.appliesTo({ machineName: '', processCode: null })).toBe(false);
    });
  });

  describe('exceedsSize — OD > 40 or W > 38, strictly greater', () => {
    it('fires above either bound', () => {
      expect(noJigRule.exceedsSize({ OD: 40.01, W: 5 })).toBe(true);
      expect(noJigRule.exceedsSize({ OD: 10, W: 38.01 })).toBe(true);
      expect(noJigRule.exceedsSize({ OD: 60, W: 50 })).toBe(true);
    });

    it('does NOT fire exactly on the bound', () => {
      expect(noJigRule.exceedsSize({ OD: 40, W: 38 })).toBe(false);
    });

    it('does not fire below both bounds', () => {
      expect(noJigRule.exceedsSize({ OD: 22.5, W: 9.9 })).toBe(false);
    });

    it('a part with no dimensions is not "no jig required"', () => {
      // buildSpecContext yields 0 for an absent dimension. 0 > 40 is false, so the
      // part falls through to the normal tooling search instead of being reported
      // as needing no fixture.
      expect(noJigRule.exceedsSize({ OD: 0, W: 0 })).toBe(false);
      expect(noJigRule.exceedsSize({})).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('returns the reason naming which bound was crossed', () => {
      const r = noJigRule.evaluate({ machineName: 'PSG-64', processCode: '1101', ctx: { OD: 45, W: 10 } });
      expect(r.noJig).toBe(true);
      expect(r.reason).toContain('No jig required');
      expect(r.reason).toContain('OD=45 > 40');
      expect(r.reason).not.toContain('W=');
    });

    it('names both bounds when both are crossed', () => {
      const r = noJigRule.evaluate({ machineName: 'MSG-410', ctx: { OD: 45, W: 39 } });
      expect(r.reason).toContain('OD=45 > 40');
      expect(r.reason).toContain('W=39 > 38');
    });

    it('is false — with no reason — for an in-range part on a governed machine', () => {
      expect(noJigRule.evaluate({ machineName: 'PSG-64', ctx: { OD: 22, W: 8 } }))
        .toEqual({ noJig: false, reason: null });
    });

    it('is false for a large part on a machine the rule does not govern', () => {
      // A 60 mm ball on a grinder that is not a surface grinder still needs its fixture.
      expect(noJigRule.evaluate({ machineName: 'KS-B22G', ctx: { OD: 60, W: 50 } }).noJig).toBe(false);
    });
  });
});
