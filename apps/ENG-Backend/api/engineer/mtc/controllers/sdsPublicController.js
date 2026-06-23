'use strict';
/**
 * PUBLIC cross-system SDS PDF link.
 *
 * Lets another team's app (e.g. Ball_Grinding_Plan at plb018) deep-link straight to a
 * Setup Data Sheet PDF — the same output as clicking "Generate SDS PDF" in SdsV2Page —
 * WITHOUT a user login. Mounted under /api/public/* which the global auth middleware
 * (server.js) whitelists, so verifyToken does NOT run here. Access is instead gated by a
 * shared secret in `SDS_PDF_LINK_KEY` (mirrors the EXTERNAL_JOB_CHECK_API_KEY pattern).
 *
 *   GET /api/public/sds/pdf?cn=<CN>&machine=<IDG-09|SPG-01|VSG-02|NAME>&process_code=<PC>&key=<SECRET>
 *
 * `machine` accepts the factory machine_code (the other team's floor code, e.g. 'IDG-09',
 * 'SPG-01', 'VSG-02'). It is resolved via rodpc.m_setup_datasheet.machine_code →
 * machine_name (the SDS-scoped machine list — machine_name IS the machine_type_name),
 * then matched against sds_machine_type_code. A machine_type_name / code / group passed
 * directly is also accepted (takes precedence over the code lookup).
 *
 * Returns the PDF inline (Content-Disposition inline) so a browser tab shows it like the
 * in-app button. No token ever appears in the URL.
 *
 * Companion: GET /api/public/sds/machines?key=<SECRET> — JSON list of every usable
 * machine_code (with the SDS machine it resolves to) for the caller to validate against.
 */

const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const headless = require('./sdsV2HeadlessController');

const router = express.Router();

// Match an sds_machine_type_code by name → code → group (active rows only). The factory
// tables sometimes store hyphen-less names (e.g. 'TSG300W') while SDS uses the canonical
// hyphenated name ('TSG-300W' — the project's machine-name hyphen convention), so a
// hyphen/space-insensitive comparison is included as a lower-priority fallback.
async function sdsMachineByAny(value) {
  const norm = value.toUpperCase().replace(/[-\s]/g, '');
  const r = await engPool.query(
    `SELECT machine_type_name FROM sds_machine_type_code
      WHERE is_active AND machine_type_name IS NOT NULL
        AND ( machine_type_name ILIKE $1 OR machine_type_code = $1 OR machine_group ILIKE $1
           OR UPPER(REPLACE(REPLACE(machine_type_name, '-', ''), ' ', '')) = $2
           OR UPPER(REPLACE(REPLACE(machine_group,     '-', ''), ' ', '')) = $2 )
      ORDER BY (machine_type_name ILIKE $1) DESC, (machine_type_code = $1) DESC,
               (machine_group ILIKE $1) DESC,
               (UPPER(REPLACE(REPLACE(machine_type_name, '-', ''), ' ', '')) = $2) DESC
      LIMIT 1`,
    [value, norm]
  );
  return r.rows[0]?.machine_type_name || null;
}

// Resolve whatever the caller sent as "machine" to a real sds_machine_type_code.machine_type_name.
// m_setup_datasheet is the SDS-scoped machine list (machine_code → machine_name, where
// machine_name = the machine_type_name). Look the code up there first, then match the
// resolved machine_name (or the raw value) against the SDS machine types. Returns null on
// no match. (sheet_name is intentionally not used — machine_name is the SSOT identifier.)
async function resolveMachineTypeName(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const candidates = [];
  try {
    const r = await rodpcPool.query(
      `SELECT machine_name FROM rodpc.m_setup_datasheet
        WHERE machine_code = $1 AND machine_name IS NOT NULL AND TRIM(machine_name) <> '' LIMIT 1`,
      [v]
    );
    const name = r.rows[0]?.machine_name && r.rows[0].machine_name.trim();
    if (name) candidates.push(name);          // m_setup_datasheet machine_name wins
  } catch (_) { /* factory DB optional — fall back to direct SDS match */ }
  candidates.push(v);                          // also accept a name/code/group passed directly

  for (const c of candidates) {
    const name = await sdsMachineByAny(c);
    if (name) return name;
  }
  return null;
}

/** GET /api/public/sds/pdf */
router.get('/sds/pdf', async (req, res) => {
  const expected = process.env.SDS_PDF_LINK_KEY;
  // Fail closed: if no key is configured the endpoint stays locked rather than open.
  if (!expected) return res.status(503).json({ error: 'Public SDS PDF link is not configured' });
  if (String(req.query.key || '') !== expected) return res.status(401).json({ error: 'Invalid key' });

  const cn = String(req.query.cn || '').trim();
  const process_code = String(req.query.process_code || '').trim();
  if (!cn) return res.status(400).json({ error: 'cn is required' });

  try {
    // machine_type_name wins if given; otherwise resolve the machine code / WC / group.
    const machine_type_name =
      String(req.query.machine_type_name || '').trim() ||
      await resolveMachineTypeName(req.query.machine);
    if (!machine_type_name) {
      return res.status(400).json({ error: `Unknown machine: ${req.query.machine ?? '(none)'}` });
    }

    const html = await headless.buildGridHtmlForRequest({
      cn, machine_type_name, process_code: process_code || null, display_name: null,
    });
    const pdfBuffer = await headless.renderPdf(html, {
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SDS_${cn}_${machine_type_name}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: `SDS PDF render failed: ${err.message}` });
  }
});

/** GET /api/public/sds/machines?key=<SECRET>
 *  Lets the calling team validate which machine_codes it can use. Returns every
 *  m_setup_datasheet machine_code with the SDS machine it resolves to (null when it
 *  doesn't), plus has_sheet, so they can build their own dropdown / pre-flight check.
 */
router.get('/sds/machines', async (req, res) => {
  const expected = process.env.SDS_PDF_LINK_KEY;
  if (!expected) return res.status(503).json({ error: 'Public SDS PDF link is not configured' });
  if (String(req.query.key || '') !== expected) return res.status(401).json({ error: 'Invalid key' });

  try {
    const rows = (await rodpcPool.query(
      `SELECT machine_code, machine_name, sheet_name FROM rodpc.m_setup_datasheet
        WHERE machine_code IS NOT NULL AND TRIM(machine_code) <> '' ORDER BY machine_code`
    )).rows;

    const machines = [];
    for (const r of rows) {
      // Use the same resolver as the PDF endpoint so the list reflects real behaviour.
      const machine_type_name = await resolveMachineTypeName(r.machine_code);
      machines.push({
        machine_code: r.machine_code.trim(),
        machine_name: (r.machine_name || '').trim() || null,
        machine_type_name,                                  // null = not usable yet
        resolvable: !!machine_type_name,
        has_sheet: !!(r.sheet_name && r.sheet_name.trim()),
      });
    }
    res.json({
      count: machines.length,
      resolvable: machines.filter(m => m.resolvable).length,
      machines,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
