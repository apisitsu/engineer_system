const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { searchByCn } = require('../services/sdsV2SearchService');
const { TABLES, PATHS } = require('../mtcConstants');

const router = express.Router();

const TEMPLATE_PATH = path.join(__dirname, '../templates/sds_template.xlsx');
const OUTPUT_DIR    = path.resolve('./output/sds-pdf');
const SOFFICE       = path.resolve('./tools/LibreOfficePortable/App/libreoffice/program/soffice.exe');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }

// ── Column letter helper ──────────────────────────────────────────────────────

/** 'A' → 1, 'Z' → 26, 'AA' → 27, 'AO' → 41 (1-based) */
function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 'B3' → { col: 2, row: 3 } (1-based, matches ExcelJS getCell) */
function cellAddressToRC(addr) {
  const m = addr.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2]) };
}

/** 'B3' → { col: 1, row: 2 } (0-based for ExcelJS addImage tl/br) */
function cellAddressTo0Based(addr) {
  const rc = cellAddressToRC(addr);
  if (!rc) return null;
  return { col: rc.col - 1, row: rc.row - 1 };
}

// ── Image extent map: param_key → { tl_cell, br_cell } ─────────────────────
// These define where each image is anchored in the template.
// Adjust if the template layout changes.
const IMAGE_EXTENTS = {
  tool_image_T01: { tl: 'K18', br: 'P23' },
  tool_image_T02: { tl: 'Q18', br: 'V23' },
  tool_image_T03: { tl: 'W18', br: 'AB23' },
  tool_image_T04: { tl: 'AC18', br: 'AH23' },
  tool_image_T05: { tl: 'AI18', br: 'AN23' },
  tool_image_T06: { tl: 'K28', br: 'P33' },
  tool_image_T07: { tl: 'Q28', br: 'V33' },
  tool_image_T08: { tl: 'W28', br: 'AB33' },
  tool_image_T09: { tl: 'AC28', br: 'AH33' },
  tool_image_T10: { tl: 'AI28', br: 'AN33' },
  tool_image_T11: { tl: 'K38', br: 'P43' },
  tool_image_T12: { tl: 'Q38', br: 'V43' },
  tool_image_T13: { tl: 'W38', br: 'AB43' },
  tool_image_T14: { tl: 'AC38', br: 'AH43' },
  tool_image_T15: { tl: 'AI38', br: 'AN43' },
  tool_image_T16: { tl: 'K48', br: 'P53' },
  tool_image_T17: { tl: 'Q48', br: 'V53' },
  tool_image_T18: { tl: 'W48', br: 'AB53' },
  tool_image_T19: { tl: 'AC48', br: 'AH53' },
  tool_image_T20: { tl: 'AI48', br: 'AN53' },
  grinding_layout_image: { tl: 'AO26', br: 'AU45' },
};

// ── Resolve param_key → value ─────────────────────────────────────────────────

function getNestedValue(obj, path) {
  return path.split('.').reduce((cur, key) => cur?.[key], obj);
}

/**
 * Build a flat value map: param_key → string value or Buffer (for images)
 * Sources (checked in order):
 *   1. Search API data  (cn, parts_no, dwg_rev, material, dimension, production, process_info, process_plan)
 *   2. sds_parameter    (per-record if cn given, machine-config if cn=NULL)
 *   3. sds_machine_type_code.grinding_area_label
 *   4. tooling image buffers from sds_v2_tooling_image
 *   5. grinding image buffer from sds_v2_grinding_image
 */
const PART_CATEGORY = {
  BALL: 'Ball Parts', RACE: 'Race Parts', BODY: 'Body Parts',
  SLEEVE: 'Sleeve Parts', SPHERICAL: 'Spherical Parts',
};

