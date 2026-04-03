/**
 * Setup Data Sheet (SDS) routes
 * Adapted from WebappProject/backend/index.js
 */
const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { poolSds } = require('../db/pool_sds');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

const TEMPLATE_DIR = path.resolve(process.env.SDS_TEMPLATE_DIR || './template');
const CACHE_DIR = path.resolve('./output/pdf-cache');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { if (fs.existsSync(p)) fs.unlinkSync(p); }

function buildPdfCacheKey(h) {
  return (`${h.cn}_${h.process_code}_${h.machine}_DOC-${h.setup_data_sheet_rev}`)
    .replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
}

function revisionSortKey(rev) {
  if (!rev) return -1;
  const r = rev.toUpperCase().trim();
  if (r === 'NC') return 0;
  if (r.length === 1) return r.charCodeAt(0) - 64;
  let val = 0;
  for (const ch of r) val = val * 26 + (ch.charCodeAt(0) - 64);
  return val + 26;
}

/**
 * GET /api/sds/health
 */
router.get('/health', asyncHandler(async (_req, res) => {
  const result = await poolSds.query('SELECT NOW() AS t');
  res.json({ status: 'ok', server_time: result.rows[0].t });
}));

/**
 * GET /api/sds/counts
 */
router.get('/counts', authenticate, asyncHandler(async (_req, res) => {
  const COUNTS_SQL = `
    SELECT
      CASE
        WHEN UPPER(ss.process_name) LIKE '%FACE%' OR UPPER(ss.machine) LIKE '%VSG%' OR UPPER(ss.machine) LIKE '%GVG%' OR UPPER(ss.machine) LIKE '%TSG%' THEN 'Face Grinding'
        WHEN UPPER(ss.process_name) LIKE '%SPHERICAL%' OR UPPER(ss.machine) LIKE '%SPG%' OR UPPER(ss.machine) LIKE '%KS-400%' OR UPPER(ss.machine) LIKE '%KS-500%' THEN 'Spherical Grinding'
        WHEN UPPER(ss.process_name) LIKE '%ID GRIND%' OR UPPER(ss.machine) LIKE '%IDG%' OR UPPER(ss.machine) LIKE '%KS-03%' OR UPPER(ss.machine) LIKE '%KS-B22%' OR UPPER(ss.machine) LIKE '%KS-B80%' OR UPPER(ss.machine) LIKE '%KSR%' THEN 'ID Grinding'
        WHEN UPPER(ss.process_name) LIKE '%OD%' OR UPPER(ss.machine) LIKE '%CGM%' THEN 'OD Grinding'
        WHEN UPPER(ss.process_name) LIKE '%SURFACE%' OR UPPER(ss.machine) LIKE '%SGM%' OR UPPER(ss.machine) LIKE '%HSG%' THEN 'Surface Grinding'
        WHEN UPPER(ss.process_name) LIKE '%TURN%' OR UPPER(ss.machine) LIKE '%BFD%' THEN 'Turning'
        WHEN UPPER(ss.process_name) LIKE '%GROOVE%' OR UPPER(ss.machine) LIKE '%SPF%' THEN 'Groove Grinding'
        ELSE 'Other'
      END AS process_type,
      COUNT(*) AS count
    FROM setup_sheet ss
    GROUP BY process_type
    ORDER BY count DESC;
  `;
  const result = await poolSds.query(COUNTS_SQL);
  const total = result.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);
  res.json({ counts: result.rows, total });
}));

/**
 * POST /api/sds/search
 */
