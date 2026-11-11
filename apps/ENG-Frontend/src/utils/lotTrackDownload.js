/**
 * lotTrackDownload.js — save Lot Status Tracker data to the user's own machine
 * (Excel or CSV), separate from the Drive upload in lotTrackCsv.js.
 */
import * as XLSX from 'xlsx';
import { CSV_HEADER, stepToCsvRow, toCsv, fetchTrackRows } from './lotTrackCsv';

const safeFileBase = (name) =>
  String(name || '').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'lot_track';

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

// Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook.
const sheetName = (name, used) => {
  const base = String(name || 'Sheet').replace(/[[\]:*?/\\]+/g, '_').slice(0, 28) || 'Sheet';
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i += 1) n = `${base}_${i}`;
  used.add(n.toLowerCase());
  return n;
};

const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Write sheets to disk. `sheets` = [{ name, rows }] where rows exclude the header.
 * Excel → one worksheet per sheet. CSV → one file; with more than one sheet a
 * leading "Track" column tells them apart.
 */
export function downloadSheets(sheets, { fileName, format }) {
  const base = `${safeFileBase(fileName)}_${stamp()}`;
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const used = new Set();
    sheets.forEach((s) => {
      const ws = XLSX.utils.aoa_to_sheet([CSV_HEADER, ...s.rows]);
      ws['!cols'] = CSV_HEADER.map((h) => ({ wch: Math.max(10, h.length + 2) }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName(s.name, used));
    });
    XLSX.writeFile(wb, `${base}.xlsx`);
    return;
  }
  const multi = sheets.length > 1;
  const rows = multi
    ? [['Track', ...CSV_HEADER], ...sheets.flatMap((s) => s.rows.map((r) => [s.name, ...r]))]
    : [CSV_HEADER, ...(sheets[0]?.rows || [])];
  // BOM so Excel opens Thai text as UTF-8.
  saveBlob(new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
}

/** Rows for lots already loaded on screen: [{ header, steps }]. */
export const rowsFromLoaded = (lots) =>
  lots.flatMap((d) => (d.steps || []).map((s) => stepToCsvRow(d.header, s)));

/** Fetch every saved track fresh → [{ name, rows }] (empty tracks dropped) plus skip counts. */
export async function fetchAllTrackSheets(tracks) {
  const built = await Promise.all(tracks.map((t) => fetchTrackRows(t)));
  let emptyCount = 0;
  let skippedTotal = 0;
  const sheets = [];
  built.forEach((b, i) => {
    skippedTotal += b.skipped;
    if (!b.rows.length) { emptyCount += 1; return; }
    sheets.push({ name: tracks[i].name || `track_${tracks[i].id}`, rows: b.rows });
  });
  return { sheets, emptyCount, skippedTotal };
}
