/**
 * Canonical OD / ID / W aliases over the per-part-type factory dimension tables.
 *
 * Every part class stores the same three physical dimensions under a different column
 * name (`lpb.eng_ball.ball_dia` vs `lpb.eng_race.od` vs `lpb.eng_sleeve.od` ...), so an
 * SDS grid cell cannot reference a raw column — the same machine grinds several classes.
 * These aliases give the grid ONE stable name per dimension; the resolver picks the right
 * column from the part's own type.
 *
 * Column names verified against `information_schema` (maqdb, lpb schema) 2026-07-19.
 */

// part_type (from sdsV2SearchService PART_TYPE_MAP) → factory column per canonical dim.
// null = that class genuinely has no such column — the resolver returns null, it does NOT
// fall back to a different dimension (printing a wrong-but-plausible number is the exact
// failure this module exists to stop).
const PART_DIM_ALIAS = {
  BALL:      { OD: 'ball_dia', ID: 'in_dia',   W: 'width' },
  RACE:      { OD: 'od',       ID: 'id',       W: 'width' },
  SLEEVE:    { OD: 'od',       ID: 'id',       W: 'full_length' },
  // lpb.eng_body has no outer-diameter column at all (head_width / final_id only).
  BODY:      { OD: null,       ID: 'final_id', W: 'head_width' },
  // Spherical dims live one table over: eng_sph (control_no → sph_design_no) →
  // eng_sph_design (sph_design_cn). sdsV2SearchService selects from eng_sph only, so the
  // caller must supply the joined design row — see resolvePartDims().
  SPHERICAL: { OD: 'sph_od',   ID: 'dall_id',  W: 'sph_width' },
  // Mecha (C9x) has no dimension table in lpb at all.
  MECHA:     { OD: null,       ID: null,       W: null },
};

/** Spherical needs a second table; the caller fetches it and merges before resolving. */
const SPHERICAL_DESIGN = {
  table: 'lpb.eng_sph_design',
  joinFrom: 'sph_design_no',   // column on lpb.eng_sph
  joinTo: 'sph_design_cn',     // column on lpb.eng_sph_design
};

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Resolve a factory dimension row into canonical { OD, ID, W, SD }.
 *
 * @param {string} partType  BALL | RACE | BODY | SLEEVE | SPHERICAL | MECHA
 * @param {object} dimRow    the raw `SELECT *` row (for SPHERICAL: eng_sph merged with
 *                           its eng_sph_design row)
 * @returns {{OD:?number, ID:?number, W:?number, SD:?number}} — null per dim when the
 *          class has no such column, or the row is missing / non-numeric.
 */
function resolvePartDims(partType, dimRow) {
  const alias = PART_DIM_ALIAS[String(partType || '').toUpperCase()];
  const out = { OD: null, ID: null, W: null, SD: null };
  if (!alias || !dimRow) return out;

  for (const key of ['OD', 'ID', 'W']) {
    const col = alias[key];
    if (col) out[key] = toNum(dimRow[col]);
  }

  // SD (spherical/crown diameter) is derived, never stored: SD = sqrt(OD² − W²).
  // Only meaningful when the ball is wider across than it is thick; guard so a bad
  // row yields null instead of NaN.
  if (out.OD != null && out.W != null && out.OD > out.W) {
    out.SD = Math.sqrt(out.OD * out.OD - out.W * out.W);
  }
  return out;
}

module.exports = { PART_DIM_ALIAS, SPHERICAL_DESIGN, resolvePartDims };
