'use strict';

/**
 * PB Ring tooling — manual cost / field edits.
 *
 * This is the "input เอง" half of the dual cost-input design (see the pbring
 * plan). The other half — auto-detect against `maqdb.lpb.pc_material_purchase`
 * with an approve/reject queue in `pbring_cost_pending` — is a later phase and
 * is not touched here. A manual edit always wins immediately and is attributed
 * `cost_source='manual'`; it never goes through the pending-approval table.
 */

const { engPool } = require('../../../instance/eng_db');
const { TABLES, STATUS } = require('./pbringConstants');

// Same editable set as the prototype's "rows added through this page" grid —
// part_group/part_no/process_code/mc_type stay structural, set once at
// creation (manual add, or the add-new-HW-from-history flow), not patched here.
const EDITABLE_FIELDS = [
  'cn', 'tooling_item', 'tool_code', 'maker', 'po_no',
  'order_qty', 'unit_price', 'receive_date', 'status',
];

class PbringError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function isUnusedCode(toolCode) {
  return String(toolCode || '').trim().toUpperCase() === 'UNUSED';
}

async function updateTooling(id, patch) {
  const { rows } = await engPool.query(`SELECT * FROM ${TABLES.TOOLING} WHERE id = $1`, [id]);
  const current = rows[0];
  if (!current) throw new PbringError(404, 'Item not found');

  const unknown = Object.keys(patch || {}).filter((k) => !EDITABLE_FIELDS.includes(k));
  if (unknown.length) throw new PbringError(400, `Cannot edit field(s): ${unknown.join(', ')}`);
  if (patch.status != null && !STATUS.includes(patch.status)) {
    throw new PbringError(400, `status must be one of: ${STATUS.join(', ')}`);
  }
  for (const f of ['order_qty', 'unit_price']) {
    if (patch[f] != null && patch[f] !== '' && Number.isNaN(Number(patch[f]))) {
      throw new PbringError(400, `${f} must be a number`);
    }
  }

  const merged = { ...current, ...patch };

  // Same auto-rules as the prototype: a receive date implies "Received" unless
  // the caller said otherwise or the tool is UNUSED; UNUSED tool_code always wins.
  if (patch.receive_date && patch.status == null && current.status !== 'Received' && current.status !== 'UNUSED') {
    merged.status = 'Received';
  }
  if (patch.tool_code !== undefined) {
    const trimmed = String(patch.tool_code || '').trim();
    merged.tool_code_base = trimmed.split(' ')[0] || null;
    if (isUnusedCode(trimmed)) merged.status = 'UNUSED';
  }

  const unitPrice = merged.unit_price === '' ? null : merged.unit_price;
  const orderQty = merged.order_qty === '' ? null : merged.order_qty;
  const totalPrice = Math.round((Number(unitPrice) || 0) * (Number(orderQty) || 0) * 100) / 100;

  const { rows: updated } = await engPool.query(
    `UPDATE ${TABLES.TOOLING} SET
       cn = $1, tooling_item = $2, tool_code = $3, tool_code_base = $4, maker = $5,
       po_no = $6, order_qty = $7, unit_price = $8, total_price = $9, receive_date = $10,
       status = $11, cost_source = 'manual', cost_approved_by = NULL, cost_updated_at = now(),
       updated_at = now()
     WHERE id = $12
     RETURNING *`,
    [
      merged.cn || null, merged.tooling_item || null, merged.tool_code || null,
      merged.tool_code_base || null, merged.maker || null, merged.po_no || null,
      orderQty, unitPrice, totalPrice, merged.receive_date || null, merged.status || null,
      id,
    ]
  );
  return updated[0];
}

/**
 * Delete one row. Same rule as the prototype's own delete button: only rows
 * created through the app (manual add or "add from history") can be removed —
 * the 2,043 rows that came from the one-time prototype import
 * (`created_by = 'import:pbring-prototype'`) are not, so a test/mistake here
 * can never erase part of the original historical record.
 */
async function deleteTooling(id) {
  const { rows } = await engPool.query(`SELECT id, created_by FROM ${TABLES.TOOLING} WHERE id = $1`, [id]);
  const current = rows[0];
  if (!current) throw new PbringError(404, 'Item not found');
  if (String(current.created_by || '').startsWith('import:')) {
    throw new PbringError(400, 'Cannot delete a row imported from the original Excel file');
  }
  await engPool.query(`DELETE FROM ${TABLES.TOOLING} WHERE id = $1`, [id]);
  return id;
}

/**
 * Delete every deletable row under one HW (`part_group`) in one go — same
 * import-protection as `deleteTooling`, applied per row rather than refusing
 * the whole HW if even one of its rows happens to be from the original import
 * (a HW created entirely through "เพิ่ม HW ใหม่" has none; one that mixes
 * app-added rows onto a historical HW keeps the historical ones).
 */
async function deleteByPartGroup(partGroup) {
  if (!partGroup) throw new PbringError(400, 'HW is required');
  const { rows: deleted } = await engPool.query(
    `DELETE FROM ${TABLES.TOOLING} WHERE part_group = $1 AND created_by NOT LIKE 'import:%' RETURNING id`,
    [partGroup]
  );
  const { rows: remaining } = await engPool.query(
    `SELECT count(*)::int n FROM ${TABLES.TOOLING} WHERE part_group = $1`,
    [partGroup]
  );
  return { deletedCount: deleted.length, protectedCount: remaining[0].n };
}

module.exports = { updateTooling, deleteTooling, deleteByPartGroup, EDITABLE_FIELDS, PbringError };
