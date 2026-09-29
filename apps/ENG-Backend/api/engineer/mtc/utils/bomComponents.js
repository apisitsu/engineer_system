'use strict';

/**
 * What a SPHERICAL is assembled from, read off its BOM.
 * ============================================================================
 * `lpb.eng_bom` (parent_cn -> child_cn) lists, for a spherical (A41-A49), the race
 * and the ball it is built from plus any extras (seal, liner, retainer, PM stock).
 * This groups those children by part family so the SDS page can name them.
 *
 * It is the DESIGN bom - the C/N the drawing calls for - not the lot that was
 * actually assembled. Lot genealogy is `lpb.pc_allocated_lot`, which is a different
 * question (and lot-level only).
 *
 * Pure: no I/O. The caller runs the query.
 */

const { resolveKubun } = require('./cnKubun');

const BUCKET = { BALL: 'ball', RACE: 'race' };

/**
 * @param {Array<{child_cn:string, child_pn?:string, qty?:string|number, parts_name?:string}>} rows
 * @returns {{ball:object[], race:object[], other:object[]}}
 *   each entry: { cn, pn, name, qty }, sorted by cn within its bucket.
 */
function groupBomChildren(rows) {
  const out = { ball: [], race: [], other: [] };
  for (const r of rows || []) {
    if (!r || !r.child_cn) continue;
    const family = resolveKubun(r.child_cn)?.family;
    const bucket = BUCKET[family] || 'other';
    const qty = Number(r.qty);
    out[bucket].push({
      cn: r.child_cn,
      pn: r.child_pn || null,
      name: (r.parts_name && String(r.parts_name).trim()) || null,
      qty: Number.isFinite(qty) ? qty : null,
    });
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.cn.localeCompare(b.cn));
  return out;
}

module.exports = { groupBomChildren };
