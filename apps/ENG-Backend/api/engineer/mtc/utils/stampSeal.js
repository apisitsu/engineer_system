'use strict';

/**
 * stampSeal.js — auto-generated approval seal (Prepared / Checked / Approved).
 *
 * Draws the company's red circular personal seal as pure SVG, from
 * { name, date, dept } — no per-user image upload required. This is the
 * server-side port of the in-app vector seal already used by the New-Product
 * DWG checker (frontend `StampUserDate.jsx` / `dwg_check/utils/savePdf.js`
 * "stamp-userdate"), and reproduces the look of the manual `E STAMP 1.0.xlsb`
 * Excel/VBA tool (red circle + curved name).
 *
 * Layout (100×100 viewBox, based on StampUserDate.jsx, with the company seal's
 * curved top label added):
 *   • outer red circle + two horizontal dividers
 *   • TOP   — top zone, straight (default 'ROD ENG')
 *   • DATE  — middle zone, straight (formatted '01 JAN 2026' by the caller)
 *   • NAME  — bottom zone, curved along the lower arc (surname.first → 'S.APISIT')
 *
 * Two outputs:
 *   buildSealSvg()      → inline <svg> string (HTML-template render path)
 *   buildSealDataUri()  → data:image/svg+xml;base64 (grid cell `img` path)
 *   toSealName()        → "Apisit Suwannakate" → "S.APISIT" (surname-initial.FIRST)
 */

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Display name for the seal: surname initial + '.' + first name, uppercase.
// "Apisit Suwannakate" → "S.APISIT". Single-token or already-abbreviated → upper-cased.
function toSealName(full) {
  const s = String(full == null ? '' : full).trim();
  if (!s) return '';
  if (/^[A-Za-z]\.[A-Za-z]/.test(s)) return s.toUpperCase();   // already "S.APISIT" form
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return s.toUpperCase();
  return (parts[parts.length - 1][0] + '.' + parts[0]).toUpperCase();
}

/**
 * @param {object} o
 * @param {string} o.name   signer name (curved, bottom). If empty → no seal ('').
 * @param {string} [o.date] date string (middle). Defaults to ''.
 * @param {string} [o.top]  curved top label. Defaults to 'ROD ENG'.
 * @param {string} [o.dept] deprecated alias for top (kept for back-compat).
 * @param {string} [o.color] stroke/text colour. Defaults to red (#e74c3c).
 * @param {string} [o.seed] suffix for the internal path id (keep unique when
 *                          several inline seals share one HTML document).
 * @returns {string} SVG markup, or '' when there is no name to stamp.
 */
function buildSealSvg({ name, date = '', top, dept = '', color = '#e74c3c', seed = 's' } = {}) {
  const nm = String(name == null ? '' : name).trim();
  if (!nm) return '';
  const c = esc(color);
  const topLabel = esc((top != null ? top : (dept || 'ROD ENG')));
  const sd = String(seed).replace(/[^A-Za-z0-9_]/g, '');
  const pathId = `sealCurve_${sd}`;        // bottom arc (name)

  // Concrete intrinsic size (120×120) so it scales inside an <img src=svg> (grid
  // path), plus responsive style so it fills the flex stamp box when inlined (HTML
  // template path). preserveAspectRatio keeps the seal circular either way.
  //
  // SHRINK draws the whole seal smaller than its box, centred in the 100×100 viewBox
  // (0.8 = 20% smaller; 1.0 = fills the box). All shapes AND the defs/path live inside
  // the one scaled <g> so the curved-name arc stays in the same coordinate space.
  const SHRINK = 0.8;
  const off = (100 * (1 - SHRINK) / 2).toFixed(1); // centre offset (10.0 at 0.8)
  // Bottom name: KEEP a constant font size on every seal. Long names (e.g.
  // "P.PATTANAPONG") would clip the arc, so instead of shrinking the font we
  // CONDENSE them horizontally to fit (same glyph height → same visual size).
  const NAME_FS = 13;
  const NAME_CAP = 64;                                   // usable arc span (user units)
  const estW = nm.length * NAME_FS * 0.58;              // rough natural width
  const nameFit = estW > NAME_CAP
    ? ` textLength="${NAME_CAP}" lengthAdjust="spacingAndGlyphs"`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:100%">`
    + `<g transform="translate(${off},${off}) scale(${SHRINK})">`
    // Name curves along the bottom rim (the classic seal look). ROD ENG sits high in
    // the top band so the three rows (top / date / curved name) read evenly.
    + `<defs><path id="${pathId}" d="M 12,74 A 43,43 0 0,0 88,74" fill="none"/></defs>`
    + `<circle cx="50" cy="50" r="48" fill="white" stroke="${c}" stroke-width="3"/>`
    + `<line x1="4" y1="36" x2="96" y2="36" stroke="${c}" stroke-width="2"/>`
    + `<line x1="4" y1="64" x2="96" y2="64" stroke="${c}" stroke-width="2"/>`
    + `<text x="50" y="27" text-anchor="middle" fill="${c}" font-size="14" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${topLabel}</text>`
    + `<text x="50" y="54" text-anchor="middle" fill="${c}" font-size="12" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc(date)}</text>`
    + `<text fill="${c}" font-size="${NAME_FS}" font-weight="bold" font-family="Arial, Helvetica, sans-serif" dy="-2">`
    + `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle"${nameFit}>${esc(nm)}</textPath></text>`
    + `</g>`
    + `</svg>`;
}

/** Same seal as a base64 SVG data-URI (for grid `img` cells / <img src>). */
function buildSealDataUri(o = {}) {
  const svg = buildSealSvg(o);
  if (!svg) return '';
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

module.exports = { buildSealSvg, buildSealDataUri, toSealName };
