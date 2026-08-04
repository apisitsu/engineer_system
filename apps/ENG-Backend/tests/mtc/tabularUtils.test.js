'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const t = require('../../api/engineer/mtc/utils/tabularUtils');

describe('parseDateDayFirst', () => {
  const iso = (v) => t.formatDate(t.parseDateDayFirst(v));

  it('reads d/m/y day-first, like pandas dayfirst=True', () => {
    expect(iso('05/03/2026')).toBe('2026-03-05');
    expect(iso('25-12-2026')).toBe('2026-12-25');
  });

  it('falls back to month-first when the first field cannot be a day', () => {
    expect(iso('05/13/2026')).toBe('2026-05-13');
  });

  it('reads ISO strings unchanged', () => {
    expect(iso('2026-03-09')).toBe('2026-03-09');
    expect(iso('2026-03-09 00:00:00')).toBe('2026-03-09');
  });

  it('converts Excel serial numbers off the 1899-12-30 epoch', () => {
    expect(iso(45658)).toBe('2025-01-01');
    expect(iso(1)).toBe('1899-12-31');
  });

  it('coerces unparseable values to null rather than throwing', () => {
    expect(t.parseDateDayFirst('garbage')).toBeNull();
    expect(t.parseDateDayFirst('')).toBeNull();
    expect(t.parseDateDayFirst(null)).toBeNull();
    expect(t.parseDateDayFirst(undefined)).toBeNull();
    expect(t.parseDateDayFirst('31/02/2026')).toBeNull(); // 31 Feb does not round-trip
  });

  it('is timezone-independent', () => {
    // A local-midnight Date would slip a day either side of UTC; UTC parts do not.
    expect(iso(45658)).toBe('2025-01-01');
    expect(t.formatDate(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01-01');
  });
});

describe('toNumber', () => {
  it('coerces numeric text and rejects the rest', () => {
    expect(t.toNumber('42')).toBe(42);
    expect(t.toNumber('1,200')).toBe(1200);
    expect(t.toNumber(7.5)).toBe(7.5);
    expect(t.toNumber('abc')).toBeNull();
    expect(t.toNumber('')).toBeNull();
    expect(t.toNumber(null)).toBeNull();
  });
});

describe('toCsv', () => {
  it('prefixes a UTF-8 BOM so Google Sheets reads Thai text', () => {
    expect(t.toCsv(['a'], [{ a: 'ก' }]).charCodeAt(0)).toBe(0xfeff);
  });

  it('quotes only cells containing a delimiter, quote or newline', () => {
    const csv = t.toCsv(['a', 'b', 'c'], [{ a: 'x,1', b: 'say "hi"', c: 'plain' }]);
    expect(csv).toContain('"x,1"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain(',plain');
  });

  it('renders missing keys as empty cells', () => {
    expect(t.toCsv(['a', 'b'], [{ a: 1 }])).toContain('1,\r\n');
  });
});

describe('readSheetObjects', () => {
  let dir;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabular-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const writeSheet = (name, rows) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    const file = path.join(dir, name);
    XLSX.writeFile(wb, file);
    return file;
  };

  it('honours a 0-based header row, matching pandas header=', () => {
    const file = writeSheet('h1.xlsx', [
      ['REPORT TITLE'],
      ['PO No.', 'NAME'],
      ['PO-1', 'Ring'],
    ]);
    const { columns, rows } = t.readSheetObjects(file, 1);
    expect(columns).toEqual(['PO No.', 'NAME']);
    expect(rows).toEqual([{ 'PO No.': 'PO-1', NAME: 'Ring' }]);
  });

  it('does not let a blank leading row shift the header up', () => {
    const file = writeSheet('h2.xlsx', [
      [null],
      ['PO No.', 'NAME'],
      ['PO-1', 'Ring'],
    ]);
    expect(t.readSheetObjects(file, 1).columns).toEqual(['PO No.', 'NAME']);
  });

  it('names header-less columns "Unnamed: <position>" the way pandas does', () => {
    const file = writeSheet('h3.xlsx', [
      ['LOT NO.', '', 'ชุด'],
      ['L-1', 'x', 3],
    ]);
    expect(t.readSheetObjects(file, 0).columns).toEqual(['LOT NO.', 'Unnamed: 1', 'ชุด']);
  });

  it('trims header whitespace and skips fully blank data rows', () => {
    const file = writeSheet('h4.xlsx', [
      ['  PO No.  ', ' NAME '],
      ['PO-1', 'Ring'],
      [null, null],
      ['PO-2', 'Race'],
    ]);
    const { columns, rows } = t.readSheetObjects(file, 0);
    expect(columns).toEqual(['PO No.', 'NAME']);
    expect(rows).toHaveLength(2);
  });

  it('returns an empty result when the header row is past the end of the sheet', () => {
    const file = writeSheet('h5.xlsx', [['only one row']]);
    expect(t.readSheetObjects(file, 5)).toEqual({ columns: [], rows: [] });
  });

  // Regression: date cells came through as raw serials (46021 instead of
  // 2025-12-30) because only the cell's number format marks it as a date.
  it('renders date-formatted cells as dates, not Excel serials', () => {
    // Built cell-by-cell because that is how a real workbook stores a date: a
    // plain serial plus a date number format. (Handing SheetJS a Date object
    // instead would bake the writer's local timezone into the serial.)
    const wb = XLSX.utils.book_new();
    const ws = {
      '!ref': 'A1:B2',
      A1: { t: 's', v: 'Date (income)' },
      B1: { t: 's', v: 'Qty' },
      A2: { t: 'n', v: 46021, z: 'yyyy-mm-dd' },
      B2: { t: 'n', v: 2 },
    };
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const file = path.join(dir, 'dates.xlsx');
    XLSX.writeFile(wb, file);

    const { rows } = t.readSheetObjects(file, 0);
    expect(rows[0]['Date (income)']).toBe('2025-12-30');
    expect(rows[0].Qty).toBe(2); // an ordinary number is left alone
  });

  // Regression: these workbooks declare A1:N1048573 for 16k rows of data, which
  // both materialised a million empty rows and invented trailing 'Unnamed: N'
  // columns the Python output did not have.
  it('ignores a declared range far larger than the populated cells', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['LOT NO.', 'ITEM'],
      ['L-1', 'Ring'],
    ]);
    ws['!ref'] = 'A1:N1048573';
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const file = path.join(dir, 'bloated.xlsx');
    XLSX.writeFile(wb, file);

    const { columns, rows } = t.readSheetObjects(file, 0);
    expect(columns).toEqual(['LOT NO.', 'ITEM']);
    expect(rows).toEqual([{ 'LOT NO.': 'L-1', ITEM: 'Ring' }]);
  });
});

describe('formatExcelDateCell', () => {
  it('emits a bare date for a whole-day serial', () => {
    expect(t.formatExcelDateCell(46021)).toBe('2025-12-30');
  });

  it('emits a clock time for a sub-1 serial, which is a time-only cell', () => {
    expect(t.formatExcelDateCell(0.375)).toBe('09:00:00');
  });

  it('emits both when the serial actually carries a time of day', () => {
    expect(t.formatExcelDateCell(46021.5)).toBe('2025-12-30 12:00:00');
  });
});
