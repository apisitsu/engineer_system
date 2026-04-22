'use strict';

/** 'A' → 1, 'Z' → 26, 'AA' → 27, 'AO' → 41 (1-based) */
function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 'B3' → { col: 2, row: 3 } (1-based, matches ExcelJS getCell) */
function cellAddressToRC(addr) {
  const m = addr.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2]) };
}

/** 'B3' → { col: 1, row: 2 } (0-based for ExcelJS addImage tl/br) */
function cellAddressTo0Based(addr) {
  const rc = cellAddressToRC(addr);
  if (!rc) return null;
  return { col: rc.col - 1, row: rc.row - 1 };
}

module.exports = { colLetterToIndex, cellAddressToRC, cellAddressTo0Based };
