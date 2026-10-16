'use strict';

/**
 * Pure helpers for importing the "NEW MODEL (Detail-COMP / Detail-ASSY)" workbooks into
 * pr_record / pr_record_step. No I/O here so the rules can be unit-tested
 * (tests/process/recordFormImport.test.js); the CLI is import_record_forms.js.
 */

const CONTINUATION_MIN_STEPS = 20; // the form has 21 rows; a route that fills it carries on in the next block

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Every reading of a date string, most likely first. The sheets were typed by hand over three
 * years: 2023-06-05, 08-06-2023, 12-04-24, 22/01/24, 05-MAR-25, 9/16/2026. When both orders
 * are possible (08-06-2023) the list holds two dates — month-first, then day-first — and
 * resolveDates() picks. Unreadable input (20-04-20204, 16/03/202) gives [].
 */
function dateCandidates(v) {
  if (v == null) return [];
  const s = String(v).trim().toUpperCase();
  const mk = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (y < 2000 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) return [mk(r[1], r[2], r[3])].filter(Boolean);
  if ((r = /^(\d{1,2})[-/.]([A-Z]{3})[-/.](\d{2}|\d{4})$/.exec(s))) {
    const m = MONTHS.indexOf(r[2]) + 1;
    return m ? [mk(r[3], m, r[1])].filter(Boolean) : [];
  }
  if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) {
    return [...new Set([mk(r[3], r[1], r[2]), mk(r[3], r[2], r[1])].filter(Boolean))]; // month-first, then day-first
  }
  return [];
}

/** Single-date reading: the first (month-first) candidate, or null. */
const parseDate = v => dateCandidates(v)[0] ?? null;

const DAY_MS = 86400000;
const WINDOW_DAYS = 45;
const REF_WINDOW_DAYS = 60;
const ts = iso => Date.parse(`${iso}T00:00:00Z`);

/**
 * Dates for a list of values in sheet order (`refs[i]` = the lot's entry date from the plan, if known).
 *   1. only one reading is possible (28/6/2023, 9/16/2026)        → that one;
 *   2. both are possible → the one within 60 days of the lot's entry date, if exactly one is;
 *   3. else the one within 45 days of the nearest unambiguous date either side (the forms were
 *      filed as they were made, so the rows run roughly in time);
 *   4. still undecided (both fit, or neither) → month-first, the order the sheets' author uses.
 * Measured on the ASSY sheet (157 ambiguous): 88 fit day-first only, 2 month-first only,
 * 57 either, 9 neither — so rule 2 matters; rule 3 is the author's stated convention.
 */
function resolveDates(values, refs = []) {
  const cands = values.map(dateCandidates);
  const sure = cands.map(c => (c.length === 1 ? ts(c[0]) : null));
  const near = (i, dir) => { for (let j = i + dir; j >= 0 && j < sure.length; j += dir) if (sure[j] != null) return sure[j]; return null; };
  return cands.map((c, i) => {
    if (c.length <= 1) return c[0] ?? null;
    // 1. the lot's own entry date in the plan: the form is made within days of the lot opening
    //    (measured on 747 records: median +3 days, 5–95 % within −28…+39), and the two
    //    readings of a date are normally months apart.
    if (refs[i]) {
      const close = c.filter(d => Math.abs(ts(d) - ts(refs[i])) <= REF_WINDOW_DAYS * DAY_MS);
      if (close.length === 1) return close[0];
    }
    const lo = near(i, -1), hi = near(i, 1);
    const fits = c.filter(d => (lo == null || ts(d) >= lo - WINDOW_DAYS * DAY_MS) && (hi == null || ts(d) <= hi + WINDOW_DAYS * DAY_MS));
    return fits.length === 1 ? fits[0] : c[0];
  });
}

/** Record revision: blank / NC / N/C → 0, A → 1 … Z → 26, AA → 27 (the inverse of the UI's revLabel). */
function parseRev(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s || s === 'NC' || s === 'N/C') return { rev: 0, odd: false };
  if (/^[A-Z]{1,2}$/.test(s)) return { rev: [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0), odd: false };
  return { rev: 0, odd: true };
}

/** "3511 PLATE" → { code: '3511', name: 'PLATE' } (a name with no leading code keeps code null). */
function splitProcess(text) {
  const t = String(text ?? '').trim();
  const m = /^(\d{4})\s+(.*)$/.exec(t);
  return m ? { code: m[1], name: m[2].trim() } : { code: null, name: t };
}

const stepKey = f => JSON.stringify((f.steps || []).map(s => s.text));

/**
 * One lot + C/N can appear in several blocks. From the data:
 *  - an exact copy, or a blank copy next to a filled one → the same form, keep one;
 *  - the previous block is full (≥ 20 steps) and the next sits in the same row → the route
 *    continues on a second form (P42850: 20 + 4 steps), so its steps are appended;
 *  - anything else (a different route for the same lot, or the same lot on another row of the
 *    sheet) is a separate record — it was entered separately, so it is kept separately.
 */
function mergeGroup(entries) {
  const kept = [];
  for (const f of [...entries].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const steps = f.steps || [];
    if (kept.some(k => stepKey(k) === stepKey(f))) continue;
    if (!steps.length && kept.length) continue;
    const prev = kept[kept.length - 1];
    if (prev && prev.row === f.row && prev.steps.length >= CONTINUATION_MIN_STEPS && steps.length) {
      prev.steps = [...prev.steps, ...steps];
      prev.continued = (prev.continued || 1) + 1;
      continue;
    }
    kept.push({ ...f, steps: [...steps] });
  }
  return kept;
}

/** Raw parsed forms → the records to insert (empty template slots are dropped). */
function buildRecords(forms, source, entryDates = new Map()) {
  const ordered = [...forms].sort((a, b) => a.row - b.row || a.col - b.col);
  const resolved = resolveDates(ordered.map(f => f.established_date),
    ordered.map(f => entryDates.get(`${f.lot_no}|${f.control_no}`) ?? null));
  ordered.forEach((f, i) => { f.established_iso = resolved[i]; });
  const groups = new Map();
  for (const f of forms) {
    if (!f.lot_no && !f.control_no) continue;
    const k = `${f.lot_no}|${f.control_no}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(f);
  }
  const out = [];
  for (const entries of groups.values()) {
    for (const f of mergeGroup(entries)) {
      const { rev, odd } = parseRev(f.record_rev);
      const est = f.established_iso ?? null;
      const header = {
        process_code: f.process_code, ref_pn: f.ref_pn, customer_pn: f.customer_pn,
        final_decided: f.final_decided, engineer_stamp: f.engineer_stamp,
        imported_from: source, imported_cell: `row ${f.row}, col ${f.col + 1}`,
      };
      if (!est && f.established_date) header.established_raw = f.established_date; // keep what could not be read
      if (odd) header.record_rev_raw = f.record_rev;
      if (f.continued) header.continued_blocks = f.continued;
      for (const k of Object.keys(header)) if (header[k] == null) delete header[k];
      out.push({
        lot_no: f.lot_no, control_no: f.control_no, parts_no: f.parts_no, drawing_rev: f.drawing_rev,
        established_date: est, record_rev: rev, revised_date: parseDate(f.revised_date), header,
        steps: f.steps.map(s => {
          const { code, name } = splitProcess(s.text);
          return { process_code: code, process_name: name, values: s.remark ? { remark: s.remark } : {} };
        }),
      });
    }
  }
  return out;
}

module.exports = { dateCandidates, resolveDates, parseDate, parseRev, splitProcess, mergeGroup, buildRecords, CONTINUATION_MIN_STEPS };
