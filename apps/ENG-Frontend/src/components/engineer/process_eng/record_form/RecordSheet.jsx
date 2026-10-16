import React from 'react';
import './recordForm.css';

/** Revision letter: 0 → N/C (no change yet), 1 → A, 2 → B … 26 → Z, 27 → AA. */
export function revLabel(n) {
  let k = Number(n) || 0;
  if (k <= 0) return 'N/C';
  let s = '';
  while (k > 0) { s = String.fromCharCode(65 + ((k - 1) % 26)) + s; k = Math.floor((k - 1) / 26); }
  return s;
}

const fmtDate = v => (v ? String(v).slice(0, 10) : '');

/** Value shown in a header box, by where the field's `source` points. */
export function fieldValue(f, rec) {
  switch (f.source) {
    case 'lot_no': return rec.lot_no ?? '';
    case 'control_no': return rec.control_no ?? '';
    case 'parts_no': return rec.parts_no ?? '';
    case 'drawing_rev': return rec.drawing_rev ?? '';
    case 'established_date': return fmtDate(rec.established_date);
    // N/C = no change: a fresh form has not been revised yet
    case 'revised_date': return fmtDate(rec.revised_date) || 'N/C';
    case 'record_rev': return revLabel(rec.record_rev);
    default: return rec.header?.[f.key] ?? '';
  }
}

// ESTABLISHED DATE is editable (a record may be filled in after the fact); the revision boxes are system-kept
const SYSTEM_SOURCES = ['revised_date', 'record_rev'];

/**
 * The paper form. Same component for the editor, the designer preview and the
 * printout — `editable` only swaps the boxes between inputs and plain text, so
 * what is on screen is what is printed.
 */
export default function RecordSheet({ layout, record, editable = false, onChange }) {
  const leftPct = Number(layout.headerPct) || 63;
  const units = Number(layout.headerUnits) || 88.8;
  const rows = [...new Set(layout.headerFields.map(f => f.row))].sort((a, b) => a - b);
  const steps = record.steps || [];
  const total = Math.max(layout.rowCount, steps.length);
  const widthSum = layout.columns.reduce((s, c) => s + (Number(c.width) || 1), 0);

  const setField = (f, v) => {
    if (['lot_no', 'control_no', 'parts_no', 'drawing_rev', 'established_date'].includes(f.source)) onChange({ ...record, [f.source]: v });
    else onChange({ ...record, header: { ...record.header, [f.key]: v } });
  };
  const setStep = (i, patch) => {
    const next = steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange({ ...record, steps: next });
  };
  const setCell = (i, key, v) => setStep(i, { values: { ...(steps[i].values || {}), [key]: v } });
  const setBox = (key, v) => onChange({ ...record, header: { ...record.header, [key]: v } });

  const input = (value, onCh, extra = {}) =>
    editable
      ? <input className="rf-input" value={value ?? ''} onChange={e => onCh(e.target.value)} {...extra} />
      : <span className="rf-text">{value}</span>;

  return (
    <div className={`rf-sheet rf-${layout.orientation || 'landscape'}`}>
      <div className="rf-top">
        <div className="rf-left" style={{ width: `${leftPct}%` }}>
          <div className="rf-title">{layout.title}</div>
          <div className="rf-subtitle">{layout.subtitle}</div>
          <div className="rf-header">
            {rows.map(r => (
              <div className="rf-hrow" key={r}>
                {layout.headerFields.filter(f => f.row === r).map(f => {
                  const span = Number(f.span) || 1;
                  const lw = Math.min(Number(f.labelW) || span / 2, span);
                  return (
                    <div className="rf-hcell" style={{ width: `${(span / units) * 100}%` }} key={f.key}>
                      <span className="rf-hlabel" style={{ minWidth: `${(lw / span) * 100}%` }}>{f.label}</span>
                      <span className={`rf-hval${f.boxed ? ' rf-boxed' : ''}`}>
                        {SYSTEM_SOURCES.includes(f.source)
                          ? <span className="rf-text">{fieldValue(f, record)}</span>
                          : input(fieldValue(f, record), v => setField(f, v), f.source === 'established_date' ? { type: 'date' } : {})}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="rf-boxes" style={{ width: `${100 - leftPct}%` }}>
          {layout.sideBoxes.map(b => (
            <div className="rf-box" style={{ flex: Number(b.w) || 1 }} key={b.key}>
              <div className="rf-box-label">{b.label}</div>
              <div className="rf-box-body">{input(record.header?.[b.key], v => setBox(b.key, v))}</div>
            </div>
          ))}
        </div>
      </div>

      <table className="rf-table">
        <colgroup>
          {layout.columns.map(c => <col key={c.key} style={{ width: `${((Number(c.width) || 1) / widthSum) * 100}%` }} />)}
        </colgroup>
        <thead>
          <tr>{layout.columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: total }, (_, i) => {
            const s = steps[i];
            return (
              <tr key={i}>
                {layout.columns.map(c => (
                  <td key={c.key} className={c.kind === 'no' ? 'rf-c' : ''}>
                    {c.kind === 'no' ? i + 1
                      : !s ? null
                      : c.kind === 'process' ? (
                        <span className="rf-proc">
                          {s.process_code ? <span className="rf-code">{s.process_code}</span> : null}
                          {input(s.process_name, v => setStep(i, { process_name: v }))}
                        </span>)
                      : input(s.values?.[c.key], v => setCell(i, c.key, v))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
