'use strict';

/**
 * SDS print log — the single place that records a produced SDS PDF.
 * ------------------------------------------------------------------------------
 * Both PDF paths call `record()`:
 *
 *   in-app   GET /api/sds/v2-headless/pdf-chrome/grid   (JWT)        source 'app'
 *   deep-link GET /api/public/sds/pdf                   (shared key) source 'public'
 *
 * Design rules that are easy to undo by accident:
 *
 *   • **A logging failure must never fail a print.** `record()` catches everything and
 *     returns null. The PDF is the user's job; the log is ours.
 *   • **The lot is never guessed.** An SDS serves a (CN, machine, process), and one
 *     sheet covers many lots — C31-04050 @1041 has 28. Even within ±15 days only
 *     67.4 % of (CN, process) pairs have exactly one lot, so inferring it would be
 *     wrong a third of the time and a wrong lot is worse than no lot. The caller
 *     supplies it; we verify it and store the verdict in `lot_verified`.
 *   • **parts_no comes from the plan, not from us.** `lpb.eng_item` has it for
 *     essentially every C/N; `tooling_spec_process.pn` has it for 13.7 %.
 *
 * `lpb.pc_lot.control_no` is the 6-digit ITEM number and may carry a variant suffix
 * (`350528-C`), while `lpb.eng_item.control_no` is the CONTROL number (`C31-04050`).
 * Both forms are derived here so callers can pass either.
 */

const crypto = require('crypto');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const cnFormat = require('../utils/cnFormat');

const TABLE = 'sds_print_log';

/**
 * Caller address, preferring X-Forwarded-For when something upstream sets it.
 *
 * `server.js` sets no `trust proxy` and `nginx.conf` does not forward XFF, and production
 * calls :2005 directly anyway — so today this is the socket address. The header is read
 * first so that adding a proxy later does not silently turn every row into the proxy's
 * own address. IPv4-mapped IPv6 (`::ffff:10.1.2.3`) is unwrapped: it is the same machine
 * written two ways, and two spellings of one host would split every report by address.
 */
function clientIp(req) {
  if (!req) return null;
  const xff = req.headers && req.headers['x-forwarded-for'];
  const raw = (typeof xff === 'string' && xff.split(',')[0].trim())
    || (req.socket && req.socket.remoteAddress)
    || req.ip
    || '';
  const ip = String(raw).replace(/^::ffff:/i, '').trim();
  return ip ? ip.slice(0, 64) : null;
}

// Reverse DNS is a network round trip, and the log runs after the response is already
// sent — but it is still per-print, and the same few machines call over and over. Cached
// for an hour, with a hard timeout, because an internal host with no PTR record makes the
// resolver wait rather than fail fast. A miss is cached too: re-asking DNS every print for
// a name that does not exist is the expensive case, not the rare one.
const HOST_TTL_MS = 60 * 60 * 1000;
const HOST_TIMEOUT_MS = 700;
const _hostCache = new Map();

async function clientHost(ip) {
  if (!ip) return null;
  const hit = _hostCache.get(ip);
  if (hit && Date.now() - hit.at < HOST_TTL_MS) return hit.name;

  let name = null;
  try {
    const dns = require('dns').promises;
    name = await Promise.race([
      dns.reverse(ip).then((names) => (names && names[0]) || null),
      new Promise((resolve) => setTimeout(() => resolve(null), HOST_TIMEOUT_MS)),
    ]);
  } catch (_) {
    name = null;                       // NXDOMAIN / no PTR / resolver down — all "unknown"
  }
  // Keep the short name: `plb018.lb.minebea.local` reads as `plb018` to everyone here,
  // and the domain is the same on every row.
  if (name) name = String(name).split('.')[0].slice(0, 128);
  _hostCache.set(ip, { name, at: Date.now() });
  return name;
}

/** Both key forms for one CN, whichever way it was written. */
function cnForms(raw) {
  const s = String(raw || '').trim();
  if (!s) return { control: null, item: null };
  return {
    control: cnFormat.toControlNo(s) || s,
    item: cnFormat.toItemNo(s) || s,
  };
}

/**
 * Part number / name from the production plan. Returns {} when the CN is unknown
 * there — a print is still logged, just without the part fields.
 */
async function resolvePartInfo(cn) {
  const { control } = cnForms(cn);
  if (!control) return {};
  try {
    const { rows } = await maqPool.query(
      `SELECT parts_no, parts_name FROM lpb.eng_item WHERE control_no = $1 LIMIT 1`,
      [control]);
    return rows[0] || {};
  } catch (e) {
    console.warn(`[sds-print-log] parts lookup failed for ${control}: ${e.message}`);
    return {};
  }
}

/**
 * Lots the plan holds for this CN (optionally narrowed to one process), newest
 * planned-completion first. This is what the calling team populates a picker from —
 * the same role `/api/public/sds/machines` already plays for machine codes.
 */
async function listLots({ cn, processCode, limit = 50 }) {
  const { item } = cnForms(cn);
  if (!item) return [];
  const params = [item, `${item}-%`];
  let procFilter = '';
  if (processCode) { params.push(String(processCode).trim()); procFilter = `AND p.process = $3`; }
  const { rows } = await maqPool.query(
    `SELECT DISTINCT p.lot_no, p.process, p.proc_name,
            l.comp_plan_date, l.comp_date, l.req_qty
       FROM lpb.pc_lot_process p
       JOIN lpb.pc_lot l
         ON l.lot_no = p.lot_no AND l.control_no = p.control_no
      WHERE (p.control_no = $1 OR p.control_no LIKE $2) ${procFilter}
      ORDER BY l.comp_plan_date DESC NULLS LAST
      LIMIT ${Math.min(Number(limit) || 50, 500)}`,
    params);
  return rows;
}

