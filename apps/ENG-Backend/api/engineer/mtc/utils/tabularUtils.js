'use strict';

/**
 * Small pandas-shaped helpers for the Tooling Inspection import.
 *
 * These exist to make the Node port of importPCtooling.py / importDwgPrint.py
 * produce the SAME strings the pandas version produced. That matters more than
 * it looks: `ti_list` rows already in the database were written by the Python
 * pipeline and are de-duplicated by a UID built out of these formatted values,
 * so a date or time rendered one character differently re-imports the entire
 * table as "new".
 */

const XLSX = require('xlsx');

// Excel's day 1 is 1900-01-01 but it also believes 1900 was a leap year, which
// puts the usable epoch at 1899-12-30. Everything below stays in UTC so a
// server timezone can never shift a date across midnight.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

/** Excel serial number → Date (UTC). Fractional part is the time of day. */
function excelSerialToDate(serial) {
  return new Date(EXCEL_EPOCH_UTC + Math.round(serial * MS_PER_DAY));
}

/** Date → 'YYYY-MM-DD' using UTC parts (never the server's local calendar). */
function formatDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Date → 'HH:MM:SS' (UTC), matching how pandas str()s a datetime.time. */
function formatTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/**
 * pd.to_datetime(value, dayfirst=True, errors='coerce') — returns null instead
 * of raising, because the source sheets are hand-maintained and a single bad
 * cell must not abort a 4000-row import.
 *
 * Day-first only decides ambiguous d/m pairs: 05/03 is 5 March, but 05/13 falls
 * back to month-first (13 is not a month) exactly as pandas does.
 */
function parseDateDayFirst(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return excelSerialToDate(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return buildDate(+iso[1], +iso[2], +iso[3]);

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    let [, a, b, y] = dmy;
    let day = +a;
    let month = +b;
    // Month-first fallback for values day-first cannot explain (e.g. 05/13/2026).
    if (month > 12 && day <= 12) [day, month] = [month, day];
    let year = +y;
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return buildDate(year, month, day);
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

/** UTC date from parts, rejecting values that don't round-trip (e.g. 31 Feb). */
function buildDate(year, month, day) {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

/** pd.to_numeric(errors='coerce') — null for anything non-numeric. */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return null;
  const n = Number(String(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Any cell → trimmed string, with null/undefined collapsing to ''. */
function toText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).trim();
}

/**
 * Render a date-formatted Excel cell the way a reader expects to see it.
 *
 * Excel stores every date as a serial number and only the cell's number format
 * says it is a date at all, so the raw value has to be resolved here — a sheet
 * read without this writes 46021 into the CSV where the date belongs.
 *
 * Time-of-day is emitted only when the serial actually carries one: a whole
 * number is a date, a value below 1 is a bare clock time, and anything else is
 * both. That keeps the rendering stable per cell. (pandas decided this per
 * *column* — one stray text cell flipped a whole column from '2026-01-05' to
 * '2026-01-05 00:00:00' — which is the one deliberate difference from the
 * Python output.)
 */
function formatExcelDateCell(serial) {
  if (!Number.isFinite(serial)) return '';
  if (serial > 0 && serial < 1) {
    return formatTime(new Date(Date.UTC(1970, 0, 1) + Math.round(serial * MS_PER_DAY)));
  }
  const d = excelSerialToDate(serial);
  return Number.isInteger(serial) ? formatDate(d) : `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * The declared `!ref` of a worksheet is routinely far larger than the data —
 * these workbooks report A1:N1048573 for 16k rows — because formatting alone
 * extends it. Walking the real cells gives the true extent, which both keeps
 * sheet_to_json from materialising a million empty rows and drops the phantom
 * trailing columns that would otherwise show up as empty 'Unnamed: N' fields.
 */
function usedRange(ws) {
  if (!ws['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  let maxRow = -1;
  let maxCol = -1;
  for (const key of Object.keys(ws)) {
    if (key.charCodeAt(0) === 33) continue; // '!' metadata keys
    const cell = ws[key];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  if (maxRow < 0) return null;
  return { s: { r: 0, c: 0 }, e: { r: Math.min(range.e.r, maxRow), c: Math.min(range.e.c, maxCol) } };
}

/**
 * Read the first worksheet as an array of plain objects keyed by header text.
 *
 * `headerRowIdx` is 0-based and matches pandas' `header=` argument: 0 for
 * importDwgPrint (headers on row 1), 1 for importPCtooling (row 2). Blank rows
 * are kept while locating the header so a decorative empty first row cannot
 * silently shift the header up.
 *
 * Returns `{ columns, rows }` — `columns` preserves sheet order so the CSV comes
 * out in the same column order the Python version wrote.
 */
function readSheetObjects(filePath, headerRowIdx = 0) {
  // cellNF is required: without the number format there is no way to tell a date
  // cell from an ordinary number.
  const wb = XLSX.readFile(filePath, { cellDates: false, cellText: false, cellNF: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };

  const ws = wb.Sheets[sheetName];
  for (const key of Object.keys(ws)) {
    if (key.charCodeAt(0) === 33) continue;
    const cell = ws[key];
    if (!cell || cell.t !== 'n' || typeof cell.v !== 'number') continue;
    if (!cell.z || !XLSX.SSF.is_date(cell.z)) continue;
    cell.t = 's';
    cell.v = formatExcelDateCell(cell.v);
    delete cell.w;
  }

  const range = usedRange(ws);
  if (!range) return { columns: [], rows: [] };

  const grid = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
    range,
  });
  if (grid.length <= headerRowIdx) return { columns: [], rows: [] };

  const headerRow = grid[headerRowIdx] || [];
  const seen = new Map();
  const columns = headerRow.map((cell, i) => {
    // pandas names a header-less column 'Unnamed: <position>'; importDwgPrint
    // drops 'Unnamed: 11' by that exact name, so the convention has to match.
    let name = cell === null || cell === undefined ? '' : String(cell).trim();
    if (!name) name = `Unnamed: ${i}`;
    const dup = seen.get(name);
    if (dup === undefined) {
      seen.set(name, 0);
      return name;
    }
    seen.set(name, dup + 1);
    return `${name}.${dup + 1}`;
  });

  const rows = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const raw = grid[r] || [];
    const obj = {};
    let empty = true;
    for (let c = 0; c < columns.length; c++) {
      const v = raw[c] === undefined ? null : raw[c];
      if (v !== null && v !== '') empty = false;
      obj[columns[c]] = v;
    }
    if (!empty) rows.push(obj);
  }

  return { columns, rows };
}

/** RFC-4180 cell: quote only when the value contains a delimiter, quote or newline. */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialise to CSV with a UTF-8 BOM and CRLF endings — the `utf-8-sig` encoding
 * the Python used. The BOM is not cosmetic: without it Google Sheets reads the
 * Thai columns as mojibake.
 */
const UTF8_BOM = '\uFEFF';

function toCsv(columns, rows) {
  const out = [columns.map(csvCell).join(',')];
  for (const row of rows) out.push(columns.map((c) => csvCell(row[c])).join(','));
  return `${UTF8_BOM}${out.join('\r\n')}\r\n`;
}

module.exports = {
  excelSerialToDate,
  formatDate,
  formatExcelDateCell,
  formatTime,
  parseDateDayFirst,
  buildDate,
  toNumber,
  toText,
  readSheetObjects,
  csvCell,
  toCsv,
};
