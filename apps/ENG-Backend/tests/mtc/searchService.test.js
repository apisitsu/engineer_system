'use strict';

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));

const { engPool }   = require('../../instance/eng_db');
const searchService = require('../../api/engineer/mtc/services/searchService');

const TABLE   = 'tooling_ksb22g';
const MACHINE = { inventory_table: TABLE, inventory_machine_filter: null };
const COLS    = ['id', 'tooling_no', 'dim_a', 'dim_b', 'dim_c', 'dim_d'];

// Prepend the two setup queries (assertTableExists + getTableColumns) each test needs
function mockTableSetup() {
  engPool.query
    .mockResolvedValueOnce({ rows: [{ table_name: TABLE }] })               // assertTableExists
    .mockResolvedValueOnce({ rows: COLS.map(c => ({ column_name: c })) });  // getTableColumns
}

afterEach(() => {
  jest.clearAllMocks();
  searchService._clearCaches();
});

// ── withTol rules ─────────────────────────────────────────────────────────────

describe('withTol rules', () => {
  it('adds WHERE BETWEEN and combined-distance ORDER BY', async () => {
    mockTableSetup();
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: '0.5', tol_minus: '0.5', sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: '0.3', tol_minus: '0.3', sort_priority: 1 },
    ];
    const computed = { A: 50, B: 10 };

    await searchService._searchInventory(MACHINE, rules, computed);

    const [,, inventoryCall] = engPool.query.mock.calls;
    const sql    = inventoryCall[0];
    const params = inventoryCall[1];

    // WHERE has BETWEEN for both dims
    expect(sql).toMatch(/"dim_a"::numeric BETWEEN/);
    expect(sql).toMatch(/"dim_b"::numeric BETWEEN/);

    // ORDER BY combined ABS distance — not sequential per-column
    expect(sql).toMatch(/ORDER BY \(ABS\("dim_a"::numeric - \$\d+\) \+ ABS\("dim_b"::numeric - \$\d+\)\)/);

    // params: lo_A, hi_A, lo_B, hi_B, val_A, val_B
    expect(params).toEqual([49.5, 50.5, 9.7, 10.3, 50, 10]);
  });

  it('returns rows from the closest match within the tolerance band', async () => {
    mockTableSetup();
    const expectedRows = [{ id: 5, dim_a: 50.1, dim_b: 10.05 }];
    engPool.query.mockResolvedValueOnce({ rows: expectedRows });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: '1', tol_minus: '1', sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: '1', tol_minus: '1', sort_priority: 1 },
    ];

    const rows = await searchService._searchInventory(MACHINE, rules, { A: 50, B: 10 });
    expect(rows).toBe(expectedRows);
  });
});

// ── withoutTol rules ──────────────────────────────────────────────────────────

describe('withoutTol rules (Closest Match)', () => {
  it('adds combined-distance ORDER BY with no WHERE for dim conditions', async () => {
    mockTableSetup();
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: null, tol_minus: null, sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: null, tol_minus: null, sort_priority: 1 },
      { output_key: 'C', inventory_column: 'dim_c', tol_plus: null, tol_minus: null, sort_priority: 2 },
      { output_key: 'D', inventory_column: 'dim_d', tol_plus: null, tol_minus: null, sort_priority: 3 },
    ];
    const computed = { A: 50, B: 10, C: 25, D: 8 };

    await searchService._searchInventory(MACHINE, rules, computed);

    const [,, inventoryCall] = engPool.query.mock.calls;
    const sql    = inventoryCall[0];
    const params = inventoryCall[1];

    // No dim WHERE conditions
    expect(sql).not.toMatch(/WHERE/);

    // Combined-distance ORDER BY for all 4 dimensions
    expect(sql).toMatch(/ORDER BY \(ABS.*\+ ABS.*\+ ABS.*\+ ABS/);

    // Params contain all 4 computed values (no lo/hi since no tolerance)
    expect(params).toEqual([50, 10, 25, 8]);
  });

  it('uses combined distance, not sequential per-column sorting', async () => {
    mockTableSetup();
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: null, tol_minus: null, sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: null, tol_minus: null, sort_priority: 1 },
    ];

    await searchService._searchInventory(MACHINE, rules, { A: 50, B: 10 });

    const sql = engPool.query.mock.calls[2][0];

    // Must be a single combined expression with +, NOT two separate ASC clauses
    expect(sql).toMatch(/ORDER BY \(ABS\("dim_a"::numeric - \$\d+\) \+ ABS\("dim_b"::numeric - \$\d+\)\) ASC/);
    // Old-style sequential ORDER BY must NOT be present
    expect(sql).not.toMatch(/ABS.*ASC,\s*ABS/);
  });
});

