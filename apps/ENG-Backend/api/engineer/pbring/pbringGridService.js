'use strict';

/**
 * PB Ring grid-template rendering: resolve a (cn, machine_type_name,
 * process_code) into real values and turn the stored grid_json into a
 * printable HTML page, independent of the live SDS pipeline.
 *
 * `buildGridPdfHtml` is duplicated from `sdsV2HeadlessController.js:1281+`
 * with the image-collision/IMAGE_EXTENTS machinery stripped — PB Ring has no
 * tooling-image table/feature. Kept otherwise as-is: it's generic grid->HTML
 * geometry (merges/borders/fills/text-spill), not SDS business logic.
 *
 * Value resolution does NOT need `pbring_excel_mapping` at render time —
 * `classifyParam` (from db_migrations/lib/pbringGridImport.js) is a pure,
 * deterministic function of the placeholder's own name, so every {{param}}
 * in the grid's own cell text can be resolved directly. The mapping table
 * exists for traceability/future admin editing, not as a render-time
 * dependency — avoids a second source of truth drifting from the grid itself.
 */

const { engPool } = require('../../../instance/eng_db');
const { classifyParam, importAllTemplates, TEMPLATE_NAMES } = require('../mtc/db_migrations/lib/pbringGridImport');

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Resolves the template grid for a machine: its assigned grid_template_id,
 * falling back to the is_default template. Returns { grid, machineTypeId }
 * or null if the machine isn't registered.
 */
async function loadGridForMachine(machineTypeName) {
  const { rows: mtRows } = await engPool.query(
    `SELECT id, grid_template_id FROM pbring_machine_type WHERE machine_type_name = $1 AND is_active`,
    [machineTypeName]
  );
  if (!mtRows.length) return null;
  const mt = mtRows[0];

  let templateId = mt.grid_template_id;
  if (!templateId) {
    const { rows: defRows } = await engPool.query(`SELECT id FROM pbring_grid_template WHERE is_default LIMIT 1`);
    if (!defRows.length) return null;
    templateId = defRows[0].id;
  }

  const { rows: gtRows } = await engPool.query(`SELECT grid_json FROM pbring_grid_template WHERE id = $1`, [templateId]);
  if (!gtRows.length) return null;
  return { grid: JSON.parse(gtRows[0].grid_json), machineTypeId: mt.id };
}

/**
 * Resolves (cn, machine_type_name, process_code) into:
 *   paramMap: { [param_key]: value } from pbring_sds_param.params (JSONB)
 *   conditionByToolNumber: { [tool_number]: pbring_sds_condition row }
 * No pbring_tooling join — verified live that none of the 373 placeholders
 * across the 18 imported templates are cost/PO/qty-shaped.
 */
async function buildPbRingValueMap(cn, machineTypeName, processCode) {
  const { rows: paramRows } = await engPool.query(
    `SELECT cn, pn, process_code, process_name, machine, ct, rev, params
       FROM pbring_sds_param WHERE cn = $1 AND process_code = $2 AND mc_key = $3 LIMIT 1`,
    [cn, processCode, machineTypeName]
  );
  const paramRow = paramRows[0];
  // Header fields (Machine/PN/CN/Process/CT/Revision/...) live as their own
  // row columns on pbring_sds_param, not inside params JSONB — only the
  // grinding-condition values (Top_GW_Speed, DressTimeR, ...) are in there.
  // Verified live: a row with a populated `params` blob had `{{CN}}`/`{{PN}}`
  // render blank until these were merged in.
  const paramMap = paramRow ? {
    ...paramRow.params,
    CN: paramRow.cn,
    PN: paramRow.pn,
    Process_Code: paramRow.process_code,
    Process: paramRow.process_name,
    Machine: paramRow.machine,
    CT: paramRow.ct,
    REV: paramRow.rev,
    Revision: paramRow.rev,
  } : {};

  const { rows: condRows } = await engPool.query(
    `SELECT * FROM pbring_sds_condition WHERE cn = $1 AND process_code = $2 AND mc_key = $3`,
    [cn, processCode, machineTypeName]
  );
  const conditionByToolNumber = {};
  for (const row of condRows) conditionByToolNumber[row.tool_number] = row;

  return { paramMap, conditionByToolNumber };
}

