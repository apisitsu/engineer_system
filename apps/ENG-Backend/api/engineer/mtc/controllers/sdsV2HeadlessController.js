const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const moment = require('moment');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const tselectFallback = require('../services/tselectFallback');
const SdsOrchestrator = require('../services/SdsOrchestrator');
const { TABLES } = require('../mtcConstants');

const router = express.Router();

const TEMPLATE_PATH = path.join(__dirname, '../templates/html/sds_template.html');
const OUTPUT_DIR    = path.resolve('./output/sds-pdf');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }

// Cache the HTML template in memory — it never changes at runtime, so reading it
// from disk on every render was pure per-request I/O.
let _templateHtml = null;
function getTemplateHtml() {
  if (_templateHtml == null) _templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return _templateHtml;
}

// Fetch CN search data through the cached orchestrator (sds:{CN}, 10-min TTL)
// instead of a fresh factory-DB round-trip on every PDF render.
async function getSearchData(cn) {
  const data = await SdsOrchestrator.search(cn, maqPool, rodpcPool);
  if (!data || data.error || data.success === false) {
    throw new Error(data?.error || 'CN search failed');
  }
  return data;
}

// ── CSS Config Cache (5-min TTL) ────────────────────────────────────────────

const DEFAULT_CSS_CONFIG = {
  'font-size-base': '5.3pt', 'font-size-title': '7pt',
  'font-size-section': '9pt', 'font-size-badge': '4.5pt',
  'height-row-normal': '3.65mm', 'height-row-sep': '0.84mm', 'height-row-img': '21.9mm',
  'width-params-panel': '26.13%', 'width-tooling-panel': '54.60%', 'width-grinding-panel': '19.27%',
  'color-border-outer': '#000000', 'color-border-inner': '#aaaaaa',
  'color-badge-bg': '#1a3a8c', 'color-value-red': '#cc0000',
  'color-header-bg': '#e0e0e0', 'color-sep-bg': '#f0f0f0',
};

let _cssCache = null;
let _cssCacheAt = 0;
const CSS_CACHE_TTL = 5 * 60 * 1000;

async function loadCssConfig(overrides = null) {
  // Use provided overrides (live preview) — skip DB entirely
  if (overrides && typeof overrides === 'object' && Object.keys(overrides).length) {
    return { ...DEFAULT_CSS_CONFIG, ...overrides };
  }
  // Return cached copy if still fresh
  if (_cssCache && Date.now() - _cssCacheAt < CSS_CACHE_TTL) return _cssCache;
  try {
    const r = await engPool.query(
      `SELECT config_key, config_value FROM sds_template_css_config`
    );
    const stored = Object.fromEntries(r.rows.map(row => [row.config_key, row.config_value]));
    _cssCache = { ...DEFAULT_CSS_CONFIG, ...stored };
    _cssCacheAt = Date.now();
    return _cssCache;
  } catch (_) {
    return DEFAULT_CSS_CONFIG;
  }
}

function buildCssVarsBlock(config) {
  const lines = Object.entries(config)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  return `:root {\n${lines}\n}`;
}

// ── Cloned buildValueMap logic for consistency ──────────────────────────────

