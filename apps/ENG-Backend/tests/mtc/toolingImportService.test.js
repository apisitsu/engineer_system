'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

// PATHS is frozen at require time, so the source/output overrides have to be in
// place before mtcConstants is pulled in by the service.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-import-'));
const INSP_DIR = path.join(ROOT, 'insp');
const OUT_DIR = path.join(ROOT, 'out');
const DWG_FILE = path.join(ROOT, 'dwg.xlsm');
fs.mkdirSync(INSP_DIR, { recursive: true });

process.env.TI_INSP_REC_DIR = INSP_DIR;
process.env.TI_CSV_OUTPUT_DIR = OUT_DIR;
process.env.TI_DWG_PRINT_FILE = DWG_FILE;

jest.mock('../../instance/eng_db', () => ({ engPool: { query: jest.fn() } }));

const { engPool } = require('../../instance/eng_db');
const svc = require('../../api/engineer/mtc/services/toolingImportService');

const TI_CSV = path.join(OUT_DIR, 'ToolingInspection.csv');
const DWG_CSV = path.join(OUT_DIR, 'RecordForDrawingPrinted.csv');

// A date inside the two-month reconciliation window, in the dd/mm/yyyy form the
// inspection sheets use.
const today = new Date();
const ymd = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const TODAY_ISO = ymd(today);
const TODAY_DMY = dmy(today);

