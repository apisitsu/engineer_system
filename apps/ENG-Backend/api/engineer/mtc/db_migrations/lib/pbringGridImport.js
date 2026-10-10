'use strict';

/**
 * Shared ExcelJS helpers for importing the PB Ring SDS template workbook into
 * `pbring_grid_template`/`pbring_excel_mapping`. Not a migration itself — sits
 * next to migrationLog.js, required by 20261009_pbring_import_grid_templates.js
 * AND by the admin "re-import" route (pbringGridController.js) — the two must
 * stay byte-identical, so `importAllTemplates`/`importOneMachine` here are the
 * single place the actual DB-writing logic lives.
 *
 * `gridFromWorksheet` is a duplicate of `sdsV2AdminController.js`'s function of
 * the same name (lines ~62-114) — pure ExcelJS cell reading, no SDS-specific
 * logic, kept as its own copy per the project's zero-coupling rule for pbring
 * (see CLAUDE.md "Why strict separation matters").
 */

const fs = require('fs');
const ExcelJS = require('exceljs');
const { engPool } = require('../../../../../instance/eng_db');

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 1-indexed column number -> Excel column letters ("A", "Z", "AA", ...). */
function colToLetter(col) {
  let n = col;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = COL_LETTERS[rem] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function argbToHex(argb) {
  if (!argb) return null;
  const hex = String(argb).slice(-6);
  return `#${hex}`;
}

/** One border side ('t'|'r'|'b'|'l') -> {w: width-ish, s: style, c: color} or undefined if none. */
function xlsxEdge(side) {
  if (!side || !side.style) return undefined;
  const widthByStyle = { thin: 1, medium: 2, thick: 3, double: 2, dashed: 1, dotted: 1, hair: 1 };
  return {
    w: widthByStyle[side.style] || 1,
    s: side.style,
    c: side.color ? argbToHex(side.color.argb) : '#000000',
  };
}

/**
 * Reads an ExcelJS worksheet into the flat grid_json shape stored by both
 * `sds_grid_template` and `pbring_grid_template`:
 * {rows, cols, colW[], rowH[], borders:{"r,c":{t,r,b,l}}, fills:{"r,c":"#hex"},
 *  cells:{"r,c":{v, f:{name,size,bold,italic,color}, a:{h,v,wrap}}}, merges:[{r1,c1,r2,c2}]}
 * 0-based row/col keys. Sparse — only cells with real content/formatting are stored.
 */
function gridFromWorksheet(ws, rows, cols) {
  const colW = [];
  for (let c = 1; c <= cols; c++) {
    const col = ws.getColumn(c);
    colW.push(col && col.width ? Math.round(col.width * 7) : 64);
  }
  const rowH = [];
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r);
    rowH.push(row && row.height ? Math.round(row.height * 1.33) : 20);
  }

  const merges = [];
  const mergeCoveredSet = new Set();
  const mergeRanges = (ws.model && ws.model.merges) || [];
  for (const rangeStr of mergeRanges) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rangeStr);
    if (!m) continue;
    const c1 = COL_LETTERS.length ? colLetterToNum(m[1]) : null;
    const r1 = parseInt(m[2], 10);
    const c2 = colLetterToNum(m[3]);
    const r2 = parseInt(m[4], 10);
    merges.push({ r1: r1 - 1, c1: c1 - 1, r2: r2 - 1, c2: c2 - 1 });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue; // master cell still reads
        mergeCoveredSet.add(`${r},${c}`);
      }
    }
  }

  const borders = {};
  const fills = {};
  const cells = {};
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c++) {
      const key1 = `${r},${c}`;
      if (mergeCoveredSet.has(key1)) continue;
      let cell;
      try { cell = row.getCell(c); } catch (e) { continue; }
      if (!cell) continue;
      const key0 = `${r - 1},${c - 1}`;

      if (cell.border) {
        const b = {};
        const t = xlsxEdge(cell.border.top); if (t) b.t = t;
        const rr = xlsxEdge(cell.border.right); if (rr) b.r = rr;
        const bb = xlsxEdge(cell.border.bottom); if (bb) b.b = bb;
        const l = xlsxEdge(cell.border.left); if (l) b.l = l;
        if (Object.keys(b).length) borders[key0] = b;
      }

      if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern === 'solid' && cell.fill.fgColor) {
        const hex = argbToHex(cell.fill.fgColor.argb);
        if (hex && hex.toUpperCase() !== '#FFFFFF') fills[key0] = hex;
      }

      let text = '';
      try { text = cell.text != null ? String(cell.text) : ''; } catch (e) { text = ''; }
      const font = cell.font || {};
      const align = cell.alignment || {};
      if (text || font.bold || font.italic || font.underline || font.size) {
        cells[key0] = {
          v: text,
          f: { name: font.name || 'Calibri', size: font.size || 10, bold: !!font.bold, italic: !!font.italic, color: font.color ? argbToHex(font.color.argb) : null },
          a: { h: align.horizontal || null, v: align.vertical || null, wrap: !!align.wrapText },
        };
      }
    }
  }

  return { rows, cols, colW, rowH, borders, fills, cells, merges };
}