async function buildValueMap(searchData, machine_type_name, process_code, engPool) {
  const map = {};

  // Resolve machine_type_code for tool filtering (use tool_code_filter when available)
  const mtcRow2 = await engPool.query(
    `SELECT machine_type_code, tool_code_filter FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE machine_type_name = $1 LIMIT 1`,
    [machine_type_name]
  );
  const mtcRow2Data = mtcRow2.rows[0];
  const machineTypeCode = mtcRow2Data
    ? (mtcRow2Data.tool_code_filter || mtcRow2Data.machine_type_code)
    : null;

  // 1. Static fields from Search API
  const firstProcessInfo = process_code
    ? searchData.process_info.find(r => r.process_code === process_code) || searchData.process_info[0]
    : searchData.process_info[0];

  map['cn']               = searchData.cn || '';
  map['parts_no']         = searchData.parts_no || '';
  map['dwg_rev']          = searchData.dwg_rev || 'NC';
  map['part_type']        = searchData.part_type || '';
  map['category']         = searchData.part_info?.class1_name || PART_CATEGORY[searchData.part_type] || searchData.part_type || '';
  map['material']         = searchData.material?.material || '';
  map['process_code']     = firstProcessInfo?.process_code || '';
  map['process_name']     = firstProcessInfo?.process_eng  || firstProcessInfo?.process_name || '';
  map['process_eng']      = firstProcessInfo?.process_eng  || '';
  map['ct']               = firstProcessInfo?.ct != null ? String(firstProcessInfo.ct) : '';
  map['machine_type_name'] = machine_type_name || '';

  // Production fields
  if (searchData.production) {
    map['model']        = searchData.production.model || '';
    map['customer']     = searchData.production.customer || '';
    map['cust_dwg_no']  = searchData.production.cust_dwg_no || '';
  }

  // Tooling slots T01–T20 — filtered by process_code and machine_type_code
  let tools = searchData.process_plan || [];
  if (process_code) tools = tools.filter(t => t.process_code === process_code);
  if (machineTypeCode) tools = tools.filter(t => t.tool_dwg_no?.substring(1, 4) === machineTypeCode);

  for (let i = 0; i < 20; i++) {
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    const t = tools[i];
    map[`tool_name_${slot}`]   = t?.tool_name   || '';
    map[`tool_dwg_no_${slot}`] = t?.tool_dwg_no || '';
  }

  // 2. sds_parameter — per-record (cn specific)
  const paramRows = await engPool.query(
    `SELECT param_key, param_value FROM ${TABLES.SDS_PARAMETER}
     WHERE cn = $1 AND machine_type_name = $2`,
    [searchData.cn, machine_type_name]
  );
  paramRows.rows.forEach(r => { map[r.param_key] = r.param_value || ''; });

  // Default sds_rev to 'NC' if not provided
  if (!map['sds_rev']) map['sds_rev'] = 'NC';

  // 3. sds_machine_type_code — grinding_area_label
  const mtcRow = await engPool.query(
    `SELECT grinding_area_label FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
     WHERE machine_type_name = $1 LIMIT 1`,
    [machine_type_name]
  );
  map['grinding_area_label'] = mtcRow.rows[0]?.grinding_area_label || 'GRINDING AREA';

  // 4. Tooling images (Buffer) — uses already-filtered tools list
  const dwgNos = tools.slice(0, 20).map(t => t?.tool_dwg_no).filter(Boolean);
  if (dwgNos.length) {
    // Stored keys may be partial (e.g. '4866-14') while process_plan has full form ('4866-14-0001')
    const allImgRows = await engPool.query(
      `SELECT tool_dwg_no, image_data, mime_type FROM ${TABLES.SDS_V2_TOOLING_IMAGE}`
    );
    const imgMap = {};
    for (const img of allImgRows.rows) {
      const match = dwgNos.find(d => d === img.tool_dwg_no || d.startsWith(img.tool_dwg_no + '-') || d.startsWith(img.tool_dwg_no));
      if (match && !imgMap[match]) imgMap[match] = img;
    }
    for (let i = 0; i < 20; i++) {
      const slot = `T${String(i + 1).padStart(2, '0')}`;
      const dwgNo = tools[i]?.tool_dwg_no;
      if (dwgNo && imgMap[dwgNo]) {
        map[`tool_image_${slot}`] = { data: imgMap[dwgNo].image_data, mime: imgMap[dwgNo].mime_type };
      }
    }
  }

  // 5. Grinding layout image
  const cnPrefix = searchData.cn.slice(0, 3);
  const grindingQ = await engPool.query(
    `SELECT image_data, mime_type FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
     WHERE cn_prefix = $1
       AND (process_code IS NULL OR process_code = $2)
     ORDER BY (process_code = $2) DESC NULLS LAST
     LIMIT 1`,
    [cnPrefix, process_code || null]
  );
  if (grindingQ.rows[0]) {
    map['grinding_layout_image'] = {
      data: grindingQ.rows[0].image_data,
      mime: grindingQ.rows[0].mime_type,
    };
  }

  return map;
}

// ── mime → ExcelJS extension ──────────────────────────────────────────────────