/**
 * Substitutes every {{param_key}} in the grid's own cell text with a real
 * value, via classifyParam — no mutation of the caller's grid object (the
 * caller already owns a fresh JSON.parse of the stored grid_json per request).
 */
function applyValuesToGrid(grid, paramMap, conditionByToolNumber) {
  const cells = grid.cells || {};
  for (const key of Object.keys(cells)) {
    const cell = cells[key];
    if (!cell || typeof cell.v !== 'string' || cell.v.indexOf('{{') === -1) continue;
    cell.v = cell.v.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
      const classified = classifyParam(paramKey);
      let value;
      if (classified.source === 'condition') {
        const row = conditionByToolNumber[classified.tool_number];
        value = row ? row[classified.condition_field] : null;
      } else {
        value = paramMap[paramKey];
      }
      return value == null ? '' : String(value);
    });
  }
  return grid;
}

/** Duplicated from sdsV2HeadlessController.js:1281+, image machinery stripped. */
function buildGridPdfHtml(grid) {
  const rows = Math.max(1, parseInt(grid.rows, 10) || 56);
  const cols = Math.max(1, parseInt(grid.cols, 10) || 48);
  const borders = grid.borders || {};
  const fills = grid.fills || {};
  const cells = grid.cells || {};
  const merges = Array.isArray(grid.merges) ? grid.merges : [];

  const fit = (arr, n, d) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && Number(arr[i]) > 0 ? Number(arr[i]) : d));
  const colW = fit(grid.colW, cols, 30);
  const rowH = fit(grid.rowH, rows, 22);
  const sumW = colW.reduce((a, b) => a + b, 0) || 1;
  const PAGE_W_MM = 287;
  const scale = PAGE_W_MM / sumW;

  const covered = new Set();
  const spanAt = {};
  for (const m of merges) {
    const r1 = +m.r1, c1 = +m.c1, r2 = +m.r2, c2 = +m.c2;
    if ([r1, c1, r2, c2].some((n) => Number.isNaN(n))) continue;
    spanAt[`${r1},${c1}`] = { rs: r2 - r1 + 1, cs: c2 - c1 + 1, r2, c2 };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (r === r1 && c === c1) continue; covered.add(`${r},${c}`); }
  }

  const edge = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : 'none');
  const cellBorders = (r, c, span) => {
    const b0 = borders[`${r},${c}`] || {};
    if (!span) return b0;
    return {
      t: b0.t,
      l: b0.l,
      r: (borders[`${r},${span.c2}`] || {}).r,
      b: (borders[`${span.r2},${c}`] || {}).b,
    };
  };

  const colgroup = colW.map((w) => `<col style="width:${(w * scale).toFixed(3)}mm">`).join('');

  const baseOf = (r, c) => (covered.has(`${r},${c}`)
    ? (Object.keys(spanAt).find((k) => {
        const s = spanAt[k]; const [br, bc] = k.split(',').map(Number);
        return r >= br && r <= s.r2 && c >= bc && c <= s.c2;
      }) || `${r},${c}`)
    : `${r},${c}`);
  const hasInk = (r, c) => {
    if (c < 0 || c >= cols) return true;
    const d = cells[baseOf(r, c)];
    return !!(d && d.v != null && String(d.v).trim() !== '');
  };
  const wMm = (c) => (colW[c] || 0) * scale;
  const spillWidthMm = (r, c, span, align) => {
    const c1 = c;
    const c2 = span ? span.c2 : c;
    let avail = 0;
    for (let i = c1; i <= c2; i++) avail += wMm(i);
    if (align !== 'right') for (let i = c2 + 1; i < cols && !hasInk(r, i); i++) avail += wMm(i);
    if (align !== 'left') for (let i = c1 - 1; i >= 0 && !hasInk(r, i); i--) avail += wMm(i);
    return avail;
  };

  let body = '';
  for (let r = 0; r < rows; r++) {
    body += `<tr style="height:${(rowH[r] * scale).toFixed(3)}mm">`;
    for (let c = 0; c < cols; c++) {
      if (covered.has(`${r},${c}`)) continue;
      const span = spanAt[`${r},${c}`];
      const b = cellBorders(r, c, span);
      const fill = fills[`${r},${c}`];
      const cd = cells[`${r},${c}`];
      const f = cd && cd.f, a = cd && cd.a;
      const st = [
        `border-top:${edge(b.t)}`,
        `border-right:${edge(b.r)}`,
        `border-bottom:${edge(b.b)}`,
        `border-left:${edge(b.l)}`,
        fill ? `background:${fill}` : '',
        f && f.name ? `font-family:'${f.name}',Arial,sans-serif` : '',
        `font-size:${(((f && f.size) || 10) * 1.3333 * scale).toFixed(3)}mm`,
        f && f.bold ? 'font-weight:bold' : '',
        f && f.italic ? 'font-style:italic' : '',
        f && f.color ? `color:${f.color}` : '',
        `text-align:${(a && a.h) || 'left'}`,
        `vertical-align:${(a && a.v) || 'middle'}`,
        a && a.wrap ? 'white-space:normal' : 'white-space:nowrap',
        a && a.wrap ? 'overflow:hidden' : 'overflow:visible',
      ].filter(Boolean).join(';');
      const sp = span ? `${span.cs > 1 ? ` colspan="${span.cs}"` : ''}${span.rs > 1 ? ` rowspan="${span.rs}"` : ''}` : '';

      let content = escHtml(cd && cd.v);
      if (content && !(a && a.wrap)) {
        const mm = spillWidthMm(r, c, span, (a && a.h) || 'left');
        content = `<span style="display:inline-block;max-width:${mm.toFixed(3)}mm;`
          + `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;">${content}</span>`;
      }
      body += `<td${sp} style="${st}">${content}</td>`;
    }
    body += '</tr>';
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    table { width: ${PAGE_W_MM}mm; border-collapse: collapse; table-layout: fixed; }
    td { padding: 0 0.4mm; line-height: 1.05; }
  </style></head><body>
    <table><colgroup>${colgroup}</colgroup><tbody>${body}</tbody></table>
  </body></html>`;
}

/**
 * Lightweight existence check for the SdsV2Page.jsx auto-detect button. Returns
 * one entry per (machine, process_code) combo so the frontend has everything
 * `grid/pdf` needs without a second round trip — not just which machines have
 * data, since a machine alone is not enough to render (the route also requires
 * process_code).
 */
async function hasDataForCn(cn) {
  const { rows: paramRows } = await engPool.query(
    `SELECT DISTINCT mc_key, process_code FROM pbring_sds_param WHERE cn = $1`,
    [cn]
  );
  const { rows: condRows } = await engPool.query(
    `SELECT DISTINCT mc_key, process_code FROM pbring_sds_condition WHERE cn = $1`,
    [cn]
  );
  const comboByKey = new Map();
  for (const r of [...paramRows, ...condRows]) {
    comboByKey.set(`${r.mc_key}||${r.process_code}`, { machine_type_name: r.mc_key, process_code: r.process_code });
  }
  const combos = [...comboByKey.values()];
  if (!combos.length) return { exists: false, machines: [] };

  const mcKeys = [...new Set(combos.map((c) => c.machine_type_name))];
  const { rows: mtRows } = await engPool.query(
    `SELECT machine_type_name, grid_template_id IS NOT NULL AS has_template
       FROM pbring_machine_type WHERE machine_type_name = ANY($1) AND is_active`,
    [mcKeys]
  );
  const templateByName = new Map(mtRows.map((r) => [r.machine_type_name, r.has_template]));

  const machines = combos
    .filter((c) => templateByName.has(c.machine_type_name))
    .map((c) => ({
      machine_type_name: c.machine_type_name,
      process_code: c.process_code,
      has_template: templateByName.get(c.machine_type_name),
    }));

  return { exists: machines.length > 0, machines };
}

/**
 * Admin: machine<->template assignment (used by the "Grid Templates" tab on
 * the PB Ring Monitor page) plus full template CRUD + xlsx parsing (used by
 * PbRingGridTemplateEditor.jsx, the full Excel-style layout editor — a
 * duplicate of SdsBlankTemplateGrid.jsx's editing surface, not SDS's
 * "Excel Parameter Config" per-CN value grid, which has no PB Ring
 * equivalent: every {{param}} resolves automatically from
 * pbring_sds_param/pbring_sds_condition, there is no manual per-CN override
 * step here).
 */

/** GET admin: templates list with how many machines each is assigned to. */
async function listTemplates() {
  const { rows } = await engPool.query(
    `SELECT gt.id, gt.name, gt.is_default, gt.updated_at,
            (SELECT COUNT(*) FROM pbring_machine_type m WHERE m.grid_template_id = gt.id) AS assigned_count
       FROM pbring_grid_template gt
      ORDER BY gt.is_default DESC, gt.name`
  );
  return rows;
}

/** GET admin: machine types with their assigned template id/name. */
async function listMachineTypes() {
  const { rows } = await engPool.query(
    `SELECT mt.id, mt.machine_type_name, mt.source_sheet_name, mt.is_active,
            mt.grid_template_id, gt.name AS grid_template_name
       FROM pbring_machine_type mt
       LEFT JOIN pbring_grid_template gt ON gt.id = mt.grid_template_id
      ORDER BY mt.machine_type_name`
  );
  return rows;
}

/** PUT admin: assign (or clear, with null) a machine's grid template. */
async function assignMachineTemplate(machineTypeId, gridTemplateId) {
  const { rows } = await engPool.query(
    `UPDATE pbring_machine_type SET grid_template_id = $1, updated_at = now() WHERE id = $2
     RETURNING id, machine_type_name, grid_template_id`,
    [gridTemplateId || null, machineTypeId]
  );
  return rows[0] || null;
}

/** PUT admin: make one template the default (fallback for a machine with none assigned). */
async function setDefaultTemplate(templateId) {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE pbring_grid_template SET is_default = FALSE WHERE is_default`);
    const { rows } = await client.query(
      `UPDATE pbring_grid_template SET is_default = TRUE, updated_at = now() WHERE id = $1 RETURNING id`,
      [templateId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return false; }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * POST admin: re-run the xlsx import — the whole 18-machine roster by default,
 * or a subset via `templateNames`. Same importAllTemplates the one-time
 * migration uses (see lib/pbringGridImport.js); upserts in place by template
 * name, so re-running after the source workbook changes updates the existing
 * rows rather than creating new ones.
 */
async function reimportTemplates(templateNames, empno) {
  const names = Array.isArray(templateNames) && templateNames.length
    ? templateNames.filter((n) => TEMPLATE_NAMES.includes(n))
    : TEMPLATE_NAMES;
  if (!names.length) throw new Error('No valid template names to import');
  return importAllTemplates({ templateNames: names, createdBy: empno ? `admin:${empno}` : undefined });
}

// ---- Full template CRUD (PbRingGridTemplateEditor.jsx) ----

/** GET admin: one template with its parsed grid. */
async function getTemplateById(id) {
  const { rows } = await engPool.query(
    `SELECT id, name, is_default, grid_json, updated_at FROM pbring_grid_template WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  let grid = null;
  try { grid = JSON.parse(rows[0].grid_json); } catch (_) { grid = null; }
  return { id: rows[0].id, name: rows[0].name, is_default: rows[0].is_default, grid, updated_at: rows[0].updated_at };
}

/** POST admin: create a new template — { name, grid? } or { name, copyFromId }. */
async function createTemplate({ name, grid, copyFromId }, empno) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  let gridJson;
  if (grid && typeof grid === 'object' && !Array.isArray(grid)) {
    gridJson = JSON.stringify(grid);
  } else if (copyFromId) {
    const src = await engPool.query(`SELECT grid_json FROM pbring_grid_template WHERE id = $1`, [copyFromId]);
    gridJson = src.rows[0]?.grid_json;
  }
  if (!gridJson) {
    const def = await engPool.query(`SELECT grid_json FROM pbring_grid_template WHERE is_default LIMIT 1`);
    gridJson = def.rows[0]?.grid_json || JSON.stringify({ rows: 56, cols: 48, borders: {}, fills: {}, cells: {}, merges: [] });
  }
  const { rows } = await engPool.query(
    `INSERT INTO pbring_grid_template (name, grid_json, is_default, created_by)
     VALUES ($1, $2, FALSE, $3) RETURNING id, name, is_default, updated_at`,
    [String(name).trim(), gridJson, empno || null]
  );
  return rows[0];
}

/** PUT admin: update a template's name and/or grid. */
async function updateTemplate(id, { name, grid }, empno) {
  if (name == null && grid == null) throw new Error('name or grid required');
  if (grid != null && (typeof grid !== 'object' || Array.isArray(grid))) throw new Error('grid must be an object');
  const sets = [], vals = [];
  if (name != null) { vals.push(String(name).trim()); sets.push(`name = $${vals.length}`); }
  if (grid != null) { vals.push(JSON.stringify(grid)); sets.push(`grid_json = $${vals.length}`); }
  vals.push(empno || null); sets.push(`updated_by = $${vals.length}`);
  vals.push(id);
  const { rows } = await engPool.query(
    `UPDATE pbring_grid_template SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}
     RETURNING id, name, is_default, updated_at`,
    vals
  );
  return rows[0] || null;
}

/** DELETE admin: remove a template (the default is protected; assigned machines keep their FK, which ON DELETE SET NULL clears). */
async function deleteTemplate(id) {
  const { rows } = await engPool.query(`SELECT is_default FROM pbring_grid_template WHERE id = $1`, [id]);
  if (!rows[0]) return { ok: false, reason: 'not_found' };
  if (rows[0].is_default) return { ok: false, reason: 'is_default' };
  await engPool.query(`DELETE FROM pbring_grid_template WHERE id = $1`, [id]);
  return { ok: true };
}

/**
 * Parse an admin-uploaded .xlsx (any workbook) into the editor grid model,
 * from an in-memory buffer — same shape/bounds logic as
 * sdsV2AdminController.parseXlsxGridFromBuffer. `sheet` selects a worksheet
 * by 1-based index or exact name, defaulting to the first.
 */
const UPLOAD_MAX_ROWS = 120, UPLOAD_MAX_COLS = 52;
async function parseXlsxGridFromBuffer(buffer, sheet) {
  const ExcelJS = require('exceljs');
  const { gridFromWorksheet: gfw } = require('../mtc/db_migrations/lib/pbringGridImport');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  let ws = wb.worksheets[0];
  if (sheet != null && String(sheet).trim() !== '') {
    const s = String(sheet).trim();
    const byIndex = /^\d+$/.test(s) ? wb.worksheets[Number(s) - 1] : null;
    ws = byIndex || wb.worksheets.find((w) => w.name === s) || ws;
  }
  if (!ws) throw new Error('workbook has no worksheets');
  // ws.dimensions nests the real used-range under .model ({top,left,bottom,right}) —
  // reading .bottom/.right straight off ws.dimensions is always undefined.
  const dim = (ws.dimensions && ws.dimensions.model) || {};
  const rows = Math.min(UPLOAD_MAX_ROWS, Math.max(1, dim.bottom || ws.rowCount || 56));
  const cols = Math.min(UPLOAD_MAX_COLS, Math.max(1, dim.right || ws.columnCount || 48));
  return gfw(ws, rows, cols);
}

/** Lists worksheet names in an uploaded .xlsx (no cell parsing) for the sheet-picker modal. */
async function listXlsxSheets(buffer) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets.map((ws, i) => ({ index: i + 1, name: ws.name }));
}

/**
 * Blank-template preview: renders a template's grid exactly as stored, with
 * NO value substitution — every {{param}} literal stays visible. Unlike the
 * live render route (buildPbRingValueMap + applyValuesToGrid), this needs no
 * cn/machine/process at all, so an admin can preview a template's layout the
 * moment it's created, before any machine is even assigned to it.
 */
async function renderBlankTemplateHtml(id) {
  const tpl = await getTemplateById(id);
  if (!tpl) return null;
  return buildGridPdfHtml(tpl.grid);
}

/**
 * Phase 6: reuse the live SDS "Standard" grid layout instead of the Phase 5
 * imported-xlsx templates (user feedback: the 18 imported layouts render
 * "เพี้ยน" — inconsistent formatting, one per author/date — and the real
 * system doesn't use literal {{param}} cells at all). See the "Phase 6"
 * section of the plan file for the full reasoning and the CN-collision risk
 * this design avoids.
 *
 * `loadStandardGridLive` is READ-ONLY against `sds_grid_template` — a plain
 * `SELECT ... WHERE id = 1`, no JOIN to `sds_machine_type_code`, no CN
 * involved anywhere in the query. This can never touch real production
 * part/tooling data; it only ever reads the shared layout definition.
 */
const SDS_STANDARD_TEMPLATE_ID = 1; // sds_grid_template.id, is_default=true, confirmed live 2026-10-07

async function loadStandardGridLive() {
  const { rows } = await engPool.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [SDS_STANDARD_TEMPLATE_ID]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].grid_json);
}

/**
 * The real T01-T20 "Tooling No:"/"Maker:" value-cell addresses, read live
 * from `sds_excel_mapping` (machine_type_name IS NULL — shared across every
 * grinding machine, confirmed live: all 40 rows present, M/S/Y/AE/AK columns
 * stepping every 5 slots, rows 24/25 -> 34/35 -> 44/45 -> 54/55). Read-only,
 * no CN involved — same safety argument as `loadStandardGridLive`.
 */
async function loadToolSlotAddressesLive() {
  const { rows } = await engPool.query(
    `SELECT cell_address, param_key FROM sds_excel_mapping
      WHERE machine_type_name IS NULL AND (param_key LIKE 'tool_dwg_no_T%' OR param_key LIKE 'maker_T%')`
  );
  const addr = {};
  for (const r of rows) {
    const m = /^(tool_dwg_no|maker)_T(\d+)$/.exec(r.param_key);
    if (!m) continue;
    const slot = `T${m[2].padStart(2, '0')}`;
    addr[slot] = addr[slot] || {};
    addr[slot][m[1] === 'tool_dwg_no' ? 'dwgNo' : 'maker'] = r.cell_address;
  }
  return addr; // { T01: { dwgNo: 'M24', maker: 'M25' }, ... T20 }
}

/**
 * Header field addresses (Machine/Part No/C-N/Process/Rev/CT), read live from
 * the same shared `sds_excel_mapping` rows — confirmed live: B3/M3/M4/Z3/AC3/
 * T3/B4. Read-only, no CN involved — same safety argument as the other two
 * live-read helpers above.
 */
// paramMap's own keys are capitalized (CN/PN/Machine/Process_Code/Process/CT/REV)
// — buildPbRingValueMap merges them in matching the original xlsx's {{}}
// placeholder spelling, not sds_excel_mapping's lowercase param_key naming.
const HEADER_FIELD_TO_PARAM_KEY = {
  machine_type_name: 'Machine', parts_no: 'PN', cn: 'CN',
  process_code: 'Process_Code', process_name: 'Process', dwg_rev: 'REV', ct: 'CT',
};
async function loadHeaderAddressesLive() {
  const { rows } = await engPool.query(
    `SELECT cell_address, param_key FROM sds_excel_mapping
      WHERE machine_type_name IS NULL AND param_key = ANY($1)`,
    [Object.keys(HEADER_FIELD_TO_PARAM_KEY)]
  );
  const addr = {};
  for (const r of rows) addr[r.param_key] = r.cell_address;
  return addr; // { machine_type_name: 'B3', parts_no: 'M3', ... }
}

function applyHeaderToGrid(grid, headerAddresses, paramMap) {
  for (const [sdsField, pbKey] of Object.entries(HEADER_FIELD_TO_PARAM_KEY)) {
    const cellAddr = headerAddresses[sdsField];
    const value = paramMap[pbKey];
    if (!cellAddr || value == null || value === '') continue;
    grid.cells[addrToRC(cellAddr)] = {
      v: String(value),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false },
    };
  }
}

// Named (non-numbered) PB Ring tool_number values that DO belong in a T-slot
// (fixtures/jigs), in the fixed order they fill the slots AFTER every
// numbered T{n} tool for that CN. Deliberately does NOT include the 4
// grinding/dressing-wheel names (F_DW/Upper_GW/Lower_GW/R_DW) — those are
// condition-list data, not tools; see pbring_sds_param_config's
// source='condition' rows and 20261010c/d for why. If a future machine's
// pbring_sds_condition carries a genuinely different named fixture, add it
// here, not to the GW/DW set.
const NAMED_TOOL_ORDER = [];
const CONDITION_SOURCED_TOOL_NUMBERS = new Set(['F_DW', 'Upper_GW', 'Lower_GW', 'R_DW']);

function orderToolNumbers(keys) {
  const usable = keys.filter((k) => !CONDITION_SOURCED_TOOL_NUMBERS.has(k));
  const numbered = usable.filter((k) => /^T\d+$/.test(k)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  const named = NAMED_TOOL_ORDER.filter((k) => usable.includes(k));
  const rest = usable.filter((k) => !numbered.includes(k) && !named.includes(k));
  return [...numbered, ...named, ...rest];
}

/** Writes each (tool_number -> condition row) into its assigned T01-T20 slot's real cell addresses. */
function applyToolSlotsToGrid(grid, conditionByToolNumber, toolAddresses) {
  const ordered = orderToolNumbers(Object.keys(conditionByToolNumber));
  ordered.forEach((toolNumber, i) => {
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    const addr = toolAddresses[slot];
    if (!addr) return; // ran out of T01-T20 slots — more than 20 tools is not representable here
    const row = conditionByToolNumber[toolNumber];
    const colorCell = (cellAddr, text) => {
      if (!text) return;
      const key = addrToRC(cellAddr);
      grid.cells[key] = { v: String(text), f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' }, a: { h: null, v: 'middle', wrap: false } };
    };
    colorCell(addr.dwgNo, row.tooling_no);
    colorCell(addr.maker, row.maker);
  });
}

function colLetterToNum(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function addrToRC(addr) {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  return `${parseInt(m[2], 10) - 1},${colLetterToNum(m[1]) - 1}`;
}

/** GET admin: per-machine GRIND/DRESS CONDITION row config, in display order. */
async function getParamConfig(machineTypeName) {
  const { rows } = await engPool.query(
    `SELECT id, sort_order, label, param_key, unit, source, tool_number, condition_field
       FROM pbring_sds_param_config WHERE machine_type_name = $1 ORDER BY sort_order`,
    [machineTypeName]
  );
  return rows;
}

/**
 * PUT admin: replace a machine's whole param-config list in one go (delete +
 * bulk insert in a transaction) — the editor sends its full edited list
 * rather than per-row diffs, same pattern as `sds_machine_tool`'s bulk
 * combo-replace. `sort_order` is reassigned from the array's own order, so
 * the editor's row order is always what gets saved.
 */
async function saveParamConfig(machineTypeName, rows, empno) {
  const clean = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      label: (r.label || '').trim(),
      param_key: (r.param_key || '').trim(),
      unit: (r.unit || '').trim(),
      source: r.source === 'condition' ? 'condition' : 'param',
      tool_number: (r.tool_number || '').trim() || null,
      condition_field: (r.condition_field || '').trim() || null,
    }))
    .filter((r) => r.param_key);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pbring_sds_param_config WHERE machine_type_name = $1', [machineTypeName]);
    if (clean.length) {
      const cols = ['machine_type_name', 'sort_order', 'label', 'param_key', 'unit', 'source', 'tool_number', 'condition_field', 'created_by'];
      const c = cols.length;
      const placeholders = clean.map((_, ri) => `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
      const values = clean.flatMap((r, i) => [
        machineTypeName, i + 1, r.label || null, r.param_key, r.unit || null,
        r.source, r.tool_number, r.condition_field, empno || null,
      ]);
      await client.query(`INSERT INTO pbring_sds_param_config (${cols.join(',')}) VALUES ${placeholders}`, values);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return clean.length;
}

/**
 * Writes the per-machine config rows into two DIFFERENT regions of the grid,
 * by source — not one continuous list:
 *
 * - `source='param'` rows (the numbered #01-#NN GRIND/DRESS CONDITION list)
 *   go in the left-hand area starting row 16 (0-based 15, confirmed live),
 *   columns A/E/F (label/value/unit). Never overlaps the T01-T20 tool area,
 *   which starts at column K (index 10).
 * - `source='condition'` rows (grinding/dressing-wheel spec+maker — KVD300/
 *   KVD350 today) go in the bottom-right area, same columns the real SDS
 *   system itself uses for its own "GW" section: `gw_row_N_AN` (label) /
 *   `gw_row_N_AP` (value), confirmed live against `sds_parameter` for
 *   KS-B80 (rows 53-55) — i.e. column AN (index 39, label) / AP (index 41,
 *   value), same column family as the "Grinding Area" diagram box, NOT the
 *   left-hand condition-parameter columns. Starts row 50 (0-based 49),
 *   ending well before the sheet's row-58 footer.
 *
 * The two row counters are independent, so a long #01-#NN list on one
 * machine never pushes the GW/DW rows down into territory the diagram box
 * needs, and vice versa.
 */
const CONDITION_START_ROW = 15; // 0-based (row 16, 1-based, confirmed live)
const CONDITION_LABEL_COL = 0, CONDITION_VALUE_COL = 4, CONDITION_UNIT_COL = 5;

const GW_DETAIL_START_ROW = 49; // 0-based (row 50, 1-based) — bottom-right, same column family as the Grinding Area diagram
const GW_DETAIL_LABEL_COL = 39, GW_DETAIL_VALUE_COL = 41; // AN / AP, matching the real sds_parameter gw_row_N_AN/AP convention

function applyConditionConfigToGrid(grid, configRows, paramMap, conditionByToolNumber = {}) {
  let paramRowIdx = 0;
  let gwRowIdx = 0;
  configRows.forEach((cfg) => {
    const isGwDetail = cfg.source === 'condition';
    const r = isGwDetail ? GW_DETAIL_START_ROW + gwRowIdx : CONDITION_START_ROW + paramRowIdx;
    if (isGwDetail) gwRowIdx += 1; else paramRowIdx += 1;
    const labelCol = isGwDetail ? GW_DETAIL_LABEL_COL : CONDITION_LABEL_COL;
    const valueCol = isGwDetail ? GW_DETAIL_VALUE_COL : CONDITION_VALUE_COL;

    const value = isGwDetail
      ? (conditionByToolNumber[cfg.tool_number] || {})[cfg.condition_field]
      : paramMap[cfg.param_key];
    if (cfg.label) {
      grid.cells[`${r},${labelCol}`] = {
        v: cfg.label,
        f: { name: 'Calibri', size: 9, bold: false, italic: false, color: '#000000' },
        a: { h: null, v: 'middle', wrap: false },
      };
    }
    if (value != null && value !== '') {
      grid.cells[`${r},${valueCol}`] = {
        v: String(value),
        f: { name: 'Calibri', size: 9, bold: false, italic: false, color: '#c00000' },
        a: { h: 'right', v: 'middle', wrap: false },
      };
    }
    if (cfg.unit && !isGwDetail) {
      grid.cells[`${r},${CONDITION_UNIT_COL}`] = {
        v: cfg.unit,
        f: { name: 'Calibri', size: 9, bold: false, italic: false, color: '#000000' },
        a: { h: null, v: 'middle', wrap: false },
      };
    }
  });
  return grid;
}

/**
 * Full Phase-6 render: live Standard layout + T01-T20 tool values (existing
 * mechanism, reused) + the new GRIND/DRESS CONDITION list. Does not touch
 * `pbring_grid_template`/`pbring_excel_mapping`/`classifyParam` at all — this
 * is a parallel path to the Phase 5 `loadGridForMachine`/`applyValuesToGrid`,
 * not a replacement yet (the live `/grid/pdf` route still uses Phase 5 until
 * this is reviewed and cut over machine by machine).
 */
async function buildStandardGridForMachine(cn, machineTypeName, processCode) {
  const grid = await loadStandardGridLive();
  if (!grid) return null;

  const { paramMap, conditionByToolNumber } = await buildPbRingValueMap(cn, machineTypeName, processCode);

  const headerAddresses = await loadHeaderAddressesLive();
  applyHeaderToGrid(grid, headerAddresses, paramMap);

  const toolAddresses = await loadToolSlotAddressesLive();
  applyToolSlotsToGrid(grid, conditionByToolNumber, toolAddresses);

  const configRows = await getParamConfig(machineTypeName);
  applyConditionConfigToGrid(grid, configRows, paramMap, conditionByToolNumber);

  return grid;
}

module.exports = {
  loadGridForMachine, buildPbRingValueMap, applyValuesToGrid, buildGridPdfHtml, hasDataForCn,
  listTemplates, listMachineTypes, assignMachineTemplate, setDefaultTemplate, reimportTemplates,
  getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  parseXlsxGridFromBuffer, listXlsxSheets, renderBlankTemplateHtml,
  loadStandardGridLive, getParamConfig, saveParamConfig, applyConditionConfigToGrid, buildStandardGridForMachine,
  loadToolSlotAddressesLive, applyToolSlotsToGrid, loadHeaderAddressesLive, applyHeaderToGrid,
};
