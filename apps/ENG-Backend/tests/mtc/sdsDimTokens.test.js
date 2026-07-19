'use strict';

// Unit tests for {{dim.*}} token resolution in the SDS grid PDF pipeline
// (partDimAlias.resolvePartDims + applyDataToGrid).
//
// Why this is pinned: a part-dimension cell (WORK OUT DIA, WORK WIDTH, ...) that stores a
// literal number becomes a machine-wide constant and prints the SAME value on every CN's
// setup sheet. A survey of live data found 732 cells flagged as per-part values but only
// 76 with any per-CN value — i.e. ~90% were printing another part's dimensions. The token
// path replaces that with the part's own factory dims.
//
// The failure mode that matters most is a SILENT one: a token that resolves to a stale or
// wrong-class dimension looks entirely plausible on paper. So the tests below pin
//   (a) each part class reads its OWN column (ball_dia vs od vs sph_od),
//   (b) a class with no such column yields BLANK, never a fallback to another dimension,
//   (c) an unresolved token never leaks the literal "{{dim.OD}}" onto the sheet.
//
// applyDataToGrid is pure, but the controller pulls in DB pools at require time — mock the
// instance pools (same pattern as sdsFixtureSlot.test.js) so the require is hermetic.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() }, default: {} }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));
jest.mock('../../instance/instance', () => ({ pool: { query: jest.fn() } }));

const ctrl = require('../../api/engineer/mtc/controllers/sdsV2HeadlessController');
const { resolvePartDims, PART_DIM_ALIAS } = require('../../api/engineer/mtc/utils/partDimAlias');

// ── partDimAlias.resolvePartDims ────────────────────────────────────────────

describe('resolvePartDims — per-class column aliasing', () => {
  // Real rows from lpb (KN-312A CNs 320034 / 350698), shaped as SELECT * returns them.
  test('BALL reads ball_dia / in_dia / width', () => {
    expect(resolvePartDims('BALL', { ball_dia: '47.625', in_dia: '25', width: '35' }))
      .toMatchObject({ OD: 47.625, ID: 25, W: 35 });
  });

  test('RACE reads od / id / width', () => {
    expect(resolvePartDims('RACE', { od: '62.1', id: '40', width: '12.5' }))
      .toMatchObject({ OD: 62.1, ID: 40, W: 12.5 });
  });

  test('SLEEVE takes W from full_length, not width', () => {
    expect(resolvePartDims('SLEEVE', { od: '30', id: '20', full_length: '45', width: '999' }))
      .toMatchObject({ OD: 30, ID: 20, W: 45 });
  });

  test('SPHERICAL reads the joined eng_sph_design columns', () => {
    expect(resolvePartDims('SPHERICAL', { sph_od: '41.275', dall_id: '22.225', sph_width: '12.7' }))
      .toMatchObject({ OD: 41.275, ID: 22.225, W: 12.7 });
  });

  // The safety property: no silent substitution when a column does not exist.
  test('BODY has no outer diameter → OD is null, NOT some other dimension', () => {
    const r = resolvePartDims('BODY', { final_id: '18.2', head_width: '9.0' });
    expect(r.OD).toBeNull();
    expect(r).toMatchObject({ ID: 18.2, W: 9 });
    expect(PART_DIM_ALIAS.BODY.OD).toBeNull();
  });

  test('MECHA has no dimension table at all → every dim null', () => {
    expect(resolvePartDims('MECHA', {})).toMatchObject({ OD: null, ID: null, W: null, SD: null });
  });

  test.each([
    ['missing row', 'BALL', null],
    ['unknown part type', 'WIDGET', { od: '5' }],
    ['empty / non-numeric values', 'BALL', { ball_dia: '', in_dia: 'N/A', width: null }],
  ])('%s → all null (never NaN)', (_label, type, row) => {
    const r = resolvePartDims(type, row);
    expect(r).toMatchObject({ OD: null, ID: null, W: null });
    expect(Number.isNaN(r.OD)).toBe(false);
  });

  describe('SD is derived, not stored', () => {
    test('SD = sqrt(OD² − W²)', () => {
      const r = resolvePartDims('BALL', { ball_dia: '47.625', in_dia: '25', width: '35' });
      expect(r.SD).toBeCloseTo(Math.sqrt(47.625 ** 2 - 35 ** 2), 6);
    });

    // Guards the old bug: the previous calc read dim.od_aft / dim.w_aft — columns that
    // exist on NO lpb table — so SD silently computed 0 and never rendered.
    test('SD is null (not 0, not NaN) when the ball is thicker than it is wide', () => {
      expect(resolvePartDims('BALL', { ball_dia: '19.844', width: '20.65' }).SD).toBeNull();
    });
  });
});

