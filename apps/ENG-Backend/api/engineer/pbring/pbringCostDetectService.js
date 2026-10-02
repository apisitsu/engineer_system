'use strict';

/**
 * Detect a cost update for a tooling row that has none yet, by matching its
 * `tool_code` (not `po_no` — see `toolCodeMatch.js`'s header) against
 * `lpb.pc_material_purchase.spec1`. This is the "auto-detect" half of the
 * dual cost-input design; the other half is the plain manual edit in
 * `pbringCostService.js`. A detected match never writes `pbring_tooling`
 * directly — it lands in `pbring_cost_pending` and waits for a listed
 * `pbring_approver` to approve or reject it (see `approvePending`/`rejectPending`).
 *
 * Deliberately NOT a cron job — run on demand via `POST /cost/detect` (see
 * `.claude` plan: "no cron, lazy on-demand" is the house rule here). A full
 * scan (~1,600 tool codes × ~97,000 purchase rows, both pulled into memory
 * once) runs in well under a second; there is no need for a persisted cache.
 */

const { engPool } = require('../../../instance/eng_db');
const { maqPool } = require('../../../instance/maq_db');
const { TABLES, COST_PENDING_STATUS } = require('./pbringConstants');
const { parseCodes, bestTier } = require('./toolCodeMatch');
const { PbringError } = require('./pbringCostService');

const isUnused = (r) => String(r.tool_code || '').trim().toUpperCase() === 'UNUSED';

/**
 * Scan every tooling row with no PO yet against the live purchase table.
 * Only tier 1-2 matches (exact code, or code-only with no Rev on one side —
 * see `toolCodeMatch.js`) are trusted enough to raise a pending row; tier 3
 * (Rev disagrees) and 5 (no match) are left alone rather than guessed at.
 */
async function detectMissingCost() {
  const { rows: candidates } = await engPool.query(
    `SELECT id, tool_code FROM ${TABLES.TOOLING}
      WHERE (po_no IS NULL OR po_no = '') AND tool_code IS NOT NULL AND tool_code <> ''`
  );
  const toCheck = candidates.filter((r) => !isUnused(r));
  if (!toCheck.length) return { checked: 0, detected: 0 };

  const { rows: purchases } = await maqPool.query(
    `SELECT po_no, spec1, po_unit_price, po_qty, po_amount, comp_date
       FROM lpb.pc_material_purchase WHERE spec1 IS NOT NULL AND spec1 <> ''`
  );
  const byKey = new Map();
  for (const p of purchases) {
    for (const [k] of parseCodes(p.spec1)) {
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(p);
    }
  }

  const detections = [];
  for (const r of toCheck) {
    const ourCodes = parseCodes(r.tool_code);
    if (!ourCodes.length) continue;
    const candidatesForRow = new Set();
    for (const [k] of ourCodes) (byKey.get(k) || []).forEach((p) => candidatesForRow.add(p));
    if (!candidatesForRow.size) continue;
    let best = { tier: 5, row: null };
    for (const p of candidatesForRow) {
      const tier = bestTier(ourCodes, parseCodes(p.spec1));
      if (tier < best.tier) best = { tier, row: p };
    }
    if (best.tier <= 2) {
      detections.push([
        r.id, 'maqdb', best.row.po_no,
        best.row.po_unit_price ?? null, best.row.po_qty ?? null, best.row.comp_date ?? null,
      ]);
    }
  }
  if (!detections.length) return { checked: toCheck.length, detected: 0 };

  const placeholders = detections.map((_, ri) =>
    `($${ri * 6 + 1}, $${ri * 6 + 2}, $${ri * 6 + 3}, $${ri * 6 + 4}, $${ri * 6 + 5}, $${ri * 6 + 6}, 'pending')`).join(',');
  await engPool.query(
    `INSERT INTO ${TABLES.COST_PENDING}
       (tooling_id, source, detected_po_no, detected_price, detected_qty, detected_receive_date, status)
     VALUES ${placeholders}
     ON CONFLICT (tooling_id) WHERE status = 'pending' DO UPDATE SET
       detected_po_no = EXCLUDED.detected_po_no, detected_price = EXCLUDED.detected_price,
       detected_qty = EXCLUDED.detected_qty, detected_receive_date = EXCLUDED.detected_receive_date,
       detected_at = now()`,
    detections.flat()
  );
  return { checked: toCheck.length, detected: detections.length };
}

/** Pending rows, joined with enough tooling context to show them. */
async function listPending(status = 'pending') {
  if (!COST_PENDING_STATUS.includes(status)) throw new PbringError(400, `status must be one of: ${COST_PENDING_STATUS.join(', ')}`);
  const { rows } = await engPool.query(
    `SELECT cp.*, t.part_group, t.part_no, t.tooling_item, t.tool_code, t.cn
       FROM ${TABLES.COST_PENDING} cp JOIN ${TABLES.TOOLING} t ON t.id = cp.tooling_id
      WHERE cp.status = $1 ORDER BY cp.detected_at DESC`,
    [status]
  );
  return rows;
}

async function isApprover(empno) {
  if (!empno) return false;
  const { rows } = await engPool.query(
    `SELECT 1 FROM ${TABLES.APPROVER} WHERE u_code = $1 AND active LIMIT 1`, [empno]
  );
  return rows.length > 0;
}

async function approvePending(id, empno) {
  if (!(await isApprover(empno))) throw new PbringError(403, 'Only a listed approver may approve a detected cost update');
  const { rows } = await engPool.query(`SELECT * FROM ${TABLES.COST_PENDING} WHERE id = $1 AND status = 'pending'`, [id]);
  const pending = rows[0];
  if (!pending) throw new PbringError(404, 'Pending cost update not found (already decided?)');

  const { rows: tRows } = await engPool.query(`SELECT * FROM ${TABLES.TOOLING} WHERE id = $1`, [pending.tooling_id]);
  const current = tRows[0];
  if (!current) throw new PbringError(404, 'Tooling row no longer exists');

  const unitPrice = pending.detected_price;
  const orderQty = pending.detected_qty ?? current.order_qty;
  const totalPrice = Math.round((Number(unitPrice) || 0) * (Number(orderQty) || 0) * 100) / 100;
  const status = pending.detected_receive_date ? 'Received' : current.status;

  await engPool.query(
    `UPDATE ${TABLES.TOOLING} SET
       po_no = $1, unit_price = $2, order_qty = $3, total_price = $4, receive_date = $5, status = $6,
       cost_source = 'maqdb', cost_approved_by = $7, cost_updated_at = now(), updated_at = now()
     WHERE id = $8`,
    [pending.detected_po_no, unitPrice, orderQty, totalPrice, pending.detected_receive_date, status, empno, pending.tooling_id]
  );
  await engPool.query(
    `UPDATE ${TABLES.COST_PENDING} SET status = 'approved', decided_by = $1, decided_at = now() WHERE id = $2`,
    [empno, id]
  );
  return pending.tooling_id;
}

async function rejectPending(id, empno, note) {
  if (!(await isApprover(empno))) throw new PbringError(403, 'Only a listed approver may reject a detected cost update');
  const { rows } = await engPool.query(
    `UPDATE ${TABLES.COST_PENDING} SET status = 'rejected', decided_by = $1, decided_at = now(), note = $2
      WHERE id = $3 AND status = 'pending' RETURNING id`,
    [empno, note || null, id]
  );
  if (!rows.length) throw new PbringError(404, 'Pending cost update not found (already decided?)');
  return rows[0].id;
}

module.exports = { detectMissingCost, listPending, isApprover, approvePending, rejectPending };
