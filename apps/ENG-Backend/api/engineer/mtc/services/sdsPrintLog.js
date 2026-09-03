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
 * @param {string=} a.processCode
 * @param {string=} a.lot                as supplied by the caller; not guessed
 * @param {'app'|'public'} a.source
 * @param {string=} a.requestedBy
 * @param {Buffer=} a.pdfBuffer          hashed, not stored
 * @param {Array=}  a.tooling            valueMap.tooling — the T01..Tn slots as rendered
 * @returns {Promise<object|null>} the inserted row, or null if logging failed
 */
async function record({
  cn, machineTypeName, processCode, lot, source, requestedBy, pdfBuffer, tooling,
}) {
  try {
    const { control, item } = cnForms(cn);
    if (!control || !machineTypeName) return null;

    const [part, lotVerified] = await Promise.all([
      resolvePartInfo(control),
      verifyLot({ cn: control, processCode, lot }),
    ]);

    const sha = pdfBuffer ? crypto.createHash('sha256').update(pdfBuffer).digest('hex') : null;

    // Keep only the slots that actually carry a fixture — a blank sheet should not
    // store 20 empty objects.
    const snapshot = Array.isArray(tooling)
      ? tooling.filter((t) => t && (t.name || t.dwg))
          .map((t) => ({ slot: t.slot, name: t.name, dwg: t.dwg }))
      : null;

    const { rows } = await engPool.query(
      `INSERT INTO ${TABLE}
         (cn, item_no, parts_no, parts_name, lot_no, lot_verified,
          machine_type_name, process_code, source, requested_by,
          pdf_sha256, pdf_bytes, tooling_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, printed_at`,
      [
        control,
        item,
        part.parts_no || null,
        part.parts_name || null,
        String(lot || '').trim() || null,
        lotVerified,
        String(machineTypeName).trim(),
        String(processCode || '').trim() || null,
        source,
        String(requestedBy || '').trim() || null,
        sha,
        pdfBuffer ? pdfBuffer.length : null,
        snapshot ? JSON.stringify(snapshot) : null,
      ]);

    const flag = lotVerified === false ? ' lot=UNVERIFIED' : '';
    console.log(`[sds-print-log] #${rows[0].id} ${control} ${machineTypeName}` +
                `${processCode ? ` p${processCode}` : ''}${lot ? ` lot=${lot}` : ''}` +
                `${flag} via ${source}`);
    return rows[0];
  } catch (e) {
    // Deliberately swallowed — a print must never fail because of its own audit row.
    console.error(`[sds-print-log] record failed: ${e.message}`);
    return null;
  }
}

module.exports = { record, verifyLot, listLots, resolvePartInfo, cnForms };
