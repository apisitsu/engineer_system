'use strict';

/**
 * Tool-code normalization + tiered matching — ported from the standalone
 * prototype's `toolcode.py` (see PB_Ring_SDS_Project/toolcode.py). Pure,
 * no DB access: given two code strings, says how confidently they name the
 * same tool. This is what makes matching `pbring_tooling.tool_code` against
 * `lpb.pc_material_purchase.spec1` reliable — matching by `po_no` alone was
 * measured to mismatch line items whenever one PO covers several tools.
 *
 * Tiers (lower is better): 1 = code + Rev both match; 2 = code matches, one
 * side has no Rev; 3 = code matches, Rev differs; 5 = no match.
 */

const STD_RE = new RegExp([
  '[A-Z]{0,2}\\d{3,5}-\\d{2}(?:-[A-Z]?\\d{2,4}){1,2}', // 34384-01-0186 / G371-02-0015
  '\\d{3}\\.\\d\\.\\d{3}-\\d{3}',                       // 772.5.025-027
].join('|'));
const REV_PAREN = /\(\s*REV\.?\s*([A-Z0-9]{1,3})\s*\)/;

const clean = (s) => String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
const key = (s) => clean(s).replace(/[^A-Z0-9]/g, '');

/** One tool-code cell -> [[normalizedKey, rev], ...] — a cell may hold several codes ("A / B"). */
function parseCodes(text) {
  const t = clean(text);
  if (!t || t === 'NAN' || t === 'NONE' || t === '-') return [];
  const out = [];
  for (let part of t.split(/\s*[/;]\s*(?![^()]*\))/)) {
    if (!part) continue;
    let rev = '';
    const m = REV_PAREN.exec(part);
    if (m) { rev = m[1]; part = part.replace(REV_PAREN, ' '); }
    const std = STD_RE.exec(part);
    if (std) {
      const core = std[0];
      const tail = part.slice(std.index + core.length).trim();
      if (!rev) {
        const m2 = /^[ -]?([A-Z])(?![A-Z0-9])/.exec(tail);
        if (m2) rev = m2[1];
      }
      out.push([key(core), rev]);
    } else {
      const k = key(part);
      if (k) out.push([k, rev]);
    }
  }
  return out;
}

/** Best tier across every (ours × theirs) code pair. */
function bestTier(rawCodes, otherCodes) {
  let best = 5;
  for (const [k1, r1] of rawCodes) {
    for (const [k2, r2] of otherCodes) {
      const same = k1 === k2
        || (k1.length >= 8 && k2.length >= 8 && (k1.startsWith(k2) || k2.startsWith(k1)) && Math.abs(k1.length - k2.length) <= 1);
      if (!same) continue;
      best = Math.min(best, r1 && r2 ? (r1 === r2 ? 1 : 3) : 2);
    }
  }
  return best;
}

module.exports = { parseCodes, bestTier, key };
