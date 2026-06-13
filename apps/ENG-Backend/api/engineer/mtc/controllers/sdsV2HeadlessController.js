const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const moment = require('moment');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { searchByCn } = require('../services/sdsV2SearchService');
const tselectFallback = require('../services/tselectFallback');
const { TABLES } = require('../mtcConstants');

const router = express.Router();

const TEMPLATE_PATH = path.join(__dirname, '../templates/html/sds_template.html');
const OUTPUT_DIR    = path.resolve('./output/sds-pdf');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }

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

async function buildValueMap(searchData, machine_type_name, process_code, engPool) {
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
  const machineDisplayName = mtcRow2Data?.machine_group || machine_type_name;

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
    const mtResult = await engPool.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLES.SDS_V2_MACHINE_TOOL}
       WHERE machine_type = $1 AND process_code = $2
       ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
      [machine_type_name, String(process_code)]
    );
    mtRows = mtResult.rows;
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
    if (machineDisplayName) acceptable.add(machineDisplayName);
    const existingPrefixes = new Set(slotData.filter(Boolean).map(s => dwgPrefix(s.tool_dwg_no)).filter(Boolean));
    for (const tt of tselectFallback.tselectToolsForMachine(tsResult, acceptable, { processCode: process_code })) {
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

  // Images
  const dwgNos = slotData.slice(0, 20).map(s => s?.tool_dwg_no).filter(Boolean);
  if (dwgNos.length) {
    const allImgRows = await engPool.query(`SELECT tool_dwg_no, image_data, mime_type FROM ${TABLES.SDS_V2_TOOLING_IMAGE}`);
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

    let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

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

// ── Rendering Endpoint ──────────────────────────────────────────────────────

router.get('/pdf-chrome', async (req, res) => {
  const { cn, machine_type_name, process_code, debug, cssOverrides } = req.query;
  console.log(`[SDS PDF Chrome] Request: cn=${cn}, machine=${machine_type_name}, process=${process_code}, debug=${debug}`);
  
  if (!cn?.trim() || !machine_type_name?.trim()) return res.status(400).json({ error: 'cn and machine_type_name are required' });

  try {
    console.log('[SDS PDF Chrome] Fetching search data...');
    const searchData = await searchByCn(cn, maqPool, rodpcPool);
    
    console.log('[SDS PDF Chrome] Building value map...');
    const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool);

    // Parse live CSS overrides from query (for template config preview)
    let parsedCssOverrides = null;
    if (cssOverrides) {
      try { parsedCssOverrides = JSON.parse(cssOverrides); } catch (_) {}
    }
    const cssConfig = await loadCssConfig(parsedCssOverrides);
    const cssVarsBlock = buildCssVarsBlock(cssConfig);

    console.log('[SDS PDF Chrome] Loading HTML template...');
    let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
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

    console.log('[SDS PDF Chrome] Launching browser...');
    const executablePath = getBrowserPath();
    const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
    };
    if (executablePath) {
      console.log(`[SDS PDF Chrome] Using browser at: ${executablePath}`);
      launchOptions.executablePath = executablePath;
    } else {
      console.warn('[SDS PDF Chrome] No local browser found, relying on Puppeteer default');
    }

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      console.log('[SDS PDF Chrome] Setting content...');
      await page.setContent(html, { waitUntil: 'networkidle2' });
      
      console.log('[SDS PDF Chrome] Generating PDF buffer...');
      const rawBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          // Match Excel page setup: margins 0.1 inch = 2.54mm each side
          margin: { top: '2.54mm', bottom: '2.54mm', left: '2.54mm', right: '2.54mm' }
      });

      // Ensure we have a Node.js Buffer
      const pdfBuffer = Buffer.from(rawBuffer);

      // Validate PDF Header (%PDF-)
      const header = pdfBuffer.slice(0, 5).toString('utf8');
      if (header !== '%PDF-') {
        console.error('[SDS PDF Chrome] Invalid Header:', header);
        throw new Error('Generated buffer is not a valid PDF (Missing %PDF- header)');
      }

      console.log(`[SDS PDF Chrome] Success! Buffer size: ${pdfBuffer.length} bytes`);
      
      // Save to temp file and serve via sendFile
      ensureDir(OUTPUT_DIR);
      const tempPdfPath = path.join(OUTPUT_DIR, `__render_${Date.now()}_${cn}.pdf`);
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // Clean headers to let sendFile set them correctly
      res.removeHeader('Content-Type'); 
      
      res.sendFile(tempPdfPath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }, (err) => {
        if (err) {
          console.error('[SDS PDF Chrome] sendFile error:', err.message);
        }
        safeUnlink(tempPdfPath);
        console.log('[SDS PDF Chrome] Temp file cleaned up');
      });

    } finally {
      await browser.close();
      console.log('[SDS PDF Chrome] Browser closed');
    }

  } catch (err) {
    console.error('[SDS PDF Chrome] FATAL ERROR:', err);
    res.status(500).json({ error: `Chrome rendering failed: ${err.message}` });
  }
});

// Expose CSS cache flush for admin controller (called after template-config save)
router.flushCssCache = () => { _cssCache = null; _cssCacheAt = 0; };

module.exports = router;