router.post('/search', authenticate, asyncHandler(async (req, res) => {
  const { searchTerm } = req.body;
  if (!searchTerm?.trim()) throw new AppError('searchTerm is required', 400);

  const result = await poolSds.query(
    `SELECT ss.id, ss.cn, ss.part_no, ss.process_name, ss.process_code, ss.machine,
            ss.category, ss.setup_data_sheet_rev, a.prepared_by, a.checked_by, a.approved_by
     FROM setup_sheet ss
     LEFT JOIN approval a ON a.setup_sheet_id = ss.id
     WHERE ss.cn ILIKE $1 OR ss.part_no ILIKE $1 OR ss.process_name ILIKE $1
        OR ss.category ILIKE $1 OR ss.process_code ILIKE $1 OR ss.machine ILIKE $1
     ORDER BY ss.cn, ss.process_code, ss.machine
     LIMIT 200`,
    [`%${searchTerm.trim()}%`]
  );

  // Group by CN+process_code+machine, mark latest revision
  const groups = {};
  result.rows.forEach(row => {
    const key = `${row.cn}|${row.process_code}|${row.machine}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  const rows = [];
  Object.values(groups).forEach(group => {
    group.sort((a, b) => revisionSortKey(a.setup_data_sheet_rev) - revisionSortKey(b.setup_data_sheet_rev));
    group.forEach((row, idx) => rows.push({ ...row, isLatestRevision: idx === group.length - 1 }));
  });

  res.json({ results: rows, total: rows.length });
}));

/**
 * GET /api/sds/pdf?cn=&process_code=&machine=
 */
router.get('/pdf', authenticate, asyncHandler(async (req, res) => {
  const { cn, process_code, machine } = req.query;
  if (!cn || !process_code || !machine) {
    throw new AppError('cn, process_code and machine are required', 400);
  }

  const setupResult = await poolSds.query(
    `SELECT ss.id, ss.cn, ss.process_code, ss.machine, ss.setup_data_sheet_rev
     FROM setup_sheet ss WHERE ss.cn=$1 AND ss.process_code=$2 AND ss.machine=$3`,
    [cn, process_code, machine]
  );

  if (setupResult.rows.length === 0) throw new AppError('Setup sheet not found', 404);
  const setup = setupResult.rows[0];

  ensureDir(CACHE_DIR);
  const cacheKey = buildPdfCacheKey(setup);
  const pdfPath = path.join(CACHE_DIR, `${cacheKey}.pdf`);

  if (fs.existsSync(pdfPath)) return res.sendFile(pdfPath);

  const tplResult = await poolSds.query(
    `SELECT t.excel_file_name FROM setup_sheet ss JOIN template t ON ss.template_id = t.id WHERE ss.id=$1`,
    [setup.id]
  );
  const excelFileName = tplResult.rows[0]?.excel_file_name;
  if (!excelFileName) throw new AppError('Excel template not defined for this template', 500);

  const templatePath = path.join(TEMPLATE_DIR, excelFileName);
  if (!fs.existsSync(templatePath)) throw new AppError(`Excel template not found: ${excelFileName}`, 500);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const mappingResult = await poolSds.query(
    `SELECT m.sheet_name, m.cell_address, m.param_key, COALESCE(v.param_value,'') AS param_value
     FROM template_excel_mapping m
     JOIN setup_sheet ss ON ss.template_id = m.template_id
     LEFT JOIN setup_parameter_value v ON v.param_key = m.param_key AND v.setup_sheet_id = ss.id
     WHERE ss.id=$1 ORDER BY m.id`,
    [setup.id]
  );

  mappingResult.rows.forEach(row => {
    const ws = row.sheet_name ? workbook.getWorksheet(row.sheet_name) : workbook.worksheets[0];
    if (ws && row.cell_address && row.param_key) {
      const cell = ws.getCell(row.cell_address);
      const current = cell.value;
      const placeholder = `{{${row.param_key}}}`;
      if (typeof current === 'string' && current.includes(placeholder)) {
        cell.value = current.replace(placeholder, row.param_value);
      } else if (current == null || current === '') {
        cell.value = row.param_value;
      } else {
        cell.value = row.param_value;
      }
    }
  });

  ensureDir('./output');
  const tempExcelPath = path.join('./output', `__temp_${Date.now()}_${cacheKey}.xlsx`);
  await workbook.xlsx.writeFile(tempExcelPath);

  const SOFFICE = process.env.SOFFICE_PATH || 'C:/Program Files/LibreOffice/program/soffice.exe';
  execFile(SOFFICE, ['--headless', '--convert-to', 'pdf', tempExcelPath, '--outdir', CACHE_DIR], (error) => {
    safeUnlink(tempExcelPath);
    if (error) {
      console.error('PDF conversion error:', error);
      return res.status(500).json({ error: 'PDF conversion failed' });
    }
    const generatedPdfPath = path.join(CACHE_DIR, path.basename(tempExcelPath).replace(/\.xlsx$/, '.pdf'));
    if (!fs.existsSync(generatedPdfPath)) return res.status(500).json({ error: 'Generated PDF not found' });
    fs.renameSync(generatedPdfPath, pdfPath);
    return res.sendFile(pdfPath);
  });
}));

module.exports = router;