async function buildValueMap(searchData, machine_type_name, process_code, engPool, displayName) {
  // (Identical to Gotenberg/Standard controllers, returns flat map of values + image buffers)
  // For the POC, I'll use the same code as before but return it for HTML consumption.
  
  const PART_CATEGORY = { BALL: 'Ball Parts', RACE: 'Race Parts', BODY: 'Body Parts', SLEEVE: 'Sleeve Parts', SPHERICAL: 'Spherical Parts' };
  const map = {};
  
  const mtcRow2 = await engPool.query(
    `SELECT machine_type_code, tool_code_filter, machine_group FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
     WHERE machine_type_name = $1 AND is_active ORDER BY machine_type_code LIMIT 1`,
    [machine_type_name]
  );
  const mtcRow2Data = mtcRow2.rows[0];
  const machineTypeCode = mtcRow2Data ? (mtcRow2Data.tool_code_filter || mtcRow2Data.machine_type_code) : null;
  // Label printed on the sheet. The caller (PDF picker) decides: a SPLIT group passes the
  // specific machine name (e.g. KS-400B2); a COMBINED group passes the group name (e.g.
  // TSG-300W/TSG-300ZNC). Fallback when no display_name is given: group name, else machine name.
  const machineDisplayName = displayName || mtcRow2Data?.machine_group || machine_type_name;
  // The shared group name is still needed to match T-Select fallback tools, which are
  // keyed by tooling_machine.machine_group (e.g. 'KS-400B1/B2/B7'), not the per-machine name.
  const machineGroup = mtcRow2Data?.machine_group || null;

  const firstProcessInfo = process_code
    ? searchData.process_info.find(r => String(r.process_code) === String(process_code)) || searchData.process_info[0]
    : searchData.process_info[0];

  map['cn']               = searchData.cn || '';
  map['parts_no']         = searchData.parts_no || '';
  map['dwg_rev']          = searchData.dwg_rev || 'NC';
  map['part_type']        = searchData.part_type || '';
  map['category']         = searchData.part_info?.class1_name || PART_CATEGORY[searchData.part_type] || searchData.part_type || '';
  map['material']         = searchData.material?.material || '';
  map['process_code']     = firstProcessInfo?.process_code || '';
  map['process_name']     = firstProcessInfo?.process_eng  || firstProcessInfo?.process_name || '';
  map['ct']               = firstProcessInfo?.ct != null ? String(firstProcessInfo.ct) : '';
  map['machine_type_name'] = machineDisplayName || '';
  map['current_date']     = moment().format('YYYY-MM-DD');

  if (searchData.dimension) {
    const dim = searchData.dimension;
    Object.keys(dim).forEach(k => { map[`dimension.${k}`] = dim[k] !== null ? String(dim[k]) : ''; });
    const od = Number(dim.od_aft || 0), w = Number(dim.w_aft || 0), sdStored = Number(dim.sd || 0);
    const sdCalc = (od > 0 && od > w) ? Math.sqrt(od * od - w * w) : 0;
    const sd = sdStored > 0 ? sdStored : sdCalc;
    if (sd > 0) map['dimension.sd'] = sd.toFixed(3);
  }

  if (searchData.production) {
    map['model'] = searchData.production.model || '';
    map['customer'] = searchData.production.customer || '';
    map['cust_dwg_no'] = searchData.production.cust_dwg_no || '';
  }

  let tools = searchData.process_plan || [];
  if (process_code) tools = tools.filter(t => String(t.process_code) === String(process_code));

  let mtRows = [];
  if (machine_type_name && process_code) {
    // Machine Tool Config (sds_machine_tool) is SHARED across a machine_group — grouped
    // machines (e.g. KS-400B1/B2/B7) use the same fixtures, so the curated T01–T20 list
    // lives once on the representative (KS-400B1). Look it up group-wide so B2/B7 reuse it
    // without duplicating rows. Per-machine differences live only in the Excel config below.
    const toolMachineNames = machineGroup
      ? (await engPool.query(
          `SELECT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
           WHERE machine_group = $1 AND is_active`,
          [machineGroup]
        )).rows.map(r => r.machine_type_name)
      : [machine_type_name];
    const mtResult = await engPool.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLES.SDS_V2_MACHINE_TOOL}
       WHERE machine_type = ANY($1) AND process_code = $2
       ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
      [toolMachineNames, String(process_code)]
    );
    // Dedupe by tool slot — group members share one curated list.
    const seenTool = new Set();
    mtRows = mtResult.rows.filter(r => !seenTool.has(r.tool_number) && seenTool.add(r.tool_number));
  }

  if (mtRows.length > 0) {
    const allowedKeys = mtRows.map(r => r.tool_drawing_no);
    const matchesAllowed = (dwgNo) => {
      if (!dwgNo) return false;
      return allowedKeys.some(k => dwgNo === k || dwgNo.startsWith(k + '-') || k.startsWith(dwgNo + '-'));
    };
    tools = tools.filter(t => matchesAllowed(t.tool_dwg_no));
    const orderMap = {};
    mtRows.forEach(r => { orderMap[r.tool_drawing_no] = parseInt(r.tool_number.slice(1)); });
    const getOrder = (dwgNo) => {
      if (!dwgNo) return 9999;
      if (orderMap[dwgNo] !== undefined) return orderMap[dwgNo];
      const k = allowedKeys.find(key => dwgNo.startsWith(key + '-') || key.startsWith(dwgNo + '-'));
      return k !== undefined ? orderMap[k] : 9999;
    };
    tools.sort((a, b) => getOrder(a.tool_dwg_no) - getOrder(b.tool_dwg_no));
  } else if (machineTypeCode) {
    tools = tools.filter(t => t.tool_dwg_no?.substring(1, 4) === machineTypeCode);
  }

  const slotData = [];
  for (let i = 0; i < 20; i++) {
    const t = tools[i];
    slotData.push(t ? { tool_name: t.tool_name || '', tool_dwg_no: t.tool_dwg_no || '', fromTs: false } : null);
  }

  const dwgPrefix = (no) => { const p = String(no || '').split('-'); return p.length >= 2 ? `${p[0]}-${p[1]}` : (no || ''); };
  const tsResult = slotData.some(s => s === null) ? await tselectFallback.safeSearch(searchData.cn) : null;
  if (tsResult) {
    const acceptable = new Set([machine_type_name]);
    if (machineGroup) acceptable.add(machineGroup);
    // The PDF is generated for a process_code the part actually has (the user picked
    // a real process row). Tell the fallback so the direction gate is not applied —
    // a multi-grind part (ID grind + spherical/OD grind) has only one stored
    // direction and would otherwise drop a valid machine's T-Select tooling.
    const partHasProcess = (searchData.process_info || []).some(
      r => String(r.process_code) === String(process_code)
    ) || (searchData.process_plan || []).some(
      r => String(r.process_code) === String(process_code)
    );
    const existingPrefixes = new Set(slotData.filter(Boolean).map(s => dwgPrefix(s.tool_dwg_no)).filter(Boolean));
    for (const tt of tselectFallback.tselectToolsForMachine(tsResult, acceptable, { processCode: process_code, partHasProcess })) {
      const pfx = dwgPrefix(tt.tooling_no);
      if (pfx && existingPrefixes.has(pfx)) continue;
      const idx = slotData.findIndex(s => s === null);
      if (idx === -1) break;
      slotData[idx] = { tool_name: tt.tooling_name || '', tool_dwg_no: tt.tooling_no, fromTs: true };
      if (pfx) existingPrefixes.add(pfx);
    }
  }

  const finalTools = [];
  for (let i = 0; i < 20; i++) {
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    const s = slotData[i];
    finalTools.push({
      slot,
      name: s ? s.tool_name : '',
      dwg: s ? (s.fromTs ? `${s.tool_dwg_no} *` : s.tool_dwg_no) : '',
      cleanDwg: s ? s.tool_dwg_no : null
    });
  }
  map['tooling'] = finalTools;

  const paramRows = await engPool.query(
    `SELECT param_key, param_value FROM ${TABLES.SDS_PARAMETER}
     WHERE machine_type_name = $2 AND (cn IS NULL OR cn = $1)
     ORDER BY (cn IS NULL) DESC`,
    [searchData.cn, machine_type_name]
  );
  const rawParams = {};
  paramRows.rows.forEach(r => { rawParams[r.param_key] = r.param_value || ''; });
  map['params'] = rawParams;
  map['sds_rev'] = rawParams['sds_rev'] || 'NC';

  const grindMatch = (map['process_name'] || '').match(/^(.*?)\s*grind/i);
  map['grinding_area_label'] = grindMatch ? `${grindMatch[1].trim().toUpperCase()} GRINDING AREA` : 'GRINDING AREA';

  // Images — only fetch the rows we might match (stored tool_dwg_no can be a
  // prefix of the full dwg, so include every cumulative prefix as a candidate)
  // instead of loading the entire image-BLOB table on every render.
  const dwgNos = slotData.slice(0, 20).map(s => s?.tool_dwg_no).filter(Boolean);
  if (dwgNos.length) {
    const dwgCandidates = new Set();
    for (const d of dwgNos) {
      dwgCandidates.add(d);
      const parts = String(d).split('-');
      for (let i = 1; i < parts.length; i++) dwgCandidates.add(parts.slice(0, i).join('-'));
    }
    const allImgRows = await engPool.query(
      `SELECT tool_dwg_no, image_data, mime_type FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = ANY($1)`,
      [[...dwgCandidates]]
    );
    for (const tool of map.tooling) {
        if (!tool.cleanDwg) continue;
        const img = allImgRows.rows.find(i => tool.cleanDwg === i.tool_dwg_no || tool.cleanDwg.startsWith(i.tool_dwg_no + '-'));
        if (img) tool.image = `data:${img.mime_type};base64,${img.image_data.toString('base64')}`;
    }
  }

  const cnPrefix = searchData.cn.slice(0, 3);
  const grindingQ = await engPool.query(
    `SELECT image_data, mime_type FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
     WHERE $1 = ANY(cn_prefixes) AND ($2::text IS NULL OR process_codes IS NULL OR process_codes = '{}' OR $2::text = ANY(process_codes))
     ORDER BY ($2::text IS NOT NULL AND process_codes IS NOT NULL AND process_codes != '{}' AND $2::text = ANY(process_codes)) DESC NULLS LAST LIMIT 1`,
    [cnPrefix, process_code || null]
  );
  if (grindingQ.rows[0]) {
    map['grinding_layout_image'] = `data:${grindingQ.rows[0].mime_type};base64,${grindingQ.rows[0].image_data.toString('base64')}`;
  }

  return map;
}

