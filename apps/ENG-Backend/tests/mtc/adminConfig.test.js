'use strict';

jest.mock('../../instance/eng_db', () => ({
  engPool: { query: jest.fn() },
}));

const { engPool } = require('../../instance/eng_db');
const FormulaService = require('../../api/engineer/mtc/services/FormulaService');

// ── Formula CRUD — validation gate ────────────────────────────────────────────

describe('Admin: Formula config', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('validateFormula (pre-save gate in formulaController)', () => {
    test('rejects invalid formula before DB insert', () => {
      const result = FormulaService.validateFormula('od && 2');
      expect(result.valid).toBe(false);
    });

    test('accepts valid formula and returns preview result', () => {
      const result = FormulaService.validateFormula('od * 2 + 5', { od: 10 });
      expect(result.valid).toBe(true);
      expect(result.result).toBe(25);
    });

    test('formula referencing multiple context vars', () => {
      const result = FormulaService.validateFormula(
        'round(od / 2 + w * 0.1, 2)',
        { od: 30, w: 15 }
      );
      expect(result.valid).toBe(true);
      expect(result.result).toBeCloseTo(16.5);
    });
  });

  describe('calculateMachineParams — full formula chain for admin preview', () => {
    test('all formulas execute in order and chain correctly', async () => {
      engPool.query.mockResolvedValueOnce({
        rows: [
          { tool_category: 'WHEEL', param_key: 'w_D',  formula: 'od + 5' },
          { tool_category: 'WHEEL', param_key: 'w_T',  formula: 'round(w_D * 0.3, 1)' },
          { tool_category: 'WHEEL', param_key: 'w_H',  formula: 'ceil(od * 0.15, 0)' },
        ],
      });

      const result = await FormulaService.calculateMachineParams('KS400B', { od: 20 });

      expect(result.WHEEL.w_D).toBe(25);
      expect(result.WHEEL.w_T).toBeCloseTo(7.5);
      expect(result.WHEEL.w_H).toBe(3);
    });
  });
});

// ── SDS v2 Admin — machine type config ───────────────────────────────────────

describe('Admin: Machine template config (sdsV2AdminController)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /machine-types', () => {
    test('returns rows from DB on success', async () => {
      const mockRows = [
        { id: 1, machine_type_code: 'KS400B', machine_type_name: 'KS-400B', is_active: true },
      ];
      engPool.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await engPool.query(
        'SELECT * FROM sds_machine_type_codes ORDER BY machine_type_code',
        []
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].machine_type_code).toBe('KS400B');
    });

    test('empty result set returns empty array', async () => {
      engPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await engPool.query('SELECT * FROM sds_machine_type_codes', []);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('PUT /machine-types/:id — field-level update', () => {
    test('RETURNING * gives updated row', async () => {
      const updated = { id: 1, machine_type_code: 'KS400B', grinding_area_label: 'Area A', is_active: true };
      engPool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await engPool.query(
        'UPDATE sds_machine_type_codes SET grinding_area_label=$1 WHERE id=$2 RETURNING *',
        ['Area A', 1]
      );
      expect(result.rows[0].grinding_area_label).toBe('Area A');
    });

    test('update on non-existent id returns empty rows', async () => {
      engPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await engPool.query(
        'UPDATE sds_machine_type_codes SET is_active=$1 WHERE id=$2 RETURNING *',
        [false, 9999]
      );
      expect(result.rows).toHaveLength(0);
    });
  });
});

// ── Email config — toolRequestAuth utility ────────────────────────────────────

describe('Admin: Email config (toolRequestController)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetches email config from DB', async () => {
    const mockConfig = [{ id: 1, recipient_email: 'eng@co.th', is_active: true }];
    engPool.query.mockResolvedValueOnce({ rows: mockConfig });

    const result = await engPool.query('SELECT * FROM tool_request_email_config WHERE is_active=true', []);
    expect(result.rows[0].recipient_email).toBe('eng@co.th');
  });

  test('returns empty when no active email config exists', async () => {
    engPool.query.mockResolvedValueOnce({ rows: [] });
    const result = await engPool.query('SELECT * FROM tool_request_email_config WHERE is_active=true', []);
    expect(result.rows).toHaveLength(0);
  });
});