function colLetterToNum(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// ---- Placeholder -> pbring_excel_mapping classification ----

// Per-tool numbered placeholders: {{Prefix_N}} -> tool_number='T{N}', field=lowercase(prefix-ish).
const NUMBERED_FIELD_MAP = {
  tooling_no: 'tooling_no',
  no: 'maker', // "No_{N}_Maker" is matched separately below (two-part suffix)
  vc: 'vc',
  f: 'f',
  ap: 'ap',
  nose_r: 'nose_r',
  insert_info: 'insert_info',
  holder_info: 'holder_info',
  tool_detail: 'tool_detail',
  rotation: 'rotation',
  hand: 'hand',
  overhang: 'overhang',
  usaged: 'usaged',
  h_width: 'h_width',
};

// Non-numbered per-tool placeholders: {{Prefix_Maker}} / {{Prefix_Spec}} -> tool_number=Prefix.
const NAMED_TOOL_PREFIXES = ['F_DW', 'Upper_GW', 'Lower_GW', 'R_DW'];

/**
 * Classify one {{param_key}} match into a pbring_excel_mapping row shape
 * (minus cell_address/machine_type_name, added by the caller).
 */
function classifyParam(paramKey) {
  // "Tooling_No_{N}" / "No_{N}_Maker" -> tool_number='T{N}'
  let m = /^Tooling_No_(\d+)$/.exec(paramKey);
  if (m) return { source: 'condition', tool_number: `T${m[1]}`, condition_field: 'tooling_no' };
  m = /^No_(\d+)_Maker$/.exec(paramKey);
  if (m) return { source: 'condition', tool_number: `T${m[1]}`, condition_field: 'maker' };

  // "{Field}_{N}" for the generic numbered fields (VC_3, F_12, Nose_R_9, Insert_Info_4, ...)
  m = /^([A-Za-z_]+)_(\d+)$/.exec(paramKey);
  if (m) {
    const fieldKey = m[1].toLowerCase();
    if (NUMBERED_FIELD_MAP[fieldKey] && fieldKey !== 'no') {
      return { source: 'condition', tool_number: `T${m[2]}`, condition_field: NUMBERED_FIELD_MAP[fieldKey] };
    }
  }

  // "{F_DW|Upper_GW|Lower_GW|R_DW}_{Maker|Spec}" -> tool_number=that fixed name
  for (const prefix of NAMED_TOOL_PREFIXES) {
    if (paramKey === `${prefix}_Maker`) return { source: 'condition', tool_number: prefix, condition_field: 'maker' };
    if (paramKey === `${prefix}_Spec`) return { source: 'condition', tool_number: prefix, condition_field: 'tooling_no' };
  }

  // Everything else: a scalar, resolved from pbring_sds_param.params by this same key.
  return { source: 'param' };
}

/**
 * Walks every cell of the worksheet looking for {{param_key}} placeholders
 * (a cell may hold more than one — regex .exec loop, not a single match) and
 * emits one row per match, classified via classifyParam().
 */
function extractMappings(ws, rows, cols) {
  const out = [];
  const reGlobal = /\{\{(\w+)\}\}/g;
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c++) {
      let cell;
      try { cell = row.getCell(c); } catch (e) { continue; }
      if (!cell) continue;
      let text = '';
      try { text = cell.text != null ? String(cell.text) : ''; } catch (e) { continue; }
      if (!text || text.indexOf('{{') === -1) continue;
      reGlobal.lastIndex = 0;
      let m;
      while ((m = reGlobal.exec(text))) {
        const paramKey = m[1];
        const classified = classifyParam(paramKey);
        out.push({ cell_address: `${colToLetter(c)}${r}`, param_key: paramKey, ...classified });
      }
    }
  }
  return out;
}

