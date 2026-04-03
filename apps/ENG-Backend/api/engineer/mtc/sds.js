const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { engPool } = require('../../../instance/eng_db');
const puppeteer = require('puppeteer');
const XLSX = require('xlsx');

const router = express.Router();

const TEMPLATE_DIR = path.resolve(process.env.SDS_TEMPLATE_DIR || './template');
const CACHE_DIR = path.resolve('./output/pdf-cache');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { if (fs.existsSync(p)) fs.unlinkSync(p); }

function buildPdfCacheKey(h, templatePath) {
  const mtime = fs.statSync(templatePath).mtimeMs;
  return (`${h.cn}_${h.process_code}_${h.machine}_DOC-${h.setup_data_sheet_rev}_${mtime}`)
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
 * GET /api/sds/counts
 */
router.get('/counts', async (_req, res) => {
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
  try {
      const result = await engPool.query(COUNTS_SQL);
      const total = result.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);
      res.json({ counts: result.rows, total });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sds/search
 */
router.post('/search', async (req, res) => {
  const { searchTerm } = req.body;
  if (!searchTerm?.trim()) return res.status(400).json({ error: 'searchTerm is required' });

  try {
      const result = await engPool.query(
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
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/pdf
 */
router.get('/pdf', async (req, res) => {
  const { cn, process_code, machine } = req.query;
  if (!cn || !process_code || !machine) {
    return res.status(400).json({ error: 'cn, process_code and machine are required' });
  }

  try {
      const setupResult = await engPool.query(
        `SELECT ss.id, ss.cn, ss.process_code, ss.machine, ss.setup_data_sheet_rev
         FROM setup_sheet ss WHERE ss.cn=$1 AND ss.process_code=$2 AND ss.machine=$3`,
        [cn, process_code, machine]
      );
    
      if (setupResult.rows.length === 0) return res.status(404).json({ error: 'Setup sheet not found' });
      const setup = setupResult.rows[0];

      const tplResult = await engPool.query(
        `SELECT t.excel_file_name FROM setup_sheet ss JOIN template t ON ss.template_id = t.id WHERE ss.id=$1`,
        [setup.id]
      );
      const excelFileName = tplResult.rows[0]?.excel_file_name;
      if (!excelFileName) return res.status(500).json({ error: 'Excel template not defined' });
    
      const templatePath = path.join(TEMPLATE_DIR, excelFileName);
      if (!fs.existsSync(templatePath)) return res.status(500).json({ error: 'Template file not found' });
    
      ensureDir(CACHE_DIR);
      const cacheKey = buildPdfCacheKey(setup, templatePath);
      const pdfPath = path.join(CACHE_DIR, `${cacheKey}.pdf`);
    
      if (fs.existsSync(pdfPath)) return res.sendFile(pdfPath);
    
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
    
      const mappingResult = await engPool.query(
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
          } else {
            cell.value = row.param_value;
          }
        }
      });
    
      ensureDir('./output');
      const tempExcelPath = path.join('./output', `__temp_${Date.now()}_${cacheKey}.xlsx`);
      await workbook.xlsx.writeFile(tempExcelPath);
    
      const SOFFICE = path.resolve('./tools/LibreOfficePortable/App/libreoffice/program/soffice.exe');
      execFile(SOFFICE, ['--headless', '--convert-to', 'pdf', tempExcelPath, '--outdir', CACHE_DIR], (error) => {
        safeUnlink(tempExcelPath);
        if (error) {
          return res.status(500).json({ error: 'PDF conversion failed' });
        }
        const generatedPdfPath = path.join(CACHE_DIR, path.basename(tempExcelPath).replace(/\.xlsx$/, '.pdf'));
        if (!fs.existsSync(generatedPdfPath)) return res.status(500).json({ error: 'Generated PDF not found' });
        fs.renameSync(generatedPdfPath, pdfPath);
        return res.sendFile(pdfPath);
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/test-puppeteer
 * Test PDF generation using Puppeteer and SheetJS (No LibreOffice needed)
 */
router.get('/test-puppeteer', async (req, res) => {
  try {
    const templatePath = path.join(TEMPLATE_DIR, 'KS03A.xlsx');
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template KS03A.xlsx not found' });

    // 1. Read Excel using SheetJS
    const workbook = XLSX.readFile(templatePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 2. Convert to HTML Table
    const htmlTable = XLSX.utils.sheet_to_html(worksheet);

    // 3. Simple HTML Wrapper with some basic styling to look like Excel
    const fullHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Tahoma', sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; }
            td { border: 1px solid #ccc; padding: 4px; font-size: 12px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h2 style="text-align: center;">MTC Setup Data Sheet (Puppeteer Test)</h2>
          <p>This PDF was generated without LibreOffice.</p>
          <hr/>
          ${htmlTable}
        </body>
      </html>
    `;

    // 4. Launch Puppeteer to generate PDF
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0.5cm', right: '0.5cm', bottom: '0.5cm', left: '0.5cm' }
    });

    await browser.close();

    // 5. Send PDF to browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=test.pdf');
    res.write(pdfBuffer, 'binary');
    res.end();

  } catch (err) {
    console.error("Puppeteer Test Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manage Templates & Mappings
 */
router.get('/templates', async (req, res) => {
    try {
        const result = await engPool.query('SELECT * FROM template ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/template', async (req, res) => {
    const { template_name, excel_file_name } = req.body;
    try {
        const result = await engPool.query(
            'INSERT INTO template (template_name, excel_file_name) VALUES ($1, $2) RETURNING *',
            [template_name, excel_file_name]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mapping/:templateId', async (req, res) => {
    try {
        const result = await engPool.query(
            'SELECT * FROM template_excel_mapping WHERE template_id = $1 ORDER BY id',
            [req.params.templateId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/mapping', async (req, res) => {
    const { template_id, sheet_name, cell_address, param_key } = req.body;
    try {
        const result = await engPool.query(
            'INSERT INTO template_excel_mapping (template_id, sheet_name, cell_address, param_key) VALUES ($1, $2, $3, $4) RETURNING *',
            [template_id, sheet_name, cell_address, param_key]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/mapping/:id', async (req, res) => {
    try {
        await engPool.query('DELETE FROM template_excel_mapping WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/template/:id', async (req, res) => {
    const { template_name, excel_file_name } = req.body;
    try {
        const result = await engPool.query(
            'UPDATE template SET template_name = $1, excel_file_name = $2 WHERE id = $3 RETURNING *',
            [template_name, excel_file_name, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