function writeInspWorkbook(name, dataRows) {
  const aoa = [
    ['TOOLING INSPECTION RECORD'], // decorative title row — headers are on row 2
    ['Date รับงาน', 'TIME', 'W/C', 'PO No.', 'NAME', 'Spec', "Q'ty", 'Remark', 'V/D', 'วันที่ Insp เสร็จ'],
    ...dataRows,
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  XLSX.writeFile(wb, path.join(INSP_DIR, name));
}

/** Routes each query by SQL shape so tests only state the rows that matter. */
function mockDb({ existing = [], blacklist = [], exported = [] } = {}) {
  const inserts = [];
  engPool.query.mockImplementation(async (sql, params) => {
    if (sql.includes('ti_list_blacklist')) return { rows: blacklist };
    if (sql.includes('WHERE receive_date >= $1')) return { rows: existing };
    if (sql.includes('setval')) return { rows: [] };
    if (sql.startsWith('INSERT INTO ti_list')) {
      inserts.push({ sql, params });
      return { rows: [] };
    }
    if (sql.includes('ORDER BY id ASC')) {
      return {
        rows: exported,
        fields: ['id', 'receive_date', 'time', 'w_c', 'po_no', 'item_name', 'dwg_no', 'qty', 'remark', 'fye', 'updated_at']
          .map((name) => ({ name })),
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return inserts;
}

afterEach(() => {
  jest.clearAllMocks();
  fs.rmSync(INSP_DIR, { recursive: true, force: true });
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.rmSync(DWG_FILE, { force: true });
  fs.mkdirSync(INSP_DIR, { recursive: true });
});
afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

// ---------------------------------------------------------------------------

describe('buildUid', () => {
  it('pads a 4-character time so "9:00" and "09:00" are one inspection', () => {
    const a = svc.buildUid({ po_no: 'PO-1', receive_date: '2026-05-01', time: '9:00', item_name: 'Ring' });
    const b = svc.buildUid({ po_no: 'PO-1', receive_date: '2026-05-01', time: '09:00', item_name: 'Ring' });
    expect(a).toBe(b);
  });

  it('strips the trailing .0 pandas left on numeric PO cells', () => {
    const stored = svc.buildUid({ po_no: '12345.0', receive_date: '2026-05-01', time: '09:00', item_name: 'Ring' });
    const fresh = svc.buildUid({ po_no: 12345, receive_date: '2026-05-01', time: '09:00', item_name: 'Ring' });
    expect(fresh).toBe(stored);
  });

  it('lowercases and trims, and still separates genuinely different rows', () => {
    expect(svc.buildUid({ po_no: ' PO-1 ', receive_date: '2026-05-01', time: '09:00', item_name: 'RING' }))
      .toBe(svc.buildUid({ po_no: 'po-1', receive_date: '2026-05-01', time: '09:00', item_name: 'ring' }));
    expect(svc.buildUid({ po_no: 'PO-1', receive_date: '2026-05-01', time: '09:00', item_name: 'Ring' }))
      .not.toBe(svc.buildUid({ po_no: 'PO-2', receive_date: '2026-05-01', time: '09:00', item_name: 'Ring' }));
  });
});

describe('field formatters', () => {
  it('rolls the fiscal year over in April', () => {
    expect(svc.calculateFye(new Date(Date.UTC(2026, 2, 31)))).toBe('FYE26'); // 31 Mar
    expect(svc.calculateFye(new Date(Date.UTC(2026, 3, 1)))).toBe('FYE27');  // 1 Apr
    expect(svc.calculateFye(null)).toBe('');
  });

  it('pads the work centre to two digits and blanks non-numerics', () => {
    expect(svc.formatWorkCenter(6)).toBe('06');
    expect(svc.formatWorkCenter('12')).toBe('12');
    expect(svc.formatWorkCenter('')).toBe('');
    expect(svc.formatWorkCenter('n/a')).toBe('');
  });

  it('drops the decimal tail from quantities and remarks', () => {
    expect(svc.formatQty(3.0)).toBe('3');
    expect(svc.formatQty(null)).toBe('');
    expect(svc.formatRemark('42.0')).toBe('42');
    expect(svc.formatRemark(null)).toBe('');
  });

  it('renders a real Excel time cell as HH:MM:SS but leaves text alone', () => {
    expect(svc.formatTimeCell(0.375)).toBe('09:00:00'); // 09:00 as a day fraction
    expect(svc.formatTimeCell('9:00')).toBe('9:00');
    expect(svc.formatTimeCell(null)).toBe('');
  });
});

describe('importPcTooling', () => {
  it('merges workbooks, inserts unseen rows and exports the table to CSV', async () => {
    writeInspWorkbook('a.xlsx', [
      [TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 3.0, 'note', 'vd', TODAY_DMY],
      [TODAY_DMY, '10:00', 12, 'PO-2', 'Race', 'DWG-2', 5.0, 42.0, 'vd', ''],
    ]);
    const inserts = mockDb({
      exported: [{ id: 1, receive_date: TODAY_ISO, time: '9:00', w_c: '06', po_no: 'PO-1', item_name: 'Ring', dwg_no: 'DWG-1', qty: 3, remark: 'note', fye: 'FYE27', updated_at: new Date() }],
    });

    const result = await svc.importPcTooling();

    expect(result.inserted).toBe(2);
    expect(inserts).toHaveLength(1);
    // 2 rows × 9 columns, in TI_INSERT_COLUMNS order.
    expect(inserts[0].params).toHaveLength(18);
    expect(inserts[0].params.slice(0, 9)).toEqual([TODAY_ISO, '9:00', '06', 'PO-1', 'Ring', 'DWG-1', 3, 'note', expect.stringMatching(/^FYE\d\d$/)]);
    expect(inserts[0].params[16]).toBe('42'); // remark 42.0 → '42'

    const csv = fs.readFileSync(TI_CSV, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('receive_date,time,w_c,po_no'); // exported from the DB, not the sheet
    expect(csv).not.toContain('updated_at');
  });

  it('skips rows already in ti_list and rows on the blacklist', async () => {
    writeInspWorkbook('a.xlsx', [
      [TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', ''],
      [TODAY_DMY, '10:00', 6, 'PO-2', 'Race', 'DWG-2', 1, '', 'vd', ''],
      [TODAY_DMY, '11:00', 6, 'PO-3', 'Ball', 'DWG-3', 1, '', 'vd', ''],
    ]);
    const inserts = mockDb({
      existing: [{ po_no: 'PO-1', receive_date: TODAY_ISO, time: '9:00', item_name: 'Ring' }],
      blacklist: [{ po_no: 'PO-2', receive_date: `${TODAY_ISO}T00:00:00`, time: '10:00', item_name: 'Race' }],
    });

    const result = await svc.importPcTooling();

    expect(result.inserted).toBe(1);
    expect(inserts[0].params[3]).toBe('PO-3');
  });

  it('drops rows with no PO number', async () => {
    writeInspWorkbook('a.xlsx', [
      [TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', ''],
      [TODAY_DMY, '', '', '', 'TOTAL', '', '', '', '', ''],
    ]);
    const inserts = mockDb();
    expect((await svc.importPcTooling()).inserted).toBe(1);
    expect(inserts[0].params).toHaveLength(9);
  });

  it('ignores ~$ lock files Excel leaves behind', async () => {
    writeInspWorkbook('a.xlsx', [[TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', '']]);
    fs.copyFileSync(path.join(INSP_DIR, 'a.xlsx'), path.join(INSP_DIR, '~$a.xlsx'));
    mockDb();
    expect((await svc.importPcTooling()).inserted).toBe(1);
  });

  it('fails loudly when the share holds no workbooks', async () => {
    mockDb();
    await expect(svc.importPcTooling()).rejects.toThrow(/Cannot find any excel files/);
  });

  it('reports a database failure instead of exiting clean like the Python did', async () => {
    writeInspWorkbook('a.xlsx', [[TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', '']]);
    engPool.query.mockRejectedValue(new Error('connection refused'));
    await expect(svc.importPcTooling()).rejects.toThrow('connection refused');
  });

  it('degrades to a warning when the CSV target is unreachable', async () => {
    writeInspWorkbook('a.xlsx', [[TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', '']]);
    mockDb();
    const log = new svc.StepLog();
    const spy = jest.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('G: not mapped'));
    try {
      await expect(svc.importPcTooling(log)).resolves.toMatchObject({ inserted: 1 });
      expect(log.warnings.join('\n')).toContain('G: not mapped');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('importDwgPrint', () => {
  const writeDwgWorkbook = (dataRows) => {
    const aoa = [
      ['NO.', 'LOT NO.', 'ITEM', 'ชุด', '', '', '', '', '', '', '', ''],
      ...dataRows,
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
    XLSX.writeFile(wb, DWG_FILE, { bookType: 'xlsm' });
  };

  it('drops the NO. and unnamed columns and writes the CSV', async () => {
    writeDwgWorkbook([
      [1, 'L-1', 'Ring', 2.0, null, null, null, null, null, null, null, 'junk'],
      [2, 'L-2', 'Race', 3.0, null, null, null, null, null, null, null, 'junk'],
    ]);

    const result = await svc.importDwgPrint();

    expect(result.rows).toBe(2);
    const csv = fs.readFileSync(DWG_CSV, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('LOT NO.,ITEM,ชุด');
    expect(csv).not.toContain('NO.,LOT NO.');
    expect(csv).not.toContain('junk');
    expect(csv).toContain('L-1,Ring,2');
  });

  it('drops rows with no LOT NO.', async () => {
    writeDwgWorkbook([
      [1, 'L-1', 'Ring', 1],
      [2, null, 'orphan', 1],
    ]);
    expect((await svc.importDwgPrint()).rows).toBe(1);
  });

  it('fails when the source workbook is missing, rather than reporting success', async () => {
    await expect(svc.importDwgPrint()).rejects.toThrow(/Cannot find source workbook/);
  });
});

describe('runToolingImports', () => {
  it('runs both steps and lets one fail without hiding the other', async () => {
    writeInspWorkbook('a.xlsx', [[TODAY_DMY, '9:00', 6, 'PO-1', 'Ring', 'DWG-1', 1, '', 'vd', '']]);
    mockDb(); // importDwgPrint has no source workbook → that step fails

    const steps = await svc.runToolingImports();

    expect(steps.map((s) => s.name)).toEqual(['importPCtooling', 'importDwgPrint']);
    expect(steps[0].ok).toBe(true);
    expect(steps[0].output).toContain('New records found to update: 1');
    expect(steps[1].ok).toBe(false);
    expect(steps[1].error).toMatch(/Cannot find source workbook/);
  });
});

describe('publishCsv — local backup + base64 body for the browser upload', () => {
  const COLS = ['a', 'b'];
  const ROWS = [{ a: '1', b: '2' }];
  const PROBE = path.join(OUT_DIR, 'probe.csv');

  afterEach(() => { jest.restoreAllMocks(); fs.rmSync(PROBE, { force: true }); delete process.env.TI_CSV_SKIP_LOCAL; });

  it('writes the local backup and returns the CSV base64-encoded', async () => {
    const log = new svc.StepLog();
    const res = await svc.publishCsv('probe.csv', COLS, ROWS, log);
    expect(res.localOk).toBe(true);
    expect(res.csv.fileName).toBe('probe.csv');
    expect(Buffer.from(res.csv.base64Data, 'base64').toString('utf8')).toContain('1,2');
    expect(fs.readFileSync(PROBE, 'utf8')).toContain('1,2');
  });

  it('skips the local write when TI_CSV_SKIP_LOCAL=1 but still returns the body', async () => {
    process.env.TI_CSV_SKIP_LOCAL = '1';
    const mkdir = jest.spyOn(fs.promises, 'mkdir');
    const res = await svc.publishCsv('probe.csv', COLS, ROWS, new svc.StepLog());
    expect(mkdir).not.toHaveBeenCalled();
    expect(res.localOk).toBe(false);
    expect(Buffer.from(res.csv.base64Data, 'base64').toString('utf8')).toContain('1,2');
    expect(fs.existsSync(PROBE)).toBe(false);
  });

  it('never throws when the local write fails — warns and returns the body', async () => {
    const log = new svc.StepLog();
    jest.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('G: not mapped'));
    const res = await svc.publishCsv('probe.csv', COLS, ROWS, log, { required: true });
    expect(res.localOk).toBe(false);
    expect(Buffer.from(res.csv.base64Data, 'base64').toString('utf8')).toContain('1,2');
    expect(log.warnings.join('\n')).toMatch(/G: not mapped/);
  });
});

describe('writeCsv — surviving a filesystem that will not be overwritten', () => {
  const OUT = path.join(ROOT, 'writecsv');
  const FILE = 'probe.csv';
  const TARGET = path.join(OUT, FILE);
  const COLS = ['a', 'b'];
  const ROWS = [{ a: '1', b: '2' }];

  afterEach(() => { jest.restoreAllMocks(); });

  it('writes through a temp file and renames, leaving no temp behind', async () => {
    await svc.writeCsv(OUT, FILE, COLS, ROWS);
    expect(fs.readFileSync(TARGET, 'utf8')).toContain('1,2');
    // The temp name is dot-prefixed; nothing but the CSV should remain.
    expect(fs.readdirSync(OUT)).toEqual([FILE]);
  });

  it('retries a transient UNKNOWN and succeeds — the plbmp130 Google Drive failure', async () => {
    // Fail the first write the way Drive's virtual filesystem did (errno -4094),
    // then let it through. Without the retry this surfaced as a hard step failure.
    let calls = 0;
    const real = fs.promises.writeFile;
    jest.spyOn(fs.promises, 'writeFile').mockImplementation((...args) => {
      if (++calls === 1) {
        const err = new Error('UNKNOWN: unknown error, open');
        err.code = 'UNKNOWN';
        return Promise.reject(err);
      }
      return real(...args);
    });

    await svc.writeCsv(OUT, FILE, COLS, ROWS, { backoffMs: 1 });
    expect(calls).toBeGreaterThan(1);
    expect(fs.readFileSync(TARGET, 'utf8')).toContain('1,2');
  });

  it('replaces an existing file rather than failing on it', async () => {
    fs.writeFileSync(TARGET, 'stale\n');
    await svc.writeCsv(OUT, FILE, COLS, ROWS);
    expect(fs.readFileSync(TARGET, 'utf8')).not.toContain('stale');
  });

  it('still throws when the target is genuinely unwritable', async () => {
    // A non-retryable error must not be swallowed by the fallback — the step needs
    // to report it, which is what turns into the 500 the UI shows.
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(err);
    await expect(svc.writeCsv(OUT, FILE, COLS, ROWS, { backoffMs: 1 })).rejects.toThrow(/ENOENT/);
  });

  it('gives up after the configured attempts instead of retrying forever', async () => {
    let calls = 0;
    jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => {
      calls++;
      const err = new Error('UNKNOWN: unknown error, open');
      err.code = 'UNKNOWN';
      return Promise.reject(err);
    });
    await expect(svc.writeCsv(OUT, FILE, COLS, ROWS, { attempts: 2, backoffMs: 1 }))
      .rejects.toThrow(/UNKNOWN/);
    // 2 temp attempts + the one direct-write fallback.
    expect(calls).toBe(3);
  });
});

describe('writeCsv retry budget', () => {
  const OUT = path.join(ROOT, 'writecsv-budget');
  const FILE = 'budget.csv';

  afterEach(() => { jest.restoreAllMocks(); });

  it('rides out a lock that lasts several seconds — a Drive upload, not a brief blip', async () => {
    // Four consecutive UNKNOWNs is longer than the original 3-attempt budget allowed.
    // Google Drive holding the previous version while it uploads is measured in seconds,
    // not milliseconds, which is why the default is 5 attempts.
    let calls = 0;
    const real = fs.promises.writeFile;
    jest.spyOn(fs.promises, 'writeFile').mockImplementation((...args) => {
      if (++calls <= 4) {
        const err = new Error('UNKNOWN: unknown error, open');
        err.code = 'UNKNOWN';
        return Promise.reject(err);
      }
      return real(...args);
    });

    await svc.writeCsv(OUT, FILE, ['a'], [{ a: '1' }], { backoffMs: 1 });
    expect(fs.readFileSync(path.join(OUT, FILE), 'utf8')).toContain('1');
  });
});
