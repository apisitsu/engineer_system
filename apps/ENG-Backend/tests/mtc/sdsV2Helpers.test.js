'use strict';

const {
  colLetterToIndex,
  cellAddressToRC,
  cellAddressTo0Based,
} = require('../../api/engineer/mtc/utils/excelHelpers');

// ── colLetterToIndex ──────────────────────────────────────────────────────────

describe('colLetterToIndex', () => {
  test.each([
    ['A', 1],
    ['B', 2],
    ['Z', 26],
    ['AA', 27],
    ['AB', 28],
    ['AO', 41],
    ['AZ', 52],
    ['BA', 53],
  ])('%s → %i', (input, expected) => {
    expect(colLetterToIndex(input)).toBe(expected);
  });

  test('is case-insensitive', () => {
    expect(colLetterToIndex('a')).toBe(1);
    expect(colLetterToIndex('aa')).toBe(27);
  });
});

// ── cellAddressToRC ───────────────────────────────────────────────────────────

describe('cellAddressToRC', () => {
  test.each([
    ['A1', { col: 1, row: 1 }],
    ['B3', { col: 2, row: 3 }],
    ['Z10', { col: 26, row: 10 }],
    ['AA1', { col: 27, row: 1 }],
    ['K18', { col: 11, row: 18 }],
    ['AN23', { col: 40, row: 23 }],
  ])('%s → %o', (addr, expected) => {
    expect(cellAddressToRC(addr)).toEqual(expected);
  });

  test('returns null for invalid address', () => {
    expect(cellAddressToRC('123')).toBeNull();
    expect(cellAddressToRC('')).toBeNull();
    expect(cellAddressToRC('A')).toBeNull();
  });
});

// ── cellAddressTo0Based ───────────────────────────────────────────────────────

describe('cellAddressTo0Based', () => {
  test.each([
    ['A1', { col: 0, row: 0 }],
    ['B3', { col: 1, row: 2 }],
    ['K18', { col: 10, row: 17 }],
  ])('%s → %o (0-based)', (addr, expected) => {
    expect(cellAddressTo0Based(addr)).toEqual(expected);
  });

  test('returns null for invalid address', () => {
    expect(cellAddressTo0Based('bad')).toBeNull();
  });
});