// ── Browser Detection ───────────────────────────────────────────────────────

function getBrowserPath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Warm browser singleton ──────────────────────────────────────────────────
// Launch Chrome once and reuse it across requests (a page is opened/closed per
// render). Avoids the ~0.5–1s per-request launch cost; auto-relaunches if it dies.

let _browser = null;
let _browserLaunching = null;

// Chrome buffers the generated PDF to its temp dir (system %TEMP%, which on this
// Windows host lives on C:). When C: fills up, page.pdf() fails mid-stream with
// "Protocol error (IO.read): Read failed". Redirect Chrome's temp to a roomy data
// drive so a full C: no longer breaks PDF generation. Computed once; '' = use the
// OS default (non-Windows, or no data drive available).
let _chromeTmp = null;
function chromeTmpDir() {
  if (_chromeTmp !== null) return _chromeTmp;
  _chromeTmp = '';
  if (process.platform === 'win32') {
    for (const dir of ['D:\\eng-temp', 'E:\\eng-temp']) {
      try { fs.mkdirSync(dir, { recursive: true }); _chromeTmp = dir; break; } catch (_) {}
    }
  }
  return _chromeTmp;
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserLaunching) return _browserLaunching;
  const executablePath = getBrowserPath();
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  const tmp = chromeTmpDir();
  if (tmp) launchOptions.env = { ...process.env, TEMP: tmp, TMP: tmp };
  _browserLaunching = puppeteer.launch(launchOptions).then((b) => {
    _browser = b;
    _browserLaunching = null;
    b.on('disconnected', () => { _browser = null; });
    return b;
  }).catch((e) => { _browserLaunching = null; throw e; });
  return _browserLaunching;
}

// Render an HTML string to a PDF Buffer on a fresh page of the warm browser.
async function renderPdf(html, pdfOpts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setCacheEnabled(false);
    // 'load' fires once inline/data-URI images decode; the template has no
    // external network resources, so 'networkidle2' just added a ~500ms wait.
    await page.setContent(html, { waitUntil: 'load' });
    const raw = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '2.54mm', bottom: '2.54mm', left: '2.54mm', right: '2.54mm' },
      ...pdfOpts,
    });
    return Buffer.from(raw);
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Blank Template Preview ──────────────────────────────────────────────────
// Renders the HTML template with CSS variables but NO real data.
// Used by Template Config UI to show the template structure (like opening sds_template.xlsx).

