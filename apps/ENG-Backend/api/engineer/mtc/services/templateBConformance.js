'use strict';

/**
 * TEMPLATE_B conformance — how much of the workbook the live Machine Tool Config covers.
 * ------------------------------------------------------------------------------
 * Answers, per (machine, process): which DWG families TEMPLATE_B specifies, which
 * `sds_machine_tool` actually has, and how many C/Ns the factory plan puts behind each.
 * Built for the report page; the method is the one validated in
 * api/engineer/mtc/doc/tooling_select_audit_findings.md (รอบที่ห้า) and every rule below cost a wrong answer
 * on the way there.
 *
 * THREE THINGS THAT SILENTLY CHANGE THE RESULT
 *
 * 1. **Resolve a row to a machine through the DWG family, never the machine column.** That
 *    column holds 45 different spellings (`KS-B22G (ID≦φ15.875MAX)`, `(FTL)`, `KS H70`) and
 *    **339 usable rows leave it blank** — the machine is inherited from the block header
 *    above. `machine_type_code` = the family's middle digits (4858 → 858 → XD-8) resolves
 *    162 of 162 families.
 *
 * 2. **Drop two row classes before counting.** A grey fill means "not selected for this part
 *    family" (145 rows); a DWG in parentheses — `(4858-09-` — is a sub-component of the ASSY
 *    above it, not its own T-slot (37 rows). Counting either inflates the gap list with
 *    things that were never meant to be slots.
 *
 * 3. **"Differs from TEMPLATE_B" is not "wrong".** Of the config rows the workbook does not
 *    list, most are the `…1 / …2` process pair (it usually writes only the first) or the
 *    factory plan running ahead of the workbook. The payload keeps them in their own bucket
 *    rather than calling them defects.
 *
 * The workbook is read from disk once per process (`doc/TEMPLATE_B.xlsx`, vendored) and
 * cached in memory — it only changes when someone commits a new copy.
 */

const path = require('path');
const XLSX = require('xlsx');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { TABLES } = require('../mtcConstants');

const WORKBOOK = path.join(__dirname, '../doc/TEMPLATE_B.xlsx');
const SKIP_SHEETS = new Set(['LINK LIST', 'TEMPLATE']);

// ── workbook ────────────────────────────────────────────────────────────────
let _sheetCache = null;

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Any fill at all marks the row as not-selected for that part family. The workbook uses
// both explicit rgb (66FFFF, FFFFCC) and theme0 with a negative tint; treating only one as
// "grey" reads half the convention. Sanity: a run of NO fill anywhere means the parser is
// wrong, not that everything is selected.
function isFilled(cell) {
  const f = cell && cell.s && cell.s.fgColor;
  if (!f) return false;
  if (f.rgb) return true;
  return f.theme !== undefined && Number(f.tint || 0) < 0;
}

function readWorkbook() {
  if (_sheetCache) return _sheetCache;
  const wb = XLSX.readFile(WORKBOOK, { cellStyles: true });
  const rows = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name)) continue;
    const sh = wb.Sheets[name];
    if (!sh || !sh['!ref']) continue;
    const R = XLSX.utils.decode_range(sh['!ref']);
    let procs = [], pname = '';
    for (let r = R.s.r; r <= R.e.r; r++) {
      const cell = (c) => sh[XLSX.utils.encode_cell({ r, c })];
      const val = (c) => { const x = cell(c); return String((x && (x.w !== undefined ? x.w : x.v)) ?? ''); };
      const first = clean(val(0));
      if (first) {                                  // a new process block starts here
        procs = val(0).match(/\b\d{4}\b/g) || [];
        pname = clean(val(1)).replace(/\s*\/\s*/g, ' / ');
      }
      const tool = clean(val(4));
      const dwgRaw = clean(val(5));
      if (!procs.length || (!tool && !dwgRaw)) continue;
      const sub = /^\(/.test(dwgRaw) || /^\(/.test(tool);          // sub-component of the ASSY above
      const grey = isFilled(cell(4)) || isFilled(cell(5));         // not selected for this family
      if (sub || grey) continue;
      const families = dwgRaw.match(/\b\d{4}-\d{2}\b/g) || [];
      if (!families.length) continue;
      rows.push({ sheet: name, procs, pname, tool, families });
    }
  }
  _sheetCache = rows;
  return rows;
}

// ── build ───────────────────────────────────────────────────────────────────

const NO_NAME = 'ทะเบียนยังไม่มีชื่อเครื่อง — ตั้งชื่อใน Machine Types ก่อนจึงจะตั้ง config ได้';
const NO_PLAN = 'แผนโรงงานไม่เคยใช้ตระกูลนี้ที่ process นี้';
const UNREACHABLE = 'SDS เปิดชีตของคลาสนี้ไม่ได้ (part type ไม่รองรับ)';

// Classes getSearchData has no dimension table for — a sheet can never open for them, so a
// gap on those (machine, process) pairs is not a config gap. Kept as a prefix list because
// that is what the renderer actually rejects.
const UNREACHABLE_CLASS = /^(F0|00)/;

