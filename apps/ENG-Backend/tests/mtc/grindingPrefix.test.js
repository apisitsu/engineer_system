'use strict';

// Unit tests for utils/grindingPrefix — the CN targeting rules for grinding layout
// images (sds_grinding_image.cn_prefixes).
//
// Why this is pinned: a target that VALIDATES but never MATCHES is the worst failure
// mode here — no error anywhere, just a blank picture on the setup sheet for ever.
// The module already documents the "6-digit item-no" spelling of that trap; these
// tests pin the sibling spelling — a control-no typed with a SHORT 4-digit suffix
// ('C39-4137' instead of the canonical 'C39-04137') — on both sides:
//   (a) writes normalise it to the canonical form (normalizeTarget),
//   (b) render-time lookup still matches a row already stored the short way
//       (cnMatchKeys emits the short spelling too), no data migration needed.

const {
  normalizeTarget, prefixLevel, cnMatchKeys, prefixMatchesCn,
} = require('../../api/engineer/mtc/utils/grindingPrefix');

describe('normalizeTarget — canonicalises what the user types', () => {
  test('6-digit item-no → control-no (documented case, kept as a guard)', () => {
    expect(normalizeTarget('394137')).toBe('C39-04137');
  });

  test('short 4-digit-suffix control-no → canonical 5-digit form', () => {
    expect(normalizeTarget('C39-4137')).toBe('C39-04137');
    expect(normalizeTarget('a41-0045')).toBe('A41-00045'); // also upper-cases
  });

  test('already-canonical and prefix targets pass through untouched', () => {
    expect(normalizeTarget('C39-04137')).toBe('C39-04137');
    expect(normalizeTarget('C39')).toBe('C39');
    expect(normalizeTarget('C3')).toBe('C3');
  });
});

describe('prefixLevel — a short-suffix control-no is still a CN target', () => {
  test('short and canonical both read as level "cn"', () => {
    expect(prefixLevel('C39-4137')).toBe('cn');
    expect(prefixLevel('C39-04137')).toBe('cn');
  });
});

describe('cnMatchKeys — render-time lookup tolerates the short spelling', () => {
  test('keys for a canonical CN include the short 4-digit-suffix form', () => {
    const { keys } = cnMatchKeys('C39-04137');
    expect(keys).toEqual(expect.arrayContaining(['C39-04137', '394137', 'C39-4137', 'C39', 'C3']));
  });

  test('a row stored the short way still matches the part at render time', () => {
    // Renderer only ever holds the canonical control-no; the stored target is 'C39-4137'.
    expect(prefixMatchesCn('C39-4137', 'C39-04137')).toBe(true);
  });

  test('fixed shape is preserved for a bare family / class prefix', () => {
    expect(cnMatchKeys('C39')).toMatchObject({ exact: [], family: 'C39', klass: 'C3' });
    expect(cnMatchKeys('C3')).toMatchObject({ exact: [], family: null, klass: 'C3' });
  });
});
