'use strict';

// The lookup-only pass is the ONLY path that can create a search result for a
// tooling that has no formula at all (FTL-10(I) PUSHER OP1). Its guards are what
// keep that from becoming a way to smuggle tooling onto the wrong machine.
//
// It receives the map rows already fetched — search() reads the map once and hands
// the same rows to both this and _applyPartnoOverrides. Query order inside it is:
//   1. one inventory SELECT per pinned row that needs one
//   2. one "which families are lookup-only" SELECT, always (when any machine is eligible)

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const searchService = require('../../api/engineer/mtc/services/searchService');

const FTL = { machine_name: 'FTL-10(I)', inventory_table: 'tooling_ftl10' };
const ELIGIBLE = { 'FTL-10(I)': FTL };

const mapRow = (over = {}) => ({
  machine_name: 'FTL-10(I)',
  tooling_name: 'PUSHER OP1',
  tool_dwg_no: '4501-02-9014',
  matched_by: 'cn',
  ...over,
});
const invRow = { id: 7, tooling_no: '4501-02-9014', tooling_name: 'PUSHER OP1' };

// The families query result — the (machine, tooling) pairs that exist in the map
// but have no formula. Defaults to PUSHER OP1 being lookup-only.
const familyRows = (rows = [{ machine_name: 'FTL-10(I)', tooling_name: 'PUSHER OP1' }]) => ({ rows });

afterEach(() => { jest.clearAllMocks(); searchService._clearCaches(); });

describe('_applyLookupOnlyToolings', () => {
  it('creates a result for a tooling that has no formula, flagged with the key that matched', async () => {
    engPool.query
      .mockResolvedValueOnce({ rows: [invRow] })   // inventory
      .mockResolvedValueOnce(familyRows());        // families

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow()]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      machine: 'FTL-10(I)',
      tooling: 'PUSHER OP1',
      overrideBy: 'cn',
    });
    expect(results[0].matches).toEqual([invRow]);
    // Nothing was computed — the shape must still be what the UI/PDF expect.
    expect(results[0].computedDims).toEqual({});
  });

  it('shows a lookup-only family as an EMPTY result when this part has no pinned row', async () => {
    // This is what makes "no pinned selection for this part" distinguishable from
    // "the system has never heard of this tooling" — and it is the row that
    // _applySimilarPartFallback later fills with the nearest twin's tool.
    engPool.query.mockResolvedValueOnce(familyRows());   // no pinned rows → families only

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, []);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ machine: 'FTL-10(I)', tooling: 'PUSHER OP1' });
    expect(results[0].matches).toEqual([]);
    expect(results[0].overrideBy).toBeUndefined();
  });

  it('does not add a placeholder for a family that already has a pinned match', async () => {
    engPool.query
      .mockResolvedValueOnce({ rows: [invRow] })   // inventory for the pinned row
      .mockResolvedValueOnce(familyRows());        // families — same tooling

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow()]);

    expect(results).toHaveLength(1);
    expect(results[0].matches).toEqual([invRow]);
  });

  it('never displaces a result the formula pass already produced', async () => {
    engPool.query.mockResolvedValueOnce(familyRows());

    const existing = {
      machine: 'FTL-10(I)', tooling: 'PUSHER OP1',
      computedDims: { A: 12 }, matches: [{ tooling_no: 'FORMULA-WINS' }],
    };
    const results = [existing];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow()]);

    expect(results).toHaveLength(1);
    expect(results[0].matches[0].tooling_no).toBe('FORMULA-WINS');
    expect(results[0].overrideBy).toBeUndefined();
  });

  it('refuses a machine that failed eligibility — a map row must not bypass a limit', async () => {
    const results = [];
    await searchService._applyLookupOnlyToolings(results, {}, [mapRow()]); // nothing eligible

    expect(results).toEqual([]);
    // No eligible machine → it returns before even asking which families are lookup-only.
    expect(engPool.query).not.toHaveBeenCalled();
  });

  it('skips a mapped drawing that is not on the shelf, but still shows the family', async () => {
    engPool.query
      .mockResolvedValueOnce({ rows: [] })        // inventory has no such row
      .mockResolvedValueOnce(familyRows());

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow({ tool_dwg_no: '4501-02-NOPE' })]);

    expect(results).toHaveLength(1);
    expect(results[0].matches).toEqual([]);       // visible, but no selection
  });

  it('adds nothing when no family is lookup-only', async () => {
    engPool.query.mockResolvedValueOnce(familyRows([]));   // every family has a formula

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, []);
    expect(results).toEqual([]);
  });

  it('fails open — a DB error leaves the formula-driven results untouched', async () => {
    engPool.query.mockRejectedValueOnce(new Error('connection reset'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const existing = { machine: 'FTL-10(I)', tooling: 'COLLET OP1', matches: [invRow] };
    const results = [existing];
    await expect(
      searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow()])
    ).resolves.toBeUndefined();

    expect(results).toEqual([existing]);
    warn.mockRestore();
  });

  it('resolves a grouped machine by its display label, not its machine_name', async () => {
    // Results are keyed by the group label a grouped machine is searched under, so
    // the dedupe check has to look the row up the same way or it would double-add.
    const grouped = { 'KS-400B1/B2/B7': { machine_name: 'KS-400B1', inventory_table: 'tooling_ks400b' } };
    engPool.query
      .mockResolvedValueOnce({ rows: [invRow] })
      .mockResolvedValueOnce(familyRows([{ machine_name: 'KS-400B1', tooling_name: 'ROTARY DRESSER' }]));

    const results = [];
    await searchService._applyLookupOnlyToolings(results, grouped, [
      mapRow({ machine_name: 'KS-400B1', tooling_name: 'ROTARY DRESSER', matched_by: 'parts_no' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].machine).toBe('KS-400B1/B2/B7');
    expect(results[0].overrideBy).toBe('parts_no');
  });

  it('marks the placeholder lookupOnly — the flag the similar-part set-fill keys on', async () => {
    // A formula-driven tooling can be empty DELIBERATELY (a sentinel gate, e.g. KL-20's
    // wrong-grip collet). Only a tooling with no formula is safe to fill from a
    // reference part's whole fixture set, and this flag is how the two are told apart.
    engPool.query.mockResolvedValueOnce(familyRows());

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, []);

    expect(results[0].lookupOnly).toBe(true);
  });

  it('does not mark a pinned match lookupOnly — it already has its answer', async () => {
    engPool.query
      .mockResolvedValueOnce({ rows: [invRow] })
      .mockResolvedValueOnce(familyRows());

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow()]);

    expect(results[0].matches).toEqual([invRow]);
    expect(results[0].lookupOnly).toBeUndefined();
  });

  it('adds each distinct tooling once even when the map repeats one', async () => {
    engPool.query
      .mockResolvedValueOnce({ rows: [invRow] })
      .mockResolvedValueOnce(familyRows());

    const results = [];
    await searchService._applyLookupOnlyToolings(results, ELIGIBLE, [mapRow(), mapRow()]);

    expect(results).toHaveLength(1);
  });
});
