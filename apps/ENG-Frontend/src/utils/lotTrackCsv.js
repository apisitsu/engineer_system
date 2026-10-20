/**
 * lotTrackCsv.js — build the Lot Status Tracker CSV files for saved tracks.
 *
 * Shared by the Lot Status Tracker's own Export buttons and by Tooling
 * Inspection's "Update data", so both write byte-identical files to the same
 * Drive folder. A file is one saved track, one row per process step, mirroring
 * the Process detail table on screen.
 */
import { server } from '../constance/constance';
import { httpClient as axios } from './HttpClient';

export const fmtMinutes = (m) => {
  if (m == null || Number.isNaN(m)) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};
export const fmtDays = (d) => (d == null ? '—' : d === 0 ? 'same day' : `${d} d`);

export const STATUS_META = {
  done: { step: 'finish', tag: 'success', label: 'Done' },
  current: { step: 'process', tag: 'processing', label: 'In progress' },
  pending: { step: 'wait', tag: 'default', label: 'Waiting' },
};

const CSV_HEADER = [
  'Lot No', 'Control No', 'Part No', '#', 'Process', 'Code', 'Status',
  'Machine / WC', 'good / ng', 'Cycle', 'Setup', 'Run time', 'Done', 'Total time inprocess',
];
// One row per process step, mirroring the Process detail table exactly —
// same labels and formatting the user already sees on screen.
const stepToCsvRow = (h, s) => [
  h.lotNo, h.controlNo, h.partsNo,
  s.order, s.nameEn, s.processCode, (STATUS_META[s.status] || STATUS_META.pending).label,
  s.machineLabel ? `${s.machineLabel}${s.wc ? ` · WC ${s.wc}` : ''}` : '—',
  s.goodQty == null ? '—' : `${s.goodQty}${s.badQty ? ` / ${s.badQty} ng` : ''}`,
  s.cycleSec ? `${s.cycleSec}s` : '—',
  s.setupSec ? fmtMinutes(Math.round(s.setupSec / 60)) : '—',
  s.runMinutes == null ? '—' : fmtMinutes(s.runMinutes),
  s.compDate || '—',
  fmtDays(s.dwellDays),
];
const csvEscape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
// The deployed GAS uploader only accepts /^[A-Za-z0-9_-]+\.csv$/ (see
// gas_ti_csv_doPost.gs) — a Thai-only save name has nothing left after
// stripping, so it falls back to the track id rather than an empty name.
const sanitizeCsvName = (name, fallbackId) => {
  const base = String(name || '').trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return `${base || `track_${fallbackId}`}.csv`;
};
const utf8ToBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

/**
 * Build one CSV file ({ fileName, base64Data, skipped }) for ONE saved track —
 * fetched fresh, independent of whatever is on screen. Returns
 * `{ empty: true, skipped }` when there is nothing to write. `onLot` is called
 * once per lot fetched, for progress.
 */
export async function buildTrackCsvFile(track, { onLot } = {}) {
  const lots = track.lots || [];
  if (!lots.length) return { empty: true, skipped: 0 };
  const responses = await Promise.all(lots.map((l) =>
    axios.get(`${server.MTC_LOT_TRACK}/${encodeURIComponent(l.lotNo)}`, {
      params: l.controlNo ? { control_no: l.controlNo } : {},
    }).then((r) => r.data).catch(() => null).finally(() => { if (onLot) onLot(); }),
  ));
  const rows = [CSV_HEADER];
  let skipped = 0;
  responses.forEach((d) => {
    if (!d || !d.found || d.ambiguous) { skipped += 1; return; }
    (d.steps || []).forEach((s) => rows.push(stepToCsvRow(d.header, s)));
  });
  if (rows.length === 1) return { empty: true, skipped };
  return { fileName: sanitizeCsvName(track.name, track.id), base64Data: utf8ToBase64(toCsv(rows)), skipped };
}

/**
 * Build one CSV per track for a list of saved tracks.
 * Two tracks whose names sanitize to the same string would otherwise silently
 * overwrite one another on Drive (the GAS script updates in place by filename) —
 * de-dup with a numeric suffix.
 *
 * @param {Array} tracks            saved tracks ({ id, name, lots })
 * @param {{onProgress?:(done:number,total:number)=>void}} [opts]
 * @returns {Promise<{files:Array<{fileName:string,base64Data:string}>, emptyCount:number, skippedTotal:number}>}
 */
export async function buildAllTrackCsvFiles(tracks, { onProgress } = {}) {
  const total = tracks.reduce((n, t) => n + (t.lots || []).length, 0);
  let done = 0;
  const onLot = () => { done += 1; if (onProgress) onProgress(done, total); };
  const built = await Promise.all(tracks.map((t) => buildTrackCsvFile(t, { onLot })));
  const seen = new Map();
  const files = [];
  let emptyCount = 0;
  let skippedTotal = 0;
  built.forEach((f) => {
    if (!f || f.empty) { emptyCount += 1; return; }
    const n = (seen.get(f.fileName) || 0) + 1;
    seen.set(f.fileName, n);
    const fileName = n > 1 ? f.fileName.replace(/\.csv$/, `_${n}.csv`) : f.fileName;
    files.push({ fileName, base64Data: f.base64Data });
    skippedTotal += f.skipped;
  });
  return { files, emptyCount, skippedTotal };
}