async function build() {
  const tb = readWorkbook();

  const [{ rows: codes }, { rows: cfg }, { rows: planFam }, { rows: names }] = await Promise.all([
    engPool.query(`SELECT machine_type_code, machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE}`),
    engPool.query(
      `SELECT machine_type, process_code, tool_number, tool_drawing_no
         FROM ${TABLES.SDS_V2_MACHINE_TOOL} WHERE tool_drawing_no <> ''
        ORDER BY machine_type, process_code, LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`),
    maqPool.query(
      `SELECT process_code,
              split_part(tool_dwg_no,'-',1)||'-'||split_part(tool_dwg_no,'-',2) AS fam,
              count(DISTINCT process_plan_no)::int AS cns,
              count(DISTINCT process_plan_no) FILTER (WHERE process_plan_no ~ '^(F0|00)')::int AS unreachable
         FROM ${TABLES.LPB_ENG_R_PI_TOOL}
        WHERE tool_dwg_no ~ '^[0-9]{4}-[0-9]{2}'
        GROUP BY 1, 2`),
    maqPool.query(
      `SELECT split_part(tool_dwg_no,'-',1)||'-'||split_part(tool_dwg_no,'-',2) AS fam,
              tool_name, count(*)::int AS n
         FROM ${TABLES.LPB_ENG_TOOLING}
        WHERE tool_name IS NOT NULL AND tool_name <> ''
        GROUP BY 1, 2`),
  ]);

  const byCode = {};
  for (const c of codes) {
    if (!c.machine_type_name || c.machine_type_name === 'no data') continue;
    const k = String(c.machine_type_code).padStart(3, '0');
    (byCode[k] = byCode[k] || new Set()).add(c.machine_type_name);
  }
  const machinesFor = (fam) => [...(byCode[fam.slice(1, 4)] || [])];

  const planCns = {}, planUnreach = {};
  for (const p of planFam) {
    planCns[`${p.process_code}|${p.fam}`] = p.cns;
    planUnreach[`${p.process_code}|${p.fam}`] = p.unreachable;
  }
  const cns = (proc, fam) => planCns[`${proc}|${fam}`] || 0;

  // Family → the name the sheet would print: Latin letters, no kana/CJK/Thai, most-planned.
  const readsAsEnglish = (s) => /[A-Za-z]/.test(s) && !/[぀-ヿ㐀-䶿一-鿿฀-๿]/.test(s);
  const nameByFam = {};
  for (const r of names) {
    const cur = nameByFam[r.fam];
    const better = !cur
      || (!readsAsEnglish(cur.name) && readsAsEnglish(r.tool_name))
      || (readsAsEnglish(r.tool_name) === readsAsEnglish(cur.name) && r.n > cur.n);
    if (better) nameByFam[r.fam] = { name: r.tool_name, n: r.n };
  }
  const famName = (f) => (nameByFam[f] && nameByFam[f].name) || '';

  // TEMPLATE_B requirements, keyed (machine, process)
  const req = {}, procName = {};
  for (const r of tb) {
    for (const p of r.procs) {
      if (r.pname && !procName[p]) procName[p] = r.pname;
      for (const f of r.families) {
        const targets = machinesFor(f);
        for (const m of (targets.length ? targets : ['(ยังไม่ตั้งชื่อเครื่อง)'])) {
          ((req[`${m}|${p}`] = req[`${m}|${p}`] || {}))[f] = r.tool || '';
        }
      }
    }
  }

  const have = {};
  for (const r of cfg) {
    const k = `${r.machine_type}|${r.process_code}`;
    (have[k] = have[k] || []).push(r.tool_drawing_no);
  }

  const rows = [];
  for (const k of new Set([...Object.keys(req), ...Object.keys(have)])) {
    const [machine, process] = k.split('|');
    const need = Object.keys(req[k] || {});
    const has = [...new Set((have[k] || []).map((d) => d.split('-').slice(0, 2).join('-')))];
    const covered = need.filter((f) => has.includes(f));
    const missing = need.filter((f) => !has.includes(f));
    const extra = has.filter((f) => !need.includes(f));

    // Why a gap is still a gap. A blank reason means the page is hiding a decision, so the
    // caller checks for it.
    let reason = '';
    if (missing.length) {
      if (!machinesFor(missing[0]).length || machine.startsWith('(')) reason = NO_NAME;
      else if (missing.every((f) => !cns(process, f))) reason = NO_PLAN;
      else if (missing.every((f) => cns(process, f) > 0
               && planUnreach[`${process}|${f}`] === cns(process, f))) reason = UNREACHABLE;
    }

    const pack = (list) => list.map((f) => ({ fam: f, name: famName(f), cns: cns(process, f) }));
    rows.push({
      machine, process, processName: procName[process] || '',
      slots: (have[k] || []).length,
      inTemplateB: need.length > 0,
      state: need.length === 0 ? 'extra' : (have[k] || []).length === 0 ? 'none'
        : missing.length === 0 ? 'full' : 'partial',
      covered: pack(covered), missing: pack(missing), extra: pack(extra),
      missingCns: missing.reduce((s, f) => s + cns(process, f), 0),
      reason,
    });
  }
  rows.sort((a, b) => a.machine.localeCompare(b.machine) || a.process.localeCompare(b.process));

  const count = (s) => rows.filter((r) => r.state === s).length;
  const inTB = rows.filter((r) => r.inTemplateB).length;
  return {
    generatedAt: new Date().toISOString(),
    kpi: {
      pairsInTemplateB: inTB,
      full: count('full'), partial: count('partial'), none: count('none'), extra: count('extra'),
      pctFull: inTB ? Math.round((100 * count('full')) / inTB) : 0,
      familyRequirements: Object.values(req).reduce((s, o) => s + Object.keys(o).length, 0),
      familyCovered: rows.reduce((s, r) => s + r.covered.length, 0),
      configRows: cfg.length,
      missingCns: rows.reduce((s, r) => s + r.missingCns, 0),
      unexplainedGaps: rows.filter((r) => r.missing.length && !r.reason).length,
    },
    rows,
  };
}

module.exports = { build, _readWorkbook: readWorkbook };