function buildBlankToolingHtml() {
  let html = '';
  for (let grp = 0; grp < 4; grp++) {
    let labelRow = '', imgRow = '', dwgRow = '', makerRow = '';
    for (let col = 0; col < 5; col++) {
      const idx = grp * 5 + col;
      const slotId = `T${String(idx + 1).padStart(2, '0')}`;
      const cls = col === 4 ? 'tool-slot tool-slot-wide' : 'tool-slot';
      labelRow  += `<div class="${cls}"><div class="tool-label-inner"><span class="tool-id">${slotId}</span><span class="tool-name-val"></span></div></div>`;
      imgRow    += `<div class="${cls}"><div class="tool-img-cell"></div></div>`;
      dwgRow    += `<div class="${cls}"><div class="tool-dwg-cell"><span class="tool-dwg-no"></span></div></div>`;
      makerRow  += `<div class="${cls}"><div class="tool-maker-cell"></div></div>`;
    }
    html += `<div class="tooling-group">
      <div class="tool-label-row">${labelRow}</div>
      <div class="tool-sep-row"></div>
      <div class="tool-img-row">${imgRow}</div>
      <div class="tool-dwg-row">${dwgRow}</div>
      <div class="tool-maker-row">${makerRow}</div>
    </div>`;
  }
  return html;
}

function buildBlankParamsHtml() {
  const SEP_ROWS = new Set([17, 27, 37, 47]);
  const rows = [];
  for (let r = 16; r <= 55; r++) {
    if (SEP_ROWS.has(r)) {
      rows.push('<tr class="sep-row"><td colspan="9"></td></tr>');
    } else {
      rows.push('<tr><td colspan="9"></td></tr>');
    }
  }
  return rows.join('');
}

/** GET /api/sds/v2-headless/pdf-chrome/blank
 *  Returns the HTML template with CSS variables injected but all data placeholders empty.
 *  Accepts ?cssOverrides=<JSON> for live preview in Template Config UI.
 */
router.get('/pdf-chrome/blank', async (req, res) => {
  const { cssOverrides } = req.query;
  try {
    let parsedCssOverrides = null;
    if (cssOverrides) { try { parsedCssOverrides = JSON.parse(cssOverrides); } catch (_) {} }
    const cssConfig = await loadCssConfig(parsedCssOverrides);

    let html = getTemplateHtml();

    // 1. Inject CSS variables
    html = html.replace('{{css_vars_block}}', buildCssVarsBlock(cssConfig));

    // 2. Inject structural sections BEFORE clearing remaining placeholders
    const ecnRows = Array(5).fill(
      '<tr><td></td><td></td><td></td><td></td><td></td></tr>'
    ).join('');
    html = html.replace('{{ecn_html}}',            ecnRows);
    html = html.replace('{{tooling_html}}',         buildBlankToolingHtml());
    html = html.replace('{{params_html}}',          buildBlankParamsHtml());
    html = html.replace('{{grinding_layout_html}}', '<div class="grinding-no-img">No Image</div>');
    html = html.replace('{{gw_params_html}}',       '');

    // 3. Clear all remaining scalar placeholders
    html = html.replace(/{{[^}]+}}/g, '');

    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Grid Template → PDF ─────────────────────────────────────────────────────
// Renders the Excel-like blank-template grid (cells + borders + fills designed
// in the Template Config "Grid Editor") to a printable PDF. Mirrors the grid
// the user draws in SdsBlankTemplateGrid.jsx.

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildGridPdfHtml(grid) {
  const rows = Math.max(1, parseInt(grid.rows, 10) || 56);
  const cols = Math.max(1, parseInt(grid.cols, 10) || 48);
  const borders = grid.borders || {};
  const fills   = grid.fills   || {};
  const cells   = grid.cells   || {};
  const merges  = Array.isArray(grid.merges) ? grid.merges : [];

  // Per-column widths / per-row heights (px in the editor) → scaled to the page.
  const fit = (arr, n, d) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && Number(arr[i]) > 0 ? Number(arr[i]) : d));
  const colW = fit(grid.colW, cols, 30);
  const rowH = fit(grid.rowH, rows, 22);
  const sumW = colW.reduce((a, b) => a + b, 0) || 1;
  const PAGE_W_MM = 287;            // A4 landscape printable width (297 − 2×5mm margin)
  const scale = PAGE_W_MM / sumW;   // mm per editor-px (preserves aspect for rows + fonts)

  // Merge lookup: covered cells are skipped; base cell gets row/col span.
  const covered = new Set();
  const spanAt = {};
  for (const m of merges) {
    const r1 = +m.r1, c1 = +m.c1, r2 = +m.r2, c2 = +m.c2;
    if ([r1, c1, r2, c2].some(n => Number.isNaN(n))) continue;
    spanAt[`${r1},${c1}`] = { rs: r2 - r1 + 1, cs: c2 - c1 + 1, r2, c2 };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (r === r1 && c === c1) continue; covered.add(`${r},${c}`); }
  }

  const edge = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : 'none');
  // For a merged cell the visible perimeter borders live on the edge cells.
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

  const colgroup = colW.map(w => `<col style="width:${(w * scale).toFixed(3)}mm">`).join('');

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
        // Always emit a size — cells with data but no xlsx font default to the
        // SDS base sz=10 (otherwise the browser default ~16px makes them huge).
        `font-size:${(((f && f.size) || 10) * 1.3333 * scale).toFixed(3)}mm`,
        f && f.bold ? 'font-weight:bold' : '',
        f && f.italic ? 'font-style:italic' : '',
        f && f.color ? `color:${f.color}` : '',
        `text-align:${(a && a.h) || 'left'}`,
        `vertical-align:${(a && a.v) || 'middle'}`,
        a && a.wrap ? 'white-space:normal' : 'white-space:nowrap',
        // let injected text overflow over empty neighbours (Excel behaviour)
        a && a.wrap ? 'overflow:hidden' : 'overflow:visible',
      ].filter(Boolean).join(';');
      const sp = span ? `${span.cs > 1 ? ` colspan="${span.cs}"` : ''}${span.rs > 1 ? ` rowspan="${span.rs}"` : ''}` : '';
      const content = cd && cd.img
        ? `<img src="${cd.img}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;">`
        : escHtml(cd && cd.v);
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