/**
 * Does this lot exist in the plan for this CN (and process, when given)?
 * @returns {Promise<boolean|null>} null when no lot was supplied — "not checked",
 *          which is a different fact from "checked and not found".
 */
async function verifyLot({ cn, processCode, lot }) {
  const l = String(lot || '').trim();
  if (!l) return null;
  const { item } = cnForms(cn);
  if (!item) return false;
  try {
    const params = [item, `${item}-%`, l];
    let procFilter = '';
    if (processCode) { params.push(String(processCode).trim()); procFilter = `AND p.process = $4`; }
    const { rows } = await maqPool.query(
      `SELECT 1 FROM lpb.pc_lot_process p
        WHERE (p.control_no = $1 OR p.control_no LIKE $2)
          AND p.lot_no = $3 ${procFilter}
        LIMIT 1`,
      params);
    return rows.length > 0;
  } catch (e) {
    console.warn(`[sds-print-log] lot verify failed for ${item}/${l}: ${e.message}`);
    return false;
  }
}

/**
 * Record one produced PDF. Never throws.
 *
 * @param {object}  a
 * @param {string}  a.cn                 CN in either form
 * @param {string}  a.machineTypeName
 * @param {string=} a.machineCode        factory floor code as sent (e.g. CGM-10); not derivable back
 * @param {string=} a.processCode
 * @param {string=} a.lot                as supplied by the caller; not guessed
 * @param {'app'|'public'} a.source
 * @param {string=} a.requestedBy
 * @param {Buffer=} a.pdfBuffer          hashed, not stored
 * @param {Array=}  a.tooling            valueMap.tooling — the T01..Tn slots as rendered
 * @param {object=} a.req                the Express request, for caller address/hostname
 * @returns {Promise<object|null>} the inserted row, or null if logging failed
 */
async function record({
  cn, machineTypeName, machineCode, processCode, lot, source, requestedBy, pdfBuffer, tooling, req,
}) {
  try {
    const { control, item } = cnForms(cn);
    if (!control || !machineTypeName) return null;

    const ip = clientIp(req);
    const [part, lotVerified, host] = await Promise.all([
      resolvePartInfo(control),
      verifyLot({ cn: control, processCode, lot }),
      clientHost(ip),
    ]);

    const sha = pdfBuffer ? crypto.createHash('sha256').update(pdfBuffer).digest('hex') : null;

    // Keep only the slots that actually carry a fixture — a blank sheet should not
    // store 20 empty objects.
    const snapshot = Array.isArray(tooling)
      ? tooling.filter((t) => t && (t.name || t.dwg))
          .map((t) => ({ slot: t.slot, name: t.name, dwg: t.dwg }))
      : null;

    const proc = String(processCode || '').trim() || null;
    const bytes = pdfBuffer ? pdfBuffer.length : null;

    // One deep-link open re-fetches the PDF — Chrome's inline viewer issues the
    // request twice and `Cache-Control: no-store` re-renders each time — so the
    // public path logged every print twice, ~1.5 s apart: same CN/machine/process,
    // different sha because each render's bytes carry a fresh timestamp. Collapse a
    // repeat of the same (cn, machine, process, source) at the same byte length
    // inside a 20 s window. A genuine reprint on another day differs in lot, tooling
    // or byte count and is never in this window; `pdf_sha256` still proves drift
    // between real prints, which is the point of the table.
    const dup = await engPool.query(
      `SELECT id FROM ${TABLE}
        WHERE cn = $1 AND machine_type_name = $2
          AND process_code IS NOT DISTINCT FROM $3
          AND source = $4
          AND pdf_bytes IS NOT DISTINCT FROM $5
          AND printed_at > now() - interval '20 seconds'
        LIMIT 1`,
      [control, String(machineTypeName).trim(), proc, source, bytes]);
    if (dup.rows.length) {
      console.log(`[sds-print-log] skip re-fetch ${control} ${machineTypeName}` +
                  `${proc ? ` p${proc}` : ''} via ${source} (dup of #${dup.rows[0].id})`);
      return null;
    }

    const { rows } = await engPool.query(
      `INSERT INTO ${TABLE}
         (cn, item_no, parts_no, parts_name, lot_no, lot_verified,
          machine_type_name, machine_code, process_code, source, requested_by,
          pdf_sha256, pdf_bytes, tooling_snapshot, client_ip, client_host)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, printed_at`,
      [
        control,
        item,
        part.parts_no || null,
        part.parts_name || null,
        String(lot || '').trim() || null,
        lotVerified,
        String(machineTypeName).trim(),
        String(machineCode || '').trim() || null,
        proc,
        source,
        String(requestedBy || '').trim() || null,
        sha,
        bytes,
        snapshot ? JSON.stringify(snapshot) : null,
        ip,
        host,
      ]);

    const flag = lotVerified === false ? ' lot=UNVERIFIED' : '';
    const from = host || ip ? ` from ${host || ip}` : '';
    const mc = String(machineCode || '').trim();
    console.log(`[sds-print-log] #${rows[0].id} ${control} ${machineTypeName}${mc ? `(${mc})` : ''}` +
                `${processCode ? ` p${processCode}` : ''}${lot ? ` lot=${lot}` : ''}` +
                `${flag} via ${source}${from}`);
    return rows[0];
  } catch (e) {
    // Deliberately swallowed — a print must never fail because of its own audit row.
    console.error(`[sds-print-log] record failed: ${e.message}`);
    return null;
  }
}

module.exports = { record, verifyLot, listLots, resolvePartInfo, cnForms, clientIp, clientHost };
