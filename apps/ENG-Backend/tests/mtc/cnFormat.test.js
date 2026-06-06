'use strict';

const cnFormat = require('../../api/engineer/mtc/utils/cnFormat');

describe('cnFormat.toItemNo', () => {
  it('passes through a 6-digit item number', () => {
    expect(cnFormat.toItemNo('250235')).toBe('250235');
  });
  it('converts canonical control no (5-digit suffix)', () => {
    expect(cnFormat.toItemNo('C25-00235')).toBe('250235');
  });
  it('converts short control no (4-digit suffix typed by user)', () => {
    expect(cnFormat.toItemNo('C25-0235')).toBe('250235');
  });
  it('strips a trailing -C suffix (pc_production)', () => {
    expect(cnFormat.toItemNo('350528-C')).toBe('350528');
  });
  it('is case-insensitive and trims', () => {
    expect(cnFormat.toItemNo('  c25-00235 ')).toBe('250235');
  });
  it('returns null for unrecognized input', () => {
    expect(cnFormat.toItemNo('garbage')).toBeNull();
    expect(cnFormat.toItemNo('')).toBeNull();
    expect(cnFormat.toItemNo(null)).toBeNull();
  });
});

describe('cnFormat.toControlNo', () => {
  it('builds canonical Cxx-0YYYY from a 6-digit item number', () => {
    expect(cnFormat.toControlNo('250235')).toBe('C25-00235');
  });
  it('normalizes a 4-digit suffix to 5-digit', () => {
    expect(cnFormat.toControlNo('C25-0235')).toBe('C25-00235');
  });
  it('uses prefix A for spherical class 41-49', () => {
    expect(cnFormat.toControlNo('410001')).toBe('A41-00001');
    expect(cnFormat.toControlNo('490001')).toBe('A49-00001');
  });
  it('uses prefix C outside 41-49 (incl. mecha 9x)', () => {
    expect(cnFormat.toControlNo('350528')).toBe('C35-00528');
    expect(cnFormat.toControlNo('910001')).toBe('C91-00001');
  });
  it('handles trailing -C suffix', () => {
    expect(cnFormat.toControlNo('350528-C')).toBe('C35-00528');
  });
  it('returns null for unrecognized input', () => {
    expect(cnFormat.toControlNo('nope')).toBeNull();
  });
});

describe('cnFormat.toSpecCn', () => {
  it('is the 6-digit item-number form', () => {
    expect(cnFormat.toSpecCn('C25-00235')).toBe('250235');
    expect(cnFormat.toSpecCn('250235')).toBe('250235');
  });
});

describe('cnFormat backward-compat alias', () => {
  it('itemNoToCN matches itemNoToControlNo', () => {
    expect(cnFormat.itemNoToCN('250235')).toBe('C25-00235');
    expect(cnFormat.itemNoToCN('250235')).toBe(cnFormat.itemNoToControlNo('250235'));
  });
  it('itemNoToControlNo rejects non-6-digit input', () => {
    expect(cnFormat.itemNoToControlNo('C25-00235')).toBeNull();
  });
});

// Round-trip parity: the three legacy call sites must agree on the same CN.
describe('cnFormat round-trip parity', () => {
  const samples = ['250235', 'C25-00235', 'C25-0235', '350528-C'];
  it('controlNo → specCn → controlNo is stable', () => {
    for (const s of samples) {
      const ctrl = cnFormat.toControlNo(s);
      const spec = cnFormat.toSpecCn(ctrl);
      expect(cnFormat.toControlNo(spec)).toBe(ctrl);
    }
  });
});