// ---- Full import (migration + admin "re-import" route share this) ----

const DEFAULT_TEMPLATE_PATH = 'C:\\User DATA\\PB_Ring_SDS_Project\\SDS_TemplatesV3.4.2.xlsx';

// The 18 visible, highlighted TemplateName values (xlsx tab names) confirmed
// live against pbring_tooling's actual machine roster. See
// 20261009_pbring_import_grid_templates.js for how this list was decided.
const TEMPLATE_NAMES = [
  'bfd_qsm200m', 'bfd_qt200_500u', 'hsg_kvd300', 'hsg_kvd350', 'cgm_omiya',
  'cgm_ohmiya20br200', 'cgm_ohmiya18br150', 'cgm_nissin', 'idg_ksb22', 'idg_ksr22s2',
  'gvg_ksr22s2', 'idg_15ksb80', 'gvg_ksr80d', 'gvg_ks350r2', 'gvg_ks500rf',
  'spf_ksh22', 'spf_ksh150', 'notch_gs64pfii',
];

// The naive "strip category prefix, uppercase" rule only matches the real
// mc_key for 10 of the 18 sheets — see 20261009_pbring_import_grid_templates.js
// for the live-verified reasoning behind each override.
const MACHINE_TYPE_NAME_OVERRIDE = {
  idg_15ksb80: 'KSB80',
  notch_gs64pfii: 'GS64PF',
  cgm_nissin: 'HIGRIND1D',
  cgm_ohmiya18br150: 'OC18BR150',
  cgm_ohmiya20br200: 'OC20BR200',
  bfd_qsm200m: 'QTSMART200M',
  bfd_qt200_500u: 'QUICKTURN200500U',
  gvg_ksr22s2: 'KSR22S2_GVG',
};

/** "HSG_kvd300" -> "KVD300" (strip the category prefix up to the first underscore, uppercase). */
function machineTypeNameFromSheetName(sheetName, templateName) {
  if (templateName && MACHINE_TYPE_NAME_OVERRIDE[templateName]) return MACHINE_TYPE_NAME_OVERRIDE[templateName];
  const idx = sheetName.indexOf('_');
  const tail = idx === -1 ? sheetName : sheetName.slice(idx + 1);
  return tail.toUpperCase();
}

async function readMappingSheet(wb) {
  const ws = wb.getWorksheet('_Mapping');
  const pairs = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header: SheetName, TemplateName
    const sheetName = row.getCell(1).value;
    const templateName = row.getCell(2).value;
    if (sheetName && templateName) pairs.push({ sheetName: String(sheetName), templateName: String(templateName) });
  });
  return pairs;
}