// Excel column letters → 0-based index (A→0, I→8, AN→39 … AV→47)
function colLettersToIndex(s) {
  let n = 0;
  for (const ch of String(s).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function cellAddrToRC(addr) {
  const m = String(addr).match(/^([A-Z]+)(\d+)$/);
  return m ? { r: +m[2] - 1, c: colLettersToIndex(m[1]) } : null;
}

// Fixed image anchor ranges in the SDS layout (mirror of the LibreOffice path).
const IMAGE_EXTENTS = {
  tool_image_T01: { tl: 'K18', br: 'P23' }, tool_image_T02: { tl: 'Q18', br: 'V23' },
  tool_image_T03: { tl: 'W18', br: 'AB23' }, tool_image_T04: { tl: 'AC18', br: 'AH23' },
  tool_image_T05: { tl: 'AI18', br: 'AN23' }, tool_image_T06: { tl: 'K28', br: 'P33' },
  tool_image_T07: { tl: 'Q28', br: 'V33' }, tool_image_T08: { tl: 'W28', br: 'AB33' },
  tool_image_T09: { tl: 'AC28', br: 'AH33' }, tool_image_T10: { tl: 'AI28', br: 'AN33' },
  tool_image_T11: { tl: 'K38', br: 'P43' }, tool_image_T12: { tl: 'Q38', br: 'V43' },
  tool_image_T13: { tl: 'W38', br: 'AB43' }, tool_image_T14: { tl: 'AC38', br: 'AH43' },
  tool_image_T15: { tl: 'AI38', br: 'AN43' }, tool_image_T16: { tl: 'K48', br: 'P53' },
  tool_image_T17: { tl: 'Q48', br: 'V53' }, tool_image_T18: { tl: 'W48', br: 'AB53' },
  tool_image_T19: { tl: 'AC48', br: 'AH53' }, tool_image_T20: { tl: 'AI48', br: 'AN53' },
  grinding_layout_image: { tl: 'AO26', br: 'AU45' },
};

/** Inject per-CN data into the designed grid by cell address (pure function).
 *  - mappings: [{ cell_address, param_key }] from sds_excel_mapping (machine wins)
 *  - valueMap: scalar fields + .params (row_N_X / gw_row_N_X) from buildValueMap
 *  Designed cell formatting (font/border/merge) is preserved; only text is set. */
function applyDataToGrid(grid, valueMap, mappings) {
  const cells = { ...(grid.cells || {}) };
  const fills = { ...(grid.fills || {}) };
  const params = valueMap.params || {};
  const HDR_BG = '#e0e0e0';                 // param/GW header-row highlight (matches CSS config default)
  const isTrue = (v) => v === '1' || v === 1 || String(v).toLowerCase() === 'true';
  const findCell = (param_key) => (mappings.find((mp) => mp.param_key === param_key) || {}).cell_address;
  const setCell = (r, c, v, red) => {
    if (v == null || v === '' || r < 0 || c < 0) return;
    const k = `${r},${c}`;
    const ex = cells[k] || {};
    cells[k] = { ...ex, v: String(v), f: { ...(ex.f || {}), ...(red ? { color: '#ff0000' } : {}) }, a: ex.a || {} };
  };

  // Images: place each tool/grinding image at its anchor cell, merging the range
  // so it fills the region (idempotent vs. any merge already on that top-left).
  const existingTl = new Set((grid.merges || []).map((m) => `${m.r1},${m.c1}`));
  const newMerges = [];
  const placeImage = (extentKey, dataUri) => {
    if (!dataUri) return;
    const ext = IMAGE_EXTENTS[extentKey];
    if (!ext) return;
    const tl = cellAddrToRC(ext.tl), br = cellAddrToRC(ext.br);
    if (!tl || !br) return;
    const k = `${tl.r},${tl.c}`;
    cells[k] = { ...(cells[k] || {}), img: dataUri };
    if (!existingTl.has(k)) { newMerges.push({ r1: tl.r, c1: tl.c, r2: br.r, c2: br.c }); existingTl.add(k); }
  };

  // 1) Mapped scalar fields (skip image objects)
  for (const { cell_address, param_key } of mappings) {
    const m = String(cell_address).match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    let val = valueMap[param_key];
    if (val == null) val = params[param_key];
    if (val && typeof val === 'object') continue; // images handled elsewhere
    setCell(+m[2] - 1, colLettersToIndex(m[1]), val);
  }

  // 2) Parameter table (A:I) + GW section (AN:AV) straight from row_N_COL keys
  for (const [key, val] of Object.entries(params)) {
    let mm = key.match(/^row_(\d+)_([A-I])$/);
    if (mm) { setCell(+mm[1] - 1, colLettersToIndex(mm[2]), val, params[`${key}_type`] === 'value'); continue; }
    mm = key.match(/^gw_row_(\d+)_(A[N-V])$/);
    if (mm) { setCell(+mm[1] - 1, colLettersToIndex(mm[2]), val, params[`${key}_type`] === 'value'); continue; }
  }

  // 2b) Header rows (row_N_is_header / gw_row_N_is_header) → grey highlight + bold,
  //     merged across the section so it reads like the Excel header band.
  const addHeaderRow = (rowNum, c1, c2, txt) => {
    const r = rowNum - 1;
    const k = `${r},${c1}`;
    fills[k] = HDR_BG;
    const ex = cells[k] || {};
    cells[k] = {
      ...ex,
      v: txt != null && txt !== '' ? String(txt) : (ex.v || ''),
      f: { ...(ex.f || {}), bold: true, color: '#000000' },
      a: { ...(ex.a || {}), h: 'center', v: 'middle' },
    };
    if (!existingTl.has(k)) { newMerges.push({ r1: r, c1, r2: r, c2 }); existingTl.add(k); }
  };
  for (const [key, val] of Object.entries(params)) {
    let hm = key.match(/^row_(\d+)_is_header$/);
    if (hm && isTrue(val)) { addHeaderRow(+hm[1], 0, 8, params[`row_${hm[1]}_A`]); continue; }
    hm = key.match(/^gw_row_(\d+)_is_header$/);
    if (hm && isTrue(val)) { addHeaderRow(+hm[1], colLettersToIndex('AN'), colLettersToIndex('AV'), params[`gw_row_${hm[1]}_AN`]); }
  }

  // 3) Tooling drawing numbers + names — placed at the mapped cells
  //    (sds_excel_mapping keys: tool_dwg_no_T01 / tool_name_T01 …)
  (valueMap.tooling || []).forEach((t) => {
    if (!t) return;
    if (t.dwg) { const rc = cellAddrToRC(findCell(`tool_dwg_no_${t.slot}`)); if (rc) setCell(rc.r, rc.c, t.dwg, true); }
    if (t.name) { const rc = cellAddrToRC(findCell(`tool_name_${t.slot}`)); if (rc) setCell(rc.r, rc.c, t.name); }
  });

  // 4) Tooling + grinding images into their anchor regions
  (valueMap.tooling || []).forEach((t) => { if (t && t.image) placeImage(`tool_image_${t.slot}`, t.image); });
  placeImage('grinding_layout_image', valueMap.grinding_layout_image);

  return { ...grid, cells, fills, merges: [...(grid.merges || []), ...newMerges] };
}

/** GET /api/sds/v2-headless/pdf-chrome/grid
 *  Renders the saved grid layout to PDF.
 *  - Blank/design preview: no params, or ?gridOverride=<JSON> for live edits.
 *  - Production SDS: pass ?cn=&machine_type_name=&process_code= to inject real
 *    per-CN data into the designed grid (Approach B — grid drives the SDS PDF).
 *  ?debug=html returns the raw HTML instead of a PDF.
 */
router.get('/pdf-chrome/grid', async (req, res) => {
  const { gridOverride, debug, cn, machine_type_name, process_code, display_name } = req.query;
  try {
    let grid = null;
    if (gridOverride) { try { grid = JSON.parse(gridOverride); } catch (_) {} }
    if (!grid) {
      const r = await engPool.query(
        `SELECT config_value FROM sds_template_css_config WHERE config_key = 'grid-layout' LIMIT 1`
      );
      if (r.rows[0]?.config_value) { try { grid = JSON.parse(r.rows[0].config_value); } catch (_) {} }
    }
    if (!grid || typeof grid !== 'object') grid = { rows: 56, cols: 20, borders: {}, fills: {} };

    // Production mode: fill the designed grid with real CN data via cell addresses
    if (cn && machine_type_name) {
      const searchData = await getSearchData(cn.trim());
      const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool, display_name?.trim() || null);
      const mq = await engPool.query(
        `SELECT cell_address, param_key FROM ${TABLES.SDS_EXCEL_MAPPING}
         WHERE machine_type_name = $1 OR machine_type_name IS NULL
         ORDER BY (machine_type_name IS NULL) DESC`,
        [machine_type_name.trim()]
      );
      const merged = {};
      for (const row of mq.rows) merged[row.cell_address] = row.param_key; // machine-specific (later) wins
      const mappings = Object.entries(merged).map(([cell_address, param_key]) => ({ cell_address, param_key }));
      grid = applyDataToGrid(grid, valueMap, mappings);
    }

    const html = buildGridPdfHtml(grid);
    if (debug === 'html') return res.send(html);

    const pdfBuffer = await renderPdf(html, { margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' } });

    // Stream the buffer directly — no temp-file disk round-trip.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: `Grid PDF render failed: ${err.message}` });
  }
});

// ── Rendering Endpoint ──────────────────────────────────────────────────────

router.get('/pdf-chrome', async (req, res) => {
  const { cn, machine_type_name, process_code, debug, cssOverrides, display_name } = req.query;
  console.log(`[SDS PDF Chrome] Request: cn=${cn}, machine=${machine_type_name}, process=${process_code}, debug=${debug}`);
  
  if (!cn?.trim() || !machine_type_name?.trim()) return res.status(400).json({ error: 'cn and machine_type_name are required' });

  try {
    console.log('[SDS PDF Chrome] Fetching search data...');
    const searchData = await getSearchData(cn.trim());
    
    console.log('[SDS PDF Chrome] Building value map...');
    const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool, display_name?.trim() || null);

    // Parse live CSS overrides from query (for template config preview)
    let parsedCssOverrides = null;
    if (cssOverrides) {
      try { parsedCssOverrides = JSON.parse(cssOverrides); } catch (_) {}
    }
    const cssConfig = await loadCssConfig(parsedCssOverrides);
    const cssVarsBlock = buildCssVarsBlock(cssConfig);

    console.log('[SDS PDF Chrome] Loading HTML template...');
    let html = getTemplateHtml();
    html = html.replace('{{css_vars_block}}', cssVarsBlock);

    // ── Scalar fields ──────────────────────────────────────────────────────────
    const esc = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html = html.replace(/{{cn}}/g,                   esc(valueMap.cn));
    html = html.replace(/{{parts_no}}/g,             esc(valueMap.parts_no));
    html = html.replace(/{{dwg_rev}}/g,              esc(valueMap.dwg_rev));
    html = html.replace(/{{material}}/g,             esc(valueMap.material));
    html = html.replace(/{{process_code}}/g,         esc(valueMap.process_code));
    html = html.replace(/{{process_name}}/g,         esc(valueMap.process_name));
    html = html.replace(/{{customer}}/g,             esc(valueMap.customer));
    html = html.replace(/{{model}}/g,                esc(valueMap.model));
    html = html.replace(/{{category}}/g,             esc(valueMap.category));
    html = html.replace(/{{machine_type_name}}/g,    esc(valueMap.machine_type_name));
    html = html.replace(/{{current_date}}/g,         esc(valueMap.current_date));
    html = html.replace(/{{sds_rev}}/g,              esc(valueMap.sds_rev));
    html = html.replace(/{{grinding_area_label}}/g,  esc(valueMap.grinding_area_label));
    html = html.replace(/{{ct}}/g,                   esc(valueMap.ct));

    const p = valueMap.params || {};
    html = html.replace(/{{stamp_prepared}}/g,  esc(p['stamp_prepared']));
    html = html.replace(/{{stamp_checked}}/g,   esc(p['stamp_checked']));
    html = html.replace(/{{stamp_approved}}/g,  esc(p['stamp_approved']));
    html = html.replace(/{{program_no}}/g,      esc(p['program_no'] || ''));
    html = html.replace(/{{program_name}}/g,    esc(p['program_name'] || ''));

    // ── ECN Revision History ───────────────────────────────────────────────────
    let ecnHtml = '';
    for (let i = 1; i <= 5; i++) {
      ecnHtml += `<tr>
        <td>${esc(p[`rev_${i}`])}</td>
        <td>${esc(p[`ecn_no_${i}`])}</td>
        <td>${esc(p[`date_${i}`])}</td>
        <td>${esc(p[`description_${i}`])}</td>
        <td>${esc(p[`remark_${i}`])}</td>
      </tr>`;
    }
    html = html.replace(/{{ecn_html}}/g, ecnHtml);

    // ── Tooling Grid: 4 groups × 5 slots (matches Excel row structure) ─────────
    // Each group: label-row (3.65mm) + sep-row (0.84mm) + img-row (21.9mm)
    //             + dwg-row (3.65mm) + maker-row (3.65mm) = 33.69mm
    const allTools = valueMap.tooling || [];
    let toolingHtml = '';
    for (let grp = 0; grp < 4; grp++) {
      const slotClass = (col) => col === 4 ? 'tool-slot tool-slot-wide' : 'tool-slot';

      // — Label row (T01 label + tool name) —
      let labelRow = '';
      for (let col = 0; col < 5; col++) {
        const idx   = grp * 5 + col;
        const t     = allTools[idx];
        const slotId = `T${String(idx + 1).padStart(2, '0')}`;
        labelRow += `<div class="${slotClass(col)}">
          <div class="tool-label-inner">
            <span class="tool-id">${slotId}</span>
            <span class="tool-name-val">${esc(t?.name || '')}</span>
          </div></div>`;
      }

      // — Image row —
      let imgRow = '';
      for (let col = 0; col < 5; col++) {
        const t = allTools[grp * 5 + col];
        imgRow += `<div class="${slotClass(col)}">
          <div class="tool-img-cell">${t?.image ? `<img src="${t.image}" alt="">` : ''}</div>
        </div>`;
      }

      // — Tooling No row —
      let dwgRow = '';
      for (let col = 0; col < 5; col++) {
        const t = allTools[grp * 5 + col];
        dwgRow += `<div class="${slotClass(col)}">
          <div class="tool-dwg-cell"><span class="tool-dwg-no">${esc(t?.dwg || '')}</span></div>
        </div>`;
      }

      // — Maker row —
      let makerRow = '';
      for (let col = 0; col < 5; col++) {
        const idx    = grp * 5 + col;
        const slotId = `T${String(idx + 1).padStart(2, '0')}`;
        const maker  = esc(p[`maker_${slotId}`] || '');
        makerRow += `<div class="${slotClass(col)}">
          <div class="tool-maker-cell">${maker}</div>
        </div>`;
      }

      toolingHtml += `
        <div class="tooling-group">
          <div class="tool-label-row">${labelRow}</div>
          <div class="tool-sep-row"></div>
          <div class="tool-img-row">${imgRow}</div>
          <div class="tool-dwg-row">${dwgRow}</div>
          <div class="tool-maker-row">${makerRow}</div>
        </div>`;
    }
    html = html.replace(/{{tooling_html}}/g, toolingHtml);

    // ── Param Table (cols A-I, rows 16-55) ────────────────────────────────────
    // Rows 17/27/37/47 are thin separator rows (4.5pt) matching tooling group separators.
    const PARAM_COLS   = ['A','B','C','D','E','F','G','H','I'];
    const SEP_ROWS     = new Set([17, 27, 37, 47]);
    let paramsRows = [];
    for (let r = 16; r <= 55; r++) {
      if (SEP_ROWS.has(r)) {
        paramsRows.push('<tr class="sep-row"><td colspan="9"></td></tr>');
        continue;
      }
      const isHdr   = p[`row_${r}_is_header`] === '1' || p[`row_${r}_is_header`] === 'true';
      const hasData = PARAM_COLS.some(c => p[`row_${r}_${c}`]);
      if (!hasData && !isHdr) continue;
      if (isHdr) {
        paramsRows.push(`<tr class="hdr-row"><td colspan="9">${esc(p[`row_${r}_A`])}</td></tr>`);
      } else {
        let rowHtml = '<tr>';
        PARAM_COLS.forEach(c => {
          const val   = esc(p[`row_${r}_${c}`] || '');
          const isRed = p[`row_${r}_${c}_type`] === 'value';
          rowHtml += `<td class="${isRed ? 'val-red' : ''}">${val}</td>`;
        });
        rowHtml += '</tr>';
        paramsRows.push(rowHtml);
      }
    }
    html = html.replace(/{{params_html}}/g, paramsRows.join(''));

    // ── Grinding Layout Image ──────────────────────────────────────────────────
    const grindingLayoutHtml = valueMap.grinding_layout_image
      ? `<img src="${valueMap.grinding_layout_image}" alt="Grinding Layout">`
      : '<div class="grinding-no-img">No Layout Image</div>';
    html = html.replace(/{{grinding_layout_html}}/g, grindingLayoutHtml);

    // ── GW Section (AN:AV, rows 50-55) ────────────────────────────────────────
    const GW_COLS = ['AN','AO','AP','AQ','AR','AS','AT','AU','AV'];
    let gwRowsHtml = '';
    let hasGw = false;
    for (let r = 50; r <= 55; r++) {
      const isHdr   = p[`gw_row_${r}_is_header`] === '1' || p[`gw_row_${r}_is_header`] === 'true';
      const hasData = GW_COLS.some(c => p[`gw_row_${r}_${c}`]);
      if (!hasData && !isHdr) continue;
      hasGw = true;
      if (isHdr) {
        gwRowsHtml += `<tr class="hdr-row"><td colspan="${GW_COLS.length}">${esc(p[`gw_row_${r}_AN`])}</td></tr>`;
      } else {
        let rowH = '<tr>';
        GW_COLS.forEach(c => {
          const v     = esc(p[`gw_row_${r}_${c}`] || '');
          const isRed = p[`gw_row_${r}_${c}_type`] === 'value';
          rowH += `<td class="${isRed ? 'val-red' : ''}">${v}</td>`;
        });
        rowH += '</tr>';
        gwRowsHtml += rowH;
      }
    }
    const gwParamsHtml = hasGw
      ? `<div class="gw-label">GW SETTING</div><table class="gw-table"><tbody>${gwRowsHtml}</tbody></table>`
      : '';
    html = html.replace(/{{gw_params_html}}/g, gwParamsHtml);

    if (debug === 'html') {
      console.log('[SDS PDF Chrome] Debug mode: Sending HTML');
      return res.send(html);
    }

    console.log('[SDS PDF Chrome] Rendering PDF (warm browser)...');
    const pdfBuffer = await renderPdf(html); // default 2.54mm margins = Excel page setup

    // Validate PDF Header (%PDF-)
    const header = pdfBuffer.slice(0, 5).toString('utf8');
    if (header !== '%PDF-') {
      console.error('[SDS PDF Chrome] Invalid Header:', header);
      throw new Error('Generated buffer is not a valid PDF (Missing %PDF- header)');
    }

    console.log(`[SDS PDF Chrome] Success! Buffer size: ${pdfBuffer.length} bytes`);

    // Stream the buffer directly — no temp-file disk round-trip.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);

  } catch (err) {
    console.error('[SDS PDF Chrome] FATAL ERROR:', err);
    res.status(500).json({ error: `Chrome rendering failed: ${err.message}` });
  }
});

// Expose CSS cache flush for admin controller (called after template-config save)
router.flushCssCache = () => { _cssCache = null; _cssCacheAt = 0; };

module.exports = router;
