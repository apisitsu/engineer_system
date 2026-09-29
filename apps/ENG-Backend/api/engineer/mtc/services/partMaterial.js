'use strict';

/**
 * Raw material of a part, read off its BOM.
 * ============================================================================
 * part CN --eng_bom--> raw-material child (PM1-xxxxx) --eng_item.parts_no--> first 4 chars
 * --eng_mcode.mate_class_code4--> grade / mate_code / procurement spec.
 *
 * WHY THE PM PREFERENCE: a part's BOM carries more than its raw material. A race lists its
 * TFE liner (C82-xxxxx) beside the bar stock (PM1-xxxxx); the old lookup took "the first child"
 * with no ORDER BY, so a race whose liner sorted first resolved no material at all. Measured
 * 2026-09-28 over every part: races 450 -> 1,115 of 1,191, sleeves 2,014 -> 3,630 of 3,866
 * (balls 1,163 -> 1,212; bodies unchanged). A part has at most ONE PM child, so the pick is
 * unambiguous. A part with no PM child falls back to any child, exactly as before, so nothing
 * that resolved yesterday stops resolving.
 *
 * One set-based query for any number of CNs (an SPHERICAL asks for itself + its ball + its race).
 */

const { TABLES } = require('../mtcConstants');

/** Pure: one result row -> the `material` object the SDS response carries, or null. */
function shapeMaterial(row) {
  // No eng_item row for the BOM child = no raw material to report (same as the old lookup).
  if (!row || !row.item_cn) return null;
  return {
    material:       row.as400name || null,
    mate_code:      row.mate_code || null,
    procument_spec: row.procument_spec || null,
    raw_control_no: row.item_cn,
    raw_parts_no:   row.item_pn || null,
  };
}

/**
 * The grade a setup sheet prints in its Material cell (and the page shows in Material).
 * A spherical is ball + race with no raw material of its own, so it prints its race's grade;
 * if it has several races the distinct grades are joined. Every other part prints its own.
 * One rule here so the page and the PDF cannot drift apart.
 * @param {object|null} ownMaterial  the part's own `material` object (shapeMaterial)
 * @param {object|null} components   `{ race: [{material}] }` for a SPHERICAL, else null
 * @returns {string|null}
 */
function sheetMaterial(ownMaterial, components) {
  if (components) {
    const grades = [...new Set((components.race || []).map((r) => r && r.material).filter(Boolean))];
    return grades.length ? grades.join(' / ') : null;
  }
  return (ownMaterial && ownMaterial.material) || null;
}

/**
 * @param {{ query: Function }} maqPool
 * @param {string[]} cns  canonical control numbers (C23-00023)
 * @returns {Promise<Map<string, object|null>>}  cn -> material object (or null)
 */
async function fetchPartMaterials(maqPool, cns) {
  const list = [...new Set((cns || []).filter(Boolean))];
  const out = new Map(list.map((c) => [c, null]));
  if (!list.length) return out;

  const { rows } = await maqPool.query(`
    SELECT p.cn AS part_cn, i.control_no AS item_cn, i.parts_no AS item_pn,
           m.as400name, m.mate_code, m.procument_spec
      FROM unnest($1::text[]) AS p(cn)
      LEFT JOIN LATERAL (
        SELECT child_cn, child_pn FROM ${TABLES.LPB_ENG_BOM}
         WHERE parent_cn = p.cn
         ORDER BY (child_cn LIKE 'PM%') DESC, child_cn
         LIMIT 1) b ON true
      LEFT JOIN LATERAL (
        SELECT control_no, parts_no FROM ${TABLES.LPB_ENG_ITEM}
         WHERE control_no = b.child_cn LIMIT 1) i ON true
      LEFT JOIN LATERAL (
        SELECT as400name, mate_code, procument_spec FROM ${TABLES.LPB_ENG_MCODE}
         WHERE mate_class_code4 = LEFT(COALESCE(NULLIF(i.parts_no, ''), b.child_pn), 4)
         LIMIT 1) m ON true`, [list]);

  for (const r of rows || []) out.set(r.part_cn, shapeMaterial(r));
  return out;
}

module.exports = { fetchPartMaterials, shapeMaterial, sheetMaterial };