/** INSERT in chunks — never a per-row loop (see .claude/rules/db-patterns.md). */
async function bulkInsertMappings(rows) {
  if (!rows.length) return 0;
  const cols = ['machine_type_name', 'cell_address', 'param_key', 'source', 'tool_number', 'condition_field'];
  const c = cols.length;
  const placeholders = rows.map((_, ri) => `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
  const values = rows.flatMap((r) => [r.machine_type_name, r.cell_address, r.param_key, r.source, r.tool_number || null, r.condition_field || null]);
  await engPool.query(`INSERT INTO pbring_excel_mapping (${cols.join(',')}) VALUES ${placeholders}`, values);
  return rows.length;
}

/**
 * Imports ONE machine's sheet: grid_json + machine_type row + excel_mapping
 * rows, in a transaction. Shared by the migration and the admin re-import
 * route — both must call this rather than reimplementing it, so a workbook
 * re-import behaves identically from either caller.
 */
async function importOneMachine(wb, byTemplateName, templateName, { createdBy } = {}) {
  const sheetName = byTemplateName.get(templateName) || templateName;
  const machineTypeName = machineTypeNameFromSheetName(sheetName, templateName);

  const ws = wb.getWorksheet(templateName);
  if (!ws) throw new Error(`Workbook has no worksheet tab named "${templateName}"`);
  const dims = ws.dimensions;
  const rows = dims ? dims.bottom : 56;
  const cols = dims ? dims.right : 50;

  const grid = gridFromWorksheet(ws, rows, cols);
  const mappings = extractMappings(ws, rows, cols).map((m) => ({ ...m, machine_type_name: machineTypeName }));

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // ON CONFLICT (name) DO UPDATE, not a bare INSERT — re-running this (the
    // admin "re-import" route's whole purpose) used to collide on the unique
    // name and fail outright. Upserting in place also means re-import never
    // orphans a template row: pbring_machine_type.grid_template_id already
    // points at this same name's id from the previous run, and UPDATE leaves
    // is_default untouched since the clause never sets it.
    const { rows: gtRows } = await client.query(
      `INSERT INTO pbring_grid_template (name, grid_json, is_default, created_by)
       VALUES ($1, $2, false, $3)
       ON CONFLICT (name) DO UPDATE SET grid_json = EXCLUDED.grid_json, updated_by = $3, updated_at = now()
       RETURNING id`,
      [`${machineTypeName} (imported v3.4.2)`, JSON.stringify(grid), createdBy || 'import:pbring-sds-template-v3.4.2']
    );
    const gridTemplateId = gtRows[0].id;

    await client.query(
      `INSERT INTO pbring_machine_type (machine_type_name, source_sheet_name, grid_template_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (machine_type_name) DO UPDATE
         SET source_sheet_name = EXCLUDED.source_sheet_name, grid_template_id = EXCLUDED.grid_template_id, updated_at = now()`,
      [machineTypeName, sheetName, gridTemplateId]
    );

    await client.query('DELETE FROM pbring_excel_mapping WHERE machine_type_name = $1', [machineTypeName]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Bulk-insert mapping rows outside the transaction's per-row path (still
  // one statement — dozens of rows per machine, not thousands).
  const mappingCount = await bulkInsertMappings(mappings);

  return {
    machineTypeName, sheetName, templateName,
    cellCount: Object.keys(grid.cells).length,
    mergeCount: grid.merges.length,
    mappingCount,
  };
}

/**
 * Full re-import: opens the workbook once, imports every name in
 * `templateNames` (defaults to the full 18-machine roster). `createdBy` tags
 * the new `pbring_grid_template` rows with who triggered it (admin re-import)
 * vs the original migration's fixed tag.
 */
async function importAllTemplates({ templatePath = process.env.PBRING_SDS_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH, templateNames = TEMPLATE_NAMES, createdBy } = {}) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`PB Ring SDS template workbook not found: ${templatePath} (set PBRING_SDS_TEMPLATE_PATH)`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const mappingPairs = await readMappingSheet(wb);
  const byTemplateName = new Map(mappingPairs.map((p) => [p.templateName, p.sheetName]));

  const results = [];
  for (const templateName of templateNames) {
    results.push(await importOneMachine(wb, byTemplateName, templateName, { createdBy }));
  }
  return results;
}

module.exports = {
  gridFromWorksheet, extractMappings, classifyParam, colToLetter,
  TEMPLATE_NAMES, MACHINE_TYPE_NAME_OVERRIDE, DEFAULT_TEMPLATE_PATH,
  machineTypeNameFromSheetName, readMappingSheet, bulkInsertMappings,
  importOneMachine, importAllTemplates,
};
