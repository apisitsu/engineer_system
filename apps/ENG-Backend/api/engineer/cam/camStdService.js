'use strict';

/**
 * CAD/CAM standard cutting speeds — data access.
 *
 * The CAM module compares a loaded NC program's Vc against these ranges and
 * proposes replacements (the client half is `cam/engine/cam/stdVc.js`). The
 * ranges live in the database rather than in the bundle so that the shop can
 * correct them — and sign them off — without a deploy.
 *
 * Two tables, because a material is one thing and its speeds are five:
 *   cam_std_material  one row per material — label, ISO group, the names a file
 *                     is recognised by, and whether the figures are verified.
 *   cam_std_vc        one row per (material, operation) — the Vc range.
 *
 * A material's ranges are always written together, in one transaction, so a
 * reader never sees half of an edit.
 */

const { engPool } = require('../../../instance/eng_db');
const { TABLES, STD_OPERATIONS, STD_STATUSES } = require('./camConstants');

class StdError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Every material with its ranges, in the shape the client reads:
 *   { key, label, isoGroup, aliases, status, sourceNote, vc: { turning: [min,max], … } }
 */
async function listAll() {
  const { rows } = await engPool.query(
    `SELECT m.key, m.label, m.iso_group, m.aliases, m.status, m.source_note, m.sort_order,
            m.updated_by, m.updated_at, v.operation, v.vc_min, v.vc_max
       FROM ${TABLES.CAM_STD_MATERIAL} m
       LEFT JOIN ${TABLES.CAM_STD_VC} v ON v.material_key = m.key
      ORDER BY m.sort_order, m.key, v.operation`
  );
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.key)) {
      byKey.set(r.key, {
        key: r.key,
        label: r.label,
        isoGroup: r.iso_group,
        aliases: r.aliases || [],
        status: r.status,
        sourceNote: r.source_note || '',
        updatedBy: r.updated_by || null,
        updatedAt: r.updated_at,
        vc: {},
      });
    }
    if (r.operation) byKey.get(r.key).vc[r.operation] = [Number(r.vc_min), Number(r.vc_max)];
  }
  return [...byKey.values()];
}

/** Validate one material body; returns the cleaned shape or throws a StdError(400). */
function clean(key, body) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,39}$/.test(key)) {
    throw new StdError(400, 'material key must be 1-40 letters, digits, . _ - or space');
  }
  const b = body || {};
  const vc = {};
  for (const [op, range] of Object.entries(b.vc || {})) {
    if (!STD_OPERATIONS.includes(op)) {
      throw new StdError(400, `unknown operation “${op}” — use ${STD_OPERATIONS.join(', ')}`);
    }
    const [lo, hi] = Array.isArray(range) ? range.map(Number) : [NaN, NaN];
    if (!(lo > 0) || !(hi >= lo) || hi > 5000) {
      throw new StdError(400, `${op}: the range must be 0 < min ≤ max ≤ 5000 m/min`);
    }
    vc[op] = [lo, hi];
  }
  if (b.status !== undefined && !STD_STATUSES.includes(b.status)) {
    throw new StdError(400, `status must be one of ${STD_STATUSES.join(', ')}`);
  }
  const aliases = Array.isArray(b.aliases)
    ? b.aliases.map((a) => String(a).trim()).filter(Boolean).slice(0, 20)
    : undefined;
  return {
    key,
    label: typeof b.label === 'string' ? b.label.trim() : undefined,
    isoGroup: typeof b.isoGroup === 'string' ? b.isoGroup.trim() : undefined,
    aliases,
    status: b.status,
    sourceNote: typeof b.sourceNote === 'string' ? b.sourceNote.trim() : undefined,
    vc,
  };
}

/**
 * Create or update one material and its ranges.
 *
 * `canApprove` is the caller's authority to set `status = 'approved'`. Anyone
 * who may edit can *change* a range, but a changed range goes back to 'draft'
 * unless an approver is the one saving it — otherwise editing a number would
 * quietly keep the old sign-off.
 */
async function upsertMaterial(key, body, { empno, canApprove }) {
  const m = clean(key, body);
  if (m.status === 'approved' && !canApprove) {
    throw new StdError(403, 'Only an administrator can mark a standard as approved.');
  }
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT 1 FROM ${TABLES.CAM_STD_MATERIAL} WHERE key = $1 FOR UPDATE`, [m.key]
    );
    const changesRanges = Object.keys(m.vc).length > 0;
    // Editing figures drops the sign-off unless an approver saved them as approved.
    const status = m.status ?? (changesRanges ? 'draft' : undefined);
    if (existing.rowCount === 0) {
      if (!m.label) throw new StdError(400, 'label is required for a new material');
      await client.query(
        `INSERT INTO ${TABLES.CAM_STD_MATERIAL}
           (key, label, iso_group, aliases, status, source_note, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())`,
        [m.key, m.label, m.isoGroup || '', m.aliases || [m.key], status || 'draft', m.sourceNote || '', empno]
      );
    } else {
      await client.query(
        `UPDATE ${TABLES.CAM_STD_MATERIAL}
            SET label       = COALESCE($2, label),
                iso_group   = COALESCE($3, iso_group),
                aliases     = COALESCE($4, aliases),
                status      = COALESCE($5, status),
                source_note = COALESCE($6, source_note),
                updated_by  = $7,
                updated_at  = NOW()
          WHERE key = $1`,
        [m.key, m.label ?? null, m.isoGroup ?? null, m.aliases ?? null, status ?? null, m.sourceNote ?? null, empno]
      );
    }
    for (const [op, [lo, hi]] of Object.entries(m.vc)) {
      await client.query(
        `INSERT INTO ${TABLES.CAM_STD_VC} (material_key, operation, vc_min, vc_max)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (material_key, operation)
         DO UPDATE SET vc_min = EXCLUDED.vc_min, vc_max = EXCLUDED.vc_max`,
        [m.key, op, lo, hi]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return (await listAll()).find((x) => x.key === m.key);
}

module.exports = { StdError, listAll, upsertMaterial, clean };
