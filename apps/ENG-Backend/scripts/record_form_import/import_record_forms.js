'use strict';

/**
 * Imports the forms parsed from a "NEW MODEL (Detail-…)" workbook into pr_record / pr_record_step.
 *
 *   python -I parse_new_model_workbook.py "NEW MODEL (Detail-COMP).xlsx" "RECORD(comp)" comp.json
 *   node import_record_forms.js comp.json --source "NEW MODEL (Detail-COMP).xlsx" [--dry-run] [--replace]
 *
 * Corrections: after the uncertain dates were removed (uncertain_established_dates.csv), fill the
 * `corrected_date` column and run
 *   node import_record_forms.js comp.json --source "NEW MODEL (Detail-COMP).xlsx" --from-csv uncertain_established_dates.csv
 * which adds ONLY the CSV rows that have a date (for this source), with that date. It deletes nothing and
 * skips a row already in the database, so it can be run again as more dates come back.
 *
 * Imported rows are tagged header.imported_from = <source>, status 'recorded', created_by 'import'.
 * Re-running is safe: a source that is already imported is skipped unless --replace, which
 * deletes that source's earlier import (and only that) first. Everything runs in one transaction.
 */
const fs = require('fs');
const { engPool } = require('../../instance/eng_db');
const { TABLES: T } = require('../../api/engineer/process/record_form/recordFormConstants');
const { maqPool } = require('../../instance/maq_db');
const { buildRecords, parseDate } = require('./recordFormImport');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const opt = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const dry = args.includes('--dry-run');
const replace = args.includes('--replace');
const source = opt('source');
const csvFile = opt('from-csv');
const SHORT = { 'NEW MODEL (Detail-COMP).xlsx': 'COMP', 'NEW MODEL (Detail-ASSY).2.xlsx': 'ASSY' };

/** `lot|control_no` → the lot's entry date in the plan (lpb.pc_lot), the evidence for ambiguous dates. */
async function lotEntryDates(forms) {
  const lots = [...new Set(forms.map(f => f.lot_no).filter(Boolean))];
  const map = new Map();
  try {
    const { rows } = await maqPool.query(
      `SELECT lot_no, control_no, to_char(entry_date, 'YYYY-MM-DD') AS entry FROM lpb.pc_lot WHERE lot_no = ANY($1) AND entry_date IS NOT NULL`, [lots]);
    for (const r of rows) map.set(`${r.lot_no}|${String(r.control_no).replace(/-.*/, '')}`, r.entry);
  } catch (e) { console.warn(`plan lookup failed (${e.message}) — falling back to neighbour order only`); }
  console.log(`plan entry date known for ${map.size} lot/C-N pairs`);
  return map;
}

/** Minimal CSV reader for the file we wrote ("quoted","fields", optional BOM). */
function readCsv(path) {
  const lines = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const cells = l => [...l.matchAll(/"((?:[^"]|"")*)"|([^,]+)|(?<=,)(?=,|$)/g)].map(m => (m[1] ?? m[2] ?? '').replace(/""/g, '"'));
  const head = cells(lines[0]);
  return lines.slice(1).map(l => Object.fromEntries(cells(l).map((v, i) => [head[i], v])));
}

async function insertRecord(c, templateId, r) {
  const ins = await c.query(
    `INSERT INTO ${T.RECORD} (template_id, lot_no, control_no, parts_no, drawing_rev, header, status, record_rev,
                              established_date, revised_date, created_by, created_by_name, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,'recorded',$7,$8,$9,'import',$10,'import') RETURNING id`,
    [templateId, r.lot_no, r.control_no, r.parts_no, r.drawing_rev, JSON.stringify(r.header), r.record_rev,
     r.established_date, r.revised_date, source.replace(/\.xlsx$/i, '')]); // shown in the list's "Created by" column
  if (!r.steps.length) return;
  const vals = [], ph = r.steps.map((s, i) => {
    vals.push(ins.rows[0].id, i + 1, s.process_code, s.process_name, JSON.stringify(s.values));
    const b = i * 5;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
  });
  await c.query(`INSERT INTO ${T.STEP} (record_id, step_no, process_code, process_name, "values") VALUES ${ph.join(',')}`, vals);
}

async function main() {
  if (!file || !source) throw new Error('usage: node import_record_forms.js <forms.json> --source "<workbook name>" [--dry-run] [--replace]');
  const forms = JSON.parse(fs.readFileSync(file, 'utf8'));
  const records = buildRecords(forms, source, await lotEntryDates(forms));
  if (csvFile) return importCorrections(records);
  const withSteps = records.filter(r => r.steps.length).length;
  console.log(`${source}: ${records.length} records (${withSteps} with processes, ${records.length - withSteps} without), ` +
    `${records.reduce((n, r) => n + r.steps.length, 0)} process rows, ` +
    `${records.filter(r => !r.established_date).length} with no readable established date`);
  if (dry) return;

  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    const have = await c.query(`SELECT count(*)::int n FROM ${T.RECORD} WHERE header->>'imported_from' = $1`, [source]);
    if (have.rows[0].n && !replace) {
      console.log(`already imported (${have.rows[0].n} records) — skipped; use --replace to redo`);
      await c.query('ROLLBACK');
      return;
    }
    if (have.rows[0].n) {
      await c.query(`DELETE FROM ${T.RECORD} WHERE header->>'imported_from' = $1`, [source]); // steps cascade
      console.log(`removed ${have.rows[0].n} earlier records from this source`);
    }
    const tpl = (await c.query(`SELECT id FROM ${T.TEMPLATE} ORDER BY is_default DESC, id LIMIT 1`)).rows[0];
    if (!tpl) throw new Error('no form template found');
    for (const r of records) await insertRecord(c, tpl.id, r);
    await c.query('COMMIT');
    console.log(`imported ${records.length} records`);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

async function importCorrections(records) {
  const fixes = new Map();
  for (const r of readCsv(csvFile)) {
    if (r.source !== SHORT[source] || !String(r.corrected_date || '').trim()) continue;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(r.corrected_date.trim()) ? r.corrected_date.trim() : parseDate(r.corrected_date);
    if (!d || Number.isNaN(Date.parse(d))) { console.warn(`row ${r.sheet_row} ${r.lot_no}: cannot read corrected_date "${r.corrected_date}" — skipped`); continue; }
    fixes.set(`${r.sheet_row}|${r.lot_no}|${r.control_no}`, d);
  }
  const todo = records.map(r => ({ r, d: fixes.get(`${/^row (\d+)/.exec(r.header.imported_cell)[1]}|${r.lot_no}|${r.control_no}`) })).filter(x => x.d);
  console.log(`${fixes.size} corrected dates in the CSV for this source; ${todo.length} match a parsed form`);
  if (dry || !todo.length) return;
  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    const tpl = (await c.query(`SELECT id FROM ${T.TEMPLATE} ORDER BY is_default DESC, id LIMIT 1`)).rows[0];
    let added = 0, had = 0;
    for (const { r, d } of todo) {
      const dup = await c.query(`SELECT 1 FROM ${T.RECORD} WHERE header->>'imported_from' = $1 AND lot_no = $2 AND control_no = $3 AND header->>'imported_cell' = $4`,
        [source, r.lot_no, r.control_no, r.header.imported_cell]);
      if (dup.rowCount) { had++; continue; }
      await insertRecord(c, tpl.id, { ...r, established_date: d, header: { ...r.header, date_confirmed: true } });
      added++;
    }
    await c.query('COMMIT');
    console.log(`added ${added} records (${had} were already in the database)`);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => { engPool.end(); maqPool.end(); });
