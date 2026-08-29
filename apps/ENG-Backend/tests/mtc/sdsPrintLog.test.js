'use strict';

// The SDS print log is an evidentiary record, so the two properties worth pinning are
// about what it refuses to do:
//
//   1. it NEVER guesses a lot — `lot_verified` distinguishes "not supplied" (null) from
//      "supplied and not in the plan" (false), and those must not collapse into each other
//   2. it NEVER fails a print — every DB error is swallowed and `record()` returns null
//
// Plus the key handling, because `lpb.pc_lot.control_no` is the 6-digit item number while
// `lpb.eng_item.control_no` is the control number, and getting that backwards silently
// looks up nothing.

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));
jest.mock('../../instance/maq_db', () => ({ maqPool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const { maqPool } = require('../../instance/maq_db');
const printLog = require('../../api/engineer/mtc/services/sdsPrintLog');

// The INSERT is positional, and every column added to the table shifts every index after
// it — which broke this file twice. Read the column order out of the SQL instead, so a new
// column is a non-event here and the assertions keep saying what they mean.
const paramsByName = (call) => {
  const [sql, values] = call;
  const cols = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((c) => c.trim());
  return Object.fromEntries(cols.map((c, i) => [c, values[i]]));
};

const rows = (r) => ({ rows: r });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('cnForms', () => {
  it('derives both key forms from either spelling', () => {
    expect(printLog.cnForms('C31-04050')).toEqual({ control: 'C31-04050', item: '314050' });
    expect(printLog.cnForms('314050')).toEqual({ control: 'C31-04050', item: '314050' });
  });

  it('returns nulls for an empty CN rather than throwing', () => {
    expect(printLog.cnForms('')).toEqual({ control: null, item: null });
    expect(printLog.cnForms(undefined)).toEqual({ control: null, item: null });
  });
});

describe('resolvePartInfo', () => {
  it('looks up lpb.eng_item by the CONTROL number, not the item number', async () => {
    maqPool.query.mockResolvedValueOnce(rows([{ parts_no: '3ANM10-621-T', parts_name: 'BALL' }]));
    const out = await printLog.resolvePartInfo('314050');
    expect(out).toEqual({ parts_no: '3ANM10-621-T', parts_name: 'BALL' });
    expect(maqPool.query.mock.calls[0][1]).toEqual(['C31-04050']);
  });

  it('degrades to {} when the plan DB is unreachable — a print is still logged', async () => {
    maqPool.query.mockRejectedValueOnce(new Error('maqdb down'));
    await expect(printLog.resolvePartInfo('314050')).resolves.toEqual({});
  });
});

describe('verifyLot — never guesses', () => {
  it('returns null when no lot was supplied ("not checked" ≠ "not found")', async () => {
    await expect(printLog.verifyLot({ cn: '314050', processCode: '1041', lot: '' })).resolves.toBeNull();
    await expect(printLog.verifyLot({ cn: '314050', processCode: '1041' })).resolves.toBeNull();
    expect(maqPool.query).not.toHaveBeenCalled();
  });

  it('queries the plan by the ITEM number and tolerates a variant suffix', async () => {
    maqPool.query.mockResolvedValueOnce(rows([{ '?column?': 1 }]));
    await expect(printLog.verifyLot({ cn: 'C31-04050', processCode: '1041', lot: 'C14781' }))
      .resolves.toBe(true);
    expect(maqPool.query.mock.calls[0][1]).toEqual(['314050', '314050-%', 'C14781', '1041']);
  });

  it('narrows to the process only when one is given', async () => {
    maqPool.query.mockResolvedValueOnce(rows([]));
    await printLog.verifyLot({ cn: '314050', lot: 'C14781' });
    expect(maqPool.query.mock.calls[0][1]).toEqual(['314050', '314050-%', 'C14781']);
  });

  it('is false — not null — for a lot the plan does not have', async () => {
    maqPool.query.mockResolvedValueOnce(rows([]));
    await expect(printLog.verifyLot({ cn: '314050', processCode: '1041', lot: 'ZZ9999' }))
      .resolves.toBe(false);
  });
});

describe('record — a logging failure never fails a print', () => {
  const args = {
    cn: '314050', machineTypeName: 'KS-400B1', processCode: '1041',
    source: 'public',              // the public route sends no requestedBy — source is the attribution
    pdfBuffer: Buffer.from('demo-pdf'),
  };

  it('returns null instead of throwing when the insert fails', async () => {
    maqPool.query.mockResolvedValue(rows([]));
    engPool.query.mockRejectedValueOnce(new Error('relation does not exist'));
    await expect(printLog.record(args)).resolves.toBeNull();
  });

  it('returns null instead of throwing when the plan lookup fails outright', async () => {
    maqPool.query.mockRejectedValue(new Error('maqdb down'));
    engPool.query.mockResolvedValueOnce(rows([{ id: 1, printed_at: 'now' }]));
    await expect(printLog.record(args)).resolves.not.toBeUndefined();
  });

  it('does nothing without a CN or a machine — a blank preview is not evidence', async () => {
    await expect(printLog.record({ ...args, cn: '' })).resolves.toBeNull();
    await expect(printLog.record({ ...args, machineTypeName: '' })).resolves.toBeNull();
    expect(engPool.query).not.toHaveBeenCalled();
  });

  it('hashes the PDF, stores no bytes, and keeps only slots carrying a fixture', async () => {
    maqPool.query.mockResolvedValue(rows([]));
    engPool.query.mockResolvedValueOnce(rows([{ id: 7, printed_at: 'now' }]));

    await printLog.record({
      ...args,
      lot: 'C14781',
      tooling: [
        { slot: 'T01', name: 'WORK DRIVER', dwg: '4664-01-0012' },
        { slot: 'T02', name: '', dwg: '' },
        null,
      ],
    });

    const sql = engPool.query.mock.calls[0][0];
    const p = paramsByName(engPool.query.mock.calls[0]);
    expect(sql).not.toMatch(/pdf_data|pdf_blob|bytea/i);      // the file itself is never stored
    expect(p.cn).toBe('C31-04050');                            // control form
    expect(p.item_no).toBe('314050');
    expect(p.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.pdf_bytes).toBe(8);
    expect(JSON.parse(p.tooling_snapshot)).toEqual([
      { slot: 'T01', name: 'WORK DRIVER', dwg: '4664-01-0012' },
    ]);
  });

  it('writes lot_verified = null when no lot was supplied', async () => {
    maqPool.query.mockResolvedValue(rows([]));
    engPool.query.mockResolvedValueOnce(rows([{ id: 8, printed_at: 'now' }]));
    await printLog.record(args);
    const p = paramsByName(engPool.query.mock.calls[0]);
    expect(p.lot_verified).toBeNull();
    expect(p.lot_no).toBeNull();
  });
});