function mimeToExt(mime) {
  if (!mime) return 'jpeg';
  if (mime.includes('png'))  return 'png';
  if (mime.includes('gif'))  return 'gif';
  if (mime.includes('bmp'))  return 'bmp';
  return 'jpeg';
}

// ── Parse image dimensions from buffer (PNG / JPEG) ───────────────────────────

function getImageDimensions(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG: 8-byte signature + IHDR: 4 len + 4 'IHDR' + 4 width + 4 height
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF marker
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xFF) break;
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) ||
          (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

// ── Cell metrics helpers ──────────────────────────────────────────────────────

/** Total pixel size of a merged cell range (used for aspect-ratio scaling). */
function getCellRangePixels(ws, tlAddr, brAddr) {
  const tl = cellAddressTo0Based(tlAddr);
  const br = cellAddressTo0Based(brAddr);
  if (!tl || !br) return null;
  let w = 0;
  for (let c = tl.col + 1; c <= br.col; c++) w += (ws.getColumn(c).width || 8.43) * 7;
  let h = 0;
  for (let r = tl.row + 1; r <= br.row; r++) h += (ws.getRow(r).height || 15) * (4 / 3);
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

// ── Fill ExcelJS worksheet ────────────────────────────────────────────────────

async function fillTemplate(workbook, mappings, valueMap) {
  const ws = workbook.worksheets[0];

  for (const { cell_address, param_key } of mappings) {
    const val = valueMap[param_key];
    if (val === undefined || val === null) continue;

    if (typeof val === 'object' && val.data) {
      // Image value — scale to fit cell range, maintain aspect ratio
      const extent = IMAGE_EXTENTS[param_key];
      if (!extent) continue;
      const tl = cellAddressTo0Based(extent.tl);
      const br = cellAddressTo0Based(extent.br);
      if (!tl || !br) continue;
      try {
        const imgId = workbook.addImage({
          buffer: val.data,
          extension: mimeToExt(val.mime),
        });
        const cellPx = getCellRangePixels(ws, extent.tl, extent.br);
        const dim = getImageDimensions(Buffer.isBuffer(val.data) ? val.data : Buffer.from(val.data));
        if (cellPx && dim && dim.width > 0 && dim.height > 0) {
          const scale = Math.min(cellPx.width / dim.width, cellPx.height / dim.height);
          ws.addImage(imgId, {
            tl: { col: tl.col, row: tl.row },
            ext: { width: Math.round(dim.width * scale), height: Math.round(dim.height * scale) },
            editAs: 'oneCell',
          });
        } else {
          ws.addImage(imgId, `${extent.tl}:${extent.br}`);
        }
      } catch (_) {}
    } else {
      // Text value
      const cell = ws.getCell(cell_address);
      const current = cell.value;
      if (typeof current === 'string' && current.includes(`{{${param_key}}}`)) {
        cell.value = current.replace(`{{${param_key}}}`, String(val));
      } else {
        cell.value = val !== '' ? val : cell.value; // don't blank out static cells
      }
    }
  }
}

// ── sds_parameter A16:I55 rows ─────────────────────────────────────────────

async function fillMachineConfigSection(ws, machine_type_name, cn, engPool) {
  const rows = await engPool.query(
    `SELECT cn, param_key, param_value FROM ${TABLES.SDS_PARAMETER}
     WHERE (cn IS NULL OR cn = $2) AND machine_type_name = $1
     ORDER BY (cn IS NULL) DESC`,
    [machine_type_name, cn || null]
  );
  console.log(`[PDF fillMachineConfigSection] machine=${machine_type_name}, cn=${cn}, rows returned=${rows.rows.length}`);

  const config = {};      // row_N_X → value
  const headerRows = {};  // rowNum → true
  const valueTypes = {};  // 'row_N_X' → 'value'

  rows.rows.forEach(r => {
    const val = r.param_value !== null ? String(r.param_value).trim().toLowerCase() : '';
    
    const hdrMatch = r.param_key.match(/^row_(\d+)_is_header$/);
    if (hdrMatch) { 
      console.log(`[HDR ROW] cn=${JSON.stringify(r.cn)}, key=${r.param_key}, val='${val}', cn!==null=${r.cn !== null}`);
      if (r.cn !== null) return;
      const parsedHdr = parseInt(hdrMatch[1]);
      headerRows[parsedHdr] = (val === '1' || val === 'true'); 
      console.log(`[HDR SET] headerRows[${parsedHdr}] = ${headerRows[parsedHdr]}`);
      return; 
    }

    const typeMatch = r.param_key.match(/^row_(\d+)_([A-I])_type$/i);
    if (typeMatch) { 
      if (r.cn !== null) return;
      valueTypes[`row_${typeMatch[1]}_${typeMatch[2].toUpperCase()}`] = r.param_value; 
      return; 
    }

    config[r.param_key] = r.param_value || '';
  });
  console.log('[HEADER ROWS FINAL]', JSON.stringify(headerRows));

  const COL_LETTERS_RANGE = ['A','B','C','D','E','F','G','H','I'];
  const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' }, bgColor: { argb: 'FFD9D9D9' } };
  const RED_FONT  = { color: { argb: 'FFFF0000' } };

  // Write cell values
  for (const [key, val] of Object.entries(config)) {
    const m = key.match(/^row_(\d+)_([A-I])$/i);
    if (!m) continue;
    const rowNum = parseInt(m[1]);
    const colLetter = m[2].toUpperCase();
    if (rowNum < 16 || rowNum > 55) continue;
    ws.getCell(`${colLetter}${rowNum}`).value = val;
  }

  // Apply header row gray fill.
  // IMPORTANT: use `cell.style = {...}` (full style setter) instead of `cell.fill = ...`
  // to force ExcelJS to create a NEW independent XF entry per cell.
  // Setting only `cell.fill` mutates the shared XF table entry, causing cascade
  // changes to ALL cells that share the same XF — making unrelated rows go gray.
  // We also do NOT set NO_FILL on non-header rows; the template handles those.
  for (const [rowNumStr, isHdr] of Object.entries(headerRows)) {
    if (!isHdr) continue;
    const n = parseInt(rowNumStr);
    if (n < 16 || n > 55) continue;
    for (const c of COL_LETTERS_RANGE) {
      const cell = ws.getCell(`${c}${n}`);
      // Read current style and rebuild as a fresh plain object (breaks shared-XF reference)
      const s = cell.style || {};
      cell.style = {
        numFmt:     s.numFmt     || '',
        font:       s.font       ? JSON.parse(JSON.stringify(s.font))       : {},
        alignment:  s.alignment  ? JSON.parse(JSON.stringify(s.alignment))  : {},
        border:     s.border     ? JSON.parse(JSON.stringify(s.border))     : {},
        protection: s.protection ? JSON.parse(JSON.stringify(s.protection)) : {},
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' }, bgColor: { argb: 'FFD9D9D9' } },
      };
    }
  }
  console.log('[POST-HDR-FILL] A24:', ws.getCell('A24').fill?.pattern, '| A16:', ws.getCell('A16').fill?.pattern, '| A18:', ws.getCell('A18').fill?.pattern);

  // Apply red font to value-type cells
  for (const [cellKey, type] of Object.entries(valueTypes)) {
    if (type !== 'value') continue;
    const m = cellKey.match(/^row_(\d+)_([A-I])$/i);
    if (!m) continue;
    const rowNum = parseInt(m[1]);
    const colLetter = m[2].toUpperCase();
    if (rowNum < 16 || rowNum > 55) continue;
    const cell = ws.getCell(`${colLetter}${rowNum}`);
    // Also use full style setter here to avoid mutating shared XF
    const s = cell.style || {};
    cell.style = {
      numFmt:     s.numFmt     || '',
      font:       { ...(s.font ? JSON.parse(JSON.stringify(s.font)) : {}), ...RED_FONT },
      alignment:  s.alignment  ? JSON.parse(JSON.stringify(s.alignment))  : {},
      border:     s.border     ? JSON.parse(JSON.stringify(s.border))     : {},
      protection: s.protection ? JSON.parse(JSON.stringify(s.protection)) : {},
      fill:       s.fill       ? JSON.parse(JSON.stringify(s.fill))       : {},
    };
  }
}

// ── Main PDF endpoint ─────────────────────────────────────────────────────────

/**
 * GET /api/sds/v2/pdf?cn=C31-01234&machine_type_name=KS-B22G&process_code=IDG001
 */
router.get('/pdf', async (req, res) => {
  const { cn, machine_type_name, process_code } = req.query;
  if (!cn?.trim()) return res.status(400).json({ error: 'cn is required' });
  if (!machine_type_name?.trim()) return res.status(400).json({ error: 'machine_type_name is required' });

  if (!fs.existsSync(TEMPLATE_PATH)) {
    return res.status(500).json({ error: 'sds_template.xlsx not found in templates/' });
  }

  const safe = (s) => String(s || '').replace(/[^\w\-]/g, '_');
  const cacheKey = `${safe(cn)}_${safe(machine_type_name)}_${safe(process_code || 'all')}`;
  ensureDir(OUTPUT_DIR);
  const pdfPath     = path.join(OUTPUT_DIR, `${cacheKey}.pdf`);
  const tempXlsPath = path.join(OUTPUT_DIR, `__tmp_${Date.now()}_${cacheKey}.xlsx`);

  // Serve cached PDF if template hasn't changed
  if (fs.existsSync(pdfPath)) {
    const pdfMtime = fs.statSync(pdfPath).mtimeMs;
    const tplMtime = fs.statSync(TEMPLATE_PATH).mtimeMs;
    if (pdfMtime > tplMtime) return res.sendFile(path.resolve(pdfPath));
  }

  try {
    // 1. Fetch search data
    const searchData = await searchByCn(cn, maqPool, rodpcPool);

    // 2. Load excel mappings (universal + machine-specific, machine overrides universal)
    const mappingResult = await engPool.query(
      `SELECT cell_address, param_key
       FROM ${TABLES.SDS_EXCEL_MAPPING}
       WHERE is_active = true
         AND (machine_type_name IS NULL OR machine_type_name = $1)
       ORDER BY (machine_type_name IS NOT NULL) ASC, sort_order`,
      [machine_type_name.trim()]
    );

    // Merge: machine-specific overrides universal for the same cell_address
    const merged = {};
    for (const row of mappingResult.rows) merged[row.cell_address] = row;
    const mappings = Object.values(merged);

    // 3. Build full value map
    const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool);

    // 4. Fill workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);

    await fillTemplate(workbook, mappings, valueMap);
    await fillMachineConfigSection(workbook.worksheets[0], machine_type_name.trim(), searchData.cn, engPool);
    console.log(`[PDF] Fill done: cn=${searchData.cn}, machine=${machine_type_name.trim()}`);
    // Verify row 24/29 fill after apply
    const _ws = workbook.worksheets[0];
    console.log('[PDF] A24 fill after:', JSON.stringify(_ws.getCell('A24').fill));
    console.log('[PDF] A29 fill after:', JSON.stringify(_ws.getCell('A29').fill));

    // Direct writes — fields that may not yet be in sds_excel_mapping
    const ws0 = workbook.worksheets[0];
    if (valueMap['category'] && !mappings.find(m => m.param_key === 'category'))
      ws0.getCell('B5').value = valueMap['category'];

    await workbook.xlsx.writeFile(tempXlsPath);

    // 5. Convert to PDF via LibreOffice
    execFile(SOFFICE, ['--headless', '--convert-to', 'pdf', tempXlsPath, '--outdir', OUTPUT_DIR], (err) => {
      safeUnlink(tempXlsPath);
      if (err) {
        console.error('[SDS PDF] LibreOffice error:', err.message);
        return res.status(500).json({ error: 'PDF conversion failed', detail: err.message });
      }
      const generatedPath = path.join(OUTPUT_DIR, path.basename(tempXlsPath).replace(/\.xlsx$/, '.pdf'));
      if (!fs.existsSync(generatedPath)) {
        return res.status(500).json({ error: 'PDF file not created after conversion' });
      }
      try { fs.renameSync(generatedPath, pdfPath); } catch (_) {}
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="SDS_${safe(cn)}.pdf"`);
      return res.sendFile(path.resolve(pdfPath));
    });
  } catch (err) {
    safeUnlink(tempXlsPath);
    console.error('[SDS PDF] error:', err.message);
    const status = err.message.startsWith('Unknown CN') || err.message.startsWith('Cannot convert') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * DELETE /api/sds/v2/pdf/cache?cn=&machine_type_name=&process_code=
 * Invalidate cached PDF so next GET regenerates it.
 */
router.delete('/pdf/cache', async (req, res) => {
  const { cn, machine_type_name, process_code } = req.query;
  if (!cn?.trim() || !machine_type_name?.trim()) {
    return res.status(400).json({ error: 'cn and machine_type_name are required' });
  }
  const safe = (s) => String(s || '').replace(/[^\w\-]/g, '_');
  const cacheKey = `${safe(cn)}_${safe(machine_type_name)}_${safe(process_code || 'all')}`;
  const pdfPath = path.join(OUTPUT_DIR, `${cacheKey}.pdf`);
  safeUnlink(pdfPath);
  res.json({ success: true, cleared: cacheKey });
});

module.exports = router;