// ── Mixed rules ───────────────────────────────────────────────────────────────

describe('mixed withTol + withoutTol rules', () => {
  it('combines WHERE (tolerance) and ORDER BY (combined distance) for all active rules', async () => {
    mockTableSetup();
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: '0.5', tol_minus: '0.5', sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: null,  tol_minus: null,  sort_priority: 1 },
    ];
    const computed = { A: 50, B: 10 };

    await searchService._searchInventory(MACHINE, rules, computed);

    const [,, inventoryCall] = engPool.query.mock.calls;
    const sql    = inventoryCall[0];
    const params = inventoryCall[1];

    // WHERE from tol rule
    expect(sql).toMatch(/"dim_a"::numeric BETWEEN/);

    // ORDER BY includes BOTH dim_a (tol rule) and dim_b (no-tol rule)
    expect(sql).toMatch(/ORDER BY \(ABS\("dim_a"::numeric - \$\d+\) \+ ABS\("dim_b"::numeric - \$\d+\)\)/);

    // params: lo_A, hi_A, val_A, val_B
    expect(params).toEqual([49.5, 50.5, 50, 10]);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns [] immediately when inventory_table is null', async () => {
    const machine = { inventory_table: null, inventory_machine_filter: null };
    const result = await searchService._searchInventory(machine, [], {});
    expect(result).toEqual([]);
    expect(engPool.query).not.toHaveBeenCalled();
  });

  it('skips a rule when output_key is absent from computedDims', async () => {
    mockTableSetup();
    engPool.query.mockResolvedValueOnce({ rows: [] });

    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: null, tol_minus: null, sort_priority: 0 },
      { output_key: 'B', inventory_column: 'dim_b', tol_plus: null, tol_minus: null, sort_priority: 1 },
    ];
    const computed = { A: 50 }; // B missing

    await searchService._searchInventory(MACHINE, rules, computed);

    const sql = engPool.query.mock.calls[2][0];
    expect(sql).toMatch(/ABS\("dim_a"/);
    expect(sql).not.toMatch(/ABS\("dim_b"/);
  });

  it('includes machine filter in WHERE when machineFilter is set', async () => {
    const colsWithMachine = [...COLS, 'Machine'];
    engPool.query
      .mockResolvedValueOnce({ rows: [{ table_name: TABLE }] })
      .mockResolvedValueOnce({ rows: colsWithMachine.map(c => ({ column_name: c })) })
      .mockResolvedValueOnce({ rows: [] });

    const machineWithFilter = {
      inventory_table: TABLE,
      inventory_machine_filter: 'KS-B22G',
    };
    const rules = [
      { output_key: 'A', inventory_column: 'dim_a', tol_plus: null, tol_minus: null, sort_priority: 0 },
    ];

    await searchService._searchInventory(machineWithFilter, rules, { A: 50 });

    const [,, inventoryCall] = engPool.query.mock.calls;
    const sql    = inventoryCall[0];
    const params = inventoryCall[1];

    expect(sql).toMatch(/"Machine" = \$1/);
    expect(params[0]).toBe('KS-B22G');
  });
});
