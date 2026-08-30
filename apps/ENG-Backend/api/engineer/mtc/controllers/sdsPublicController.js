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
 *                          [&lot=<LOT_NO>]
 *
 * `lot` is OPTIONAL and was added 2026-08-25 without a version bump: this route ignores query
 * parameters it does not know, so every existing link keeps working byte for byte and the
 * caller can adopt it whenever it is ready.
 *
 *   lot — the production lot the sheet is being printed for, e.g. 'C14781'. It is
 *         `lpb.pc_lot.lot_no` verbatim, no conversion. Send it if you have it: this side
 *         CANNOT derive it, because one Setup Data Sheet serves a (CN, machine, process) and
 *         therefore many lots (C31-04050 at 1041 has 28), and even within a ±15-day window
 *         only 67 % of (CN, process) pairs resolve to a single one. What we DO is verify it
 *         against the plan and record the verdict. A lot that does not match is not refused —
 *         the sheet still prints and the row is flagged `lot_verified = false`, because the
 *         plan can lag the floor and blocking a print to protect a log stops real work.
 *
 * Every produced PDF is recorded in `sds_print_log` (services/sdsPrintLog.js) with the part
 * number resolved from the plan, the fixture list as rendered, and a SHA-256 of the bytes.
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
 * Companions, both for the caller to validate against before building a link:
 *   GET /api/public/sds/machines?key=<SECRET>
 *       every usable machine_code with the SDS machine it resolves to.
 *   GET /api/public/sds/lots?cn=<CN>&process_code=<PC>&key=<SECRET>
 *       the lots the production plan holds for that CN, so `lot` is picked, never typed.
 */

const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const headless = require('./sdsV2HeadlessController');
const cnFormat = require('../utils/cnFormat');
const sdsPrintLog = require('../services/sdsPrintLog');

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
// Resolution priority (mirrors buildMachineResolver elsewhere): the local override table
// sds_machine_code wins, THEN rodpc.m_setup_datasheet, THEN the raw value. The override must
// come first because the factory floor-code tables go stale — e.g. m_setup_datasheet still
// maps VSG-02 → 'TSG300W' (the old machine) even though VSG-02 is now HAMAI 5B; without the
// override-first lookup this public link renders the wrong (TSG-300W) Setup Data Sheet.
// (sheet_name is intentionally not used — machine_name is the SSOT identifier.)
async function resolveMachineTypeName(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const candidates = [];
  try {
    const o = await engPool.query(
      `SELECT machine_name FROM sds_machine_code
        WHERE machine_code = $1 AND machine_name IS NOT NULL AND TRIM(machine_name) <> '' LIMIT 1`,
      [v]
    );
    const oname = o.rows[0]?.machine_name && o.rows[0].machine_name.trim();
    if (oname) candidates.push(oname);         // local override (sds_machine_code) wins
  } catch (_) { /* override table optional — fall back to factory + direct match */ }
  try {
    const r = await rodpcPool.query(
      `SELECT machine_name FROM rodpc.m_setup_datasheet
        WHERE machine_code = $1 AND machine_name IS NOT NULL AND TRIM(machine_name) <> '' LIMIT 1`,
      [v]
    );
    const name = r.rows[0]?.machine_name && r.rows[0].machine_name.trim();
    if (name) candidates.push(name);          // then factory m_setup_datasheet machine_name
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

  // Accept either the 6-digit item number (e.g. 310368) or a control number (C31-00368) — the
  // calling team's links use the plain 6-digit form. Normalize to the canonical control-no here
  // (the public-link boundary) so it works regardless of the downstream search version.
  const cnRaw = String(req.query.cn || '').trim();
  const cn = cnFormat.toControlNo(cnRaw) || cnRaw;
  const process_code = String(req.query.process_code || '').trim();
  if (!cnRaw) return res.status(400).json({ error: 'cn is required' });

  // OPTIONAL, and optional on purpose. `lot` is the caller's own data — Ball_Grinding_Plan
  // holds it by definition, and nothing on this side can derive it: one SDS serves a
  // (CN, machine, process) and therefore many lots (C31-04050 @1041 has 28), so a guess
  // would be wrong about a third of the time. A link without it keeps working exactly as
  // before and simply logs no lot; a link with it gets the lot verified against
  // lpb.pc_lot_process.
  const lot = String(req.query.lot || '').trim();

  try {
    // machine_type_name wins if given; otherwise resolve the machine code / WC / group.
    const machine_type_name =
      String(req.query.machine_type_name || '').trim() ||
      await resolveMachineTypeName(req.query.machine);
    if (!machine_type_name) {
      return res.status(400).json({ error: `Unknown machine: ${req.query.machine ?? '(none)'}` });
    }

    // The public link always resolves a SPECIFIC factory floor code (e.g. SPG-03 → KS-400B1),
    // so label the sheet with that specific machine — NOT the shared machine_group
    // ('KS-400B1/B2/B7'). Passing display_name explicitly mirrors the in-app picker, which for a
    // split group (multiple visible members) shows the per-machine name. Without it buildValueMap
    // falls back to machine_group and the header wrongly prints all sibling machines. Config
    // lookups still key off machine_type_name, so this only changes the printed label.
    const _meta = {};
    const html = await headless.buildGridHtmlForRequest({
      cn, machine_type_name, process_code: process_code || null, display_name: machine_type_name, _meta,
    });
    const pdfBuffer = await headless.renderPdf(html, {
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SDS_${cn}_${machine_type_name}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);

    // Evidentiary record, AFTER the response. A lot that does not match the plan is
    // recorded with lot_verified = false rather than refused: the plan can lag the floor,
    // and blocking a print would stop real work to protect a log. The flag makes the
    // doubtful rows findable later, which is what evidence needs.
    // `source: 'public'` is the whole attribution — this route has exactly one caller, so a
    // per-caller field would only ever hold one value.
    sdsPrintLog.record({
      cn, machineTypeName: machine_type_name, processCode: process_code, lot,
      // The floor code the caller named, kept verbatim — `machine_type_name` cannot be
      // narrowed back to it (KS-400B1 covers nine machines).
      machineCode: String(req.query.machine || '').trim() || null,
      source: 'public', pdfBuffer, tooling: _meta.tooling, req,
    });
  } catch (err) {
    res.status(500).json({ error: `SDS PDF render failed: ${err.message}` });
  }
});

/** GET /api/public/sds/lots?cn=<CN>&process_code=<PC>&key=<SECRET>
 *  The lots the production plan holds for a CN, so the calling team can populate its own
 *  picker and send a `lot` it knows is real — the same role /sds/machines already plays
 *  for machine codes. `cn` takes the 6-digit item number or a control number.
 *  `process_code` is optional but strongly recommended: a lot belongs to a
 *  (control_no, process) pair, so without it the list spans every process the CN runs.
 */
router.get('/sds/lots', async (req, res) => {
  const expected = process.env.SDS_PDF_LINK_KEY;
  if (!expected) return res.status(503).json({ error: 'Public SDS PDF link is not configured' });
  if (String(req.query.key || '') !== expected) return res.status(401).json({ error: 'Invalid key' });

  const cn = String(req.query.cn || '').trim();
  if (!cn) return res.status(400).json({ error: 'cn is required' });

  try {
    const lots = await sdsPrintLog.listLots({
      cn,
      processCode: String(req.query.process_code || '').trim() || null,
      limit: req.query.limit,
    });
    res.json({ cn, process_code: String(req.query.process_code || '').trim() || null, count: lots.length, lots });
  } catch (err) {
    res.status(500).json({ error: `Lot lookup failed: ${err.message}` });
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
