'use strict';

/**
 * Shared ExcelJS helpers for importing the PB Ring SDS template workbook into
 * `pbring_grid_template`/`pbring_excel_mapping`. Not a migration itself — sits
 * next to migrationLog.js, required by 20261009_pbring_import_grid_templates.js.
 *
 * `gridFromWorksheet` is a duplicate of `sdsV2AdminController.js`'s function of
 * the same name (lines ~62-114) — pure ExcelJS cell reading, no SDS-specific
 * logic, kept as its own copy per the project's zero-coupling rule for pbring
 * (see CLAUDE.md "Why strict separation matters").
 */

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

module.exports = { gridFromWorksheet, extractMappings, classifyParam, colToLetter };