// ── applyDataToGrid — token substitution ────────────────────────────────────

const EMPTY_GRID = { cells: {}, fills: {}, merges: [] };
// row_39 → grid row index 38; column H → index 7.
const CELL_39H = '38,7';
const CELL_38H = '37,7';

const valueMapWith = (over = {}) => ({
  params: {},
  'dim.OD': '47.625',
  'dim.ID': '25',
  'dim.W': '35',
  'dim.SD': '32.298',
  part_type: 'BALL',
  _cn_control: 'C32-00034',
  ...over,
});

const applyParams = (params, over) =>
  ctrl.applyDataToGrid(EMPTY_GRID, valueMapWith({ params, ...over }), []);

describe('applyDataToGrid — {{dim.*}} in the A:I parameter grid', () => {
  test('substitutes the part dimension into the cell', () => {
    const g = applyParams({ row_39_H: '{{dim.OD}}' });
    expect(g.cells[CELL_39H].v).toBe('47.625');
  });

  test('|N applies fixed decimals (sheets print 35 as "35.000")', () => {
    const g = applyParams({ row_38_H: '{{dim.W|3}}' });
    expect(g.cells[CELL_38H].v).toBe('35.000');
  });

  test('tolerates whitespace and is case-insensitive on the key', () => {
    const g = applyParams({ row_39_H: '{{ dim.od | 2 }}' });
    expect(g.cells[CELL_39H].v).toBe('47.63');
  });

  test('resolves a token embedded in surrounding text', () => {
    const g = applyParams({ row_39_H: 'Ø{{dim.OD}} mm' });
    expect(g.cells[CELL_39H].v).toBe('Ø47.625 mm');
  });

  test('resolves multiple tokens in one cell', () => {
    const g = applyParams({ row_39_H: '{{dim.OD}} x {{dim.W}}' });
    expect(g.cells[CELL_39H].v).toBe('47.625 x 35');
  });

  test('leaves a plain literal value untouched (existing configs keep working)', () => {
    const g = applyParams({ row_39_H: '17.724' });
    expect(g.cells[CELL_39H].v).toBe('17.724');
  });

  test('works in the GW section too', () => {
    const g = applyParams({ gw_row_10_AN: '{{dim.ID}}' });
    expect(g.cells['9,39'].v).toBe('25');
  });

  // The core safety property. A stale number reads as real on a setup sheet; a blank
  // reads as incomplete. Blank is the correct failure.
  describe('unresolvable token', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => console.warn.mockRestore());

    test('renders blank — never the literal token', () => {
      const g = applyParams({ row_39_H: '{{dim.OD}}' }, { 'dim.OD': '' });
      const printed = g.cells[CELL_39H]?.v;
      expect(printed == null || printed === '').toBe(true);
      expect(String(printed)).not.toContain('{{');
    });

    test('does not resurrect the previous cell value', () => {
      const grid = { cells: { [CELL_39H]: { v: '17.724' } }, fills: {}, merges: [] };
      const g = ctrl.applyDataToGrid(grid, valueMapWith({ params: { row_39_H: '{{dim.OD}}' }, 'dim.OD': '' }), []);
      expect(g.cells[CELL_39H].v).not.toBe('17.724');
    });

    test('logs the miss so the config gap is visible server-side', () => {
      applyParams({ row_39_H: '{{dim.OD}}' }, { 'dim.OD': '', part_type: 'BODY' });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dim.OD unresolved'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('BODY'));
    });

    test('an unknown token key is left alone, not blanked', () => {
      const g = applyParams({ row_39_H: '{{dim.BOGUS}}' });
      expect(g.cells[CELL_39H].v).toBe('{{dim.BOGUS}}');
    });
  });
});

describe('applyDataToGrid — {{dim.*}} via a mapped sds_excel_mapping cell', () => {
  test('a mapped param carrying a token resolves too', () => {
    const g = ctrl.applyDataToGrid(
      EMPTY_GRID,
      valueMapWith({ params: { remark_1: '{{dim.OD}}' } }),
      [{ cell_address: 'H39', param_key: 'remark_1' }]
    );
    expect(g.cells[CELL_39H].v).toBe('47.625');
  });

  test('an unresolved mapped token writes nothing', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const g = ctrl.applyDataToGrid(
      EMPTY_GRID,
      valueMapWith({ params: { remark_1: '{{dim.OD}}' }, 'dim.OD': '' }),
      [{ cell_address: 'H39', param_key: 'remark_1' }]
    );
    expect(g.cells[CELL_39H]).toBeUndefined();
    console.warn.mockRestore();
  });
});
