'use strict';

// The grid renderer mimics Excel: an unwrapped value spills across its neighbours — but
// only while those neighbours are EMPTY, and the first occupied cell stops it. The renderer
// only had the first half of that rule (`overflow:visible` on every non-wrap cell), so a
// long fixture name ran over the next slot's T-badge and its name. Reported from the floor
// on X-100 T01 `CONCENTRICITY MEASURING PIN(FOR SPH)` printing on top of `T02 ARBOR`.
jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));
jest.mock('../../instance/instance', () => ({ pool: { query: jest.fn() } }));

const { buildGridPdfHtml } = require('../../api/engineer/mtc/controllers/sdsV2HeadlessController');

// 6 columns of 50 editor-px each. `scale` is PAGE_W_MM / sumW, so one column is
// 287/6 ≈ 47.833mm — the exact number does not matter, only the ratios between cells.
const COL_PX = 50;
const grid = (cells, opts = {}) => ({
  rows: 1,
  cols: 6,
  colW: Array(6).fill(COL_PX),
  rowH: [22],
  borders: {},
  fills: {},
  cells,
  merges: opts.merges || [],
});

// Every capped cell renders as an inline-block carrying its ceiling in mm.
const caps = (html) => {
  const out = [];
  const re = /<span style="display:inline-block;max-width:([\d.]+)mm;[^"]*">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) out.push({ mm: Number(m[1]), text: m[2] });
  return out;
};
const capOf = (html, text) => (caps(html).find((c) => c.text === text) || {}).mm;

describe('grid cell spill — bounded by the first occupied neighbour', () => {
  const ONE_COL = 287 / 6;

  it('caps a value at its own width when the next cell is occupied', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'CONCENTRICITY MEASURING PIN' },
      '0,1': { v: 'T02' },
    }));
    expect(capOf(html, 'CONCENTRICITY MEASURING PIN')).toBeCloseTo(ONE_COL, 2);
  });

  it('extends the cap across CONSECUTIVE empty neighbours', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'LONG NAME' },
      '0,3': { v: 'STOP' },       // 0,1 and 0,2 are free
    }));
    expect(capOf(html, 'LONG NAME')).toBeCloseTo(ONE_COL * 3, 2);
  });

  it('runs to the sheet edge when nothing occupies the rest of the row', () => {
    const html = buildGridPdfHtml(grid({ '0,0': { v: 'ALONE' } }));
    expect(capOf(html, 'ALONE')).toBeCloseTo(ONE_COL * 6, 2);
  });

  it('treats an IMAGE cell as occupied, not as free space', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'NAME' },
      '0,1': { img: 'data:image/png;base64,AAAA' },
    }));
    expect(capOf(html, 'NAME')).toBeCloseTo(ONE_COL, 2);
  });

  it('treats a whitespace-only value as EMPTY (Excel does)', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'NAME' },
      '0,1': { v: '   ' },
      '0,2': { v: 'STOP' },
    }));
    expect(capOf(html, 'NAME')).toBeCloseTo(ONE_COL * 2, 2);
  });

  it('measures a merged cell from its LAST column, not its first', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'MERGED' },
      '0,3': { v: 'STOP' },
    }, { merges: [{ r1: 0, c1: 0, r2: 0, c2: 1 }] }));
    // own 2 columns + the one free column before STOP
    expect(capOf(html, 'MERGED')).toBeCloseTo(ONE_COL * 3, 2);
  });

  it('a cell COVERED by a merge counts as occupied', () => {
    const html = buildGridPdfHtml(grid({
      '0,0': { v: 'NAME' },
      '0,1': { v: 'BLOCK' },
    }, { merges: [{ r1: 0, c1: 1, r2: 0, c2: 3 }] }));
    expect(capOf(html, 'NAME')).toBeCloseTo(ONE_COL, 2);
  });

  it('spills LEFT for a right-aligned value', () => {
    const html = buildGridPdfHtml(grid({
      '0,3': { v: 'RIGHT', a: { h: 'right' } },
      '0,1': { v: 'STOP' },
    }));
    // own column + the free 0,2 to its left; must NOT count the empty cells to its right
    expect(capOf(html, 'RIGHT')).toBeCloseTo(ONE_COL * 2, 2);
  });

  it('spills BOTH ways for a centered value', () => {
    const html = buildGridPdfHtml(grid({
      '0,2': { v: 'MID', a: { h: 'center' } },
      '0,0': { v: 'L' },
      '0,4': { v: 'R' },
    }));
    expect(capOf(html, 'MID')).toBeCloseTo(ONE_COL * 3, 2);
  });

  it('leaves a WRAPPING cell alone — it clips inside its own box already', () => {
    const html = buildGridPdfHtml(grid({ '0,0': { v: 'WRAPPED', a: { wrap: true } } }));
    expect(caps(html)).toHaveLength(0);
    expect(html).toContain('white-space:normal');
  });

  it('marks a clipped value with an ellipsis so a cut reads as a cut', () => {
    const html = buildGridPdfHtml(grid({ '0,0': { v: 'NAME' }, '0,1': { v: 'STOP' } }));
    expect(html).toContain('text-overflow:ellipsis');
  });

  it('keeps the td itself overflow:visible so a fitting spill still shows', () => {
    const html = buildGridPdfHtml(grid({ '0,0': { v: 'NAME' } }));
    expect(html).toContain('overflow:visible');
  });

  it('emits no cap span for an empty cell', () => {
    const html = buildGridPdfHtml(grid({ '0,0': { v: '' }, '0,1': {} }));
    expect(caps(html)).toHaveLength(0);
  });
});
