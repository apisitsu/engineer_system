'use strict';

/**
 * Single source of truth for CN / Control-No format conversions.
 *
 * The same part appears in THREE string shapes across the codebase:
 *   - itemNo    : 6 digits, no letter/dash     e.g. "250235"
 *                 (tooling_spec_process.cn, lpb.pc_production.control_no)
 *   - controlNo : canonical Cxx-0YYYY (5-digit) e.g. "C25-00235"
 *                 (lpb.eng_ball/race/body/... factory dim & process tables)
 *   - specCn    : 6 digits == itemNo            (Tooling Select spec key)
 *
 * Inputs are often messy: a trailing "-C" suffix (pc_production), a 4-digit
 * suffix the user typed (Cxx-YYYY), or an already-canonical value.
 *
 * Before this module these conversions were duplicated in searchService.js
 * (normalizeSpecCn), sdsV2SearchService.js (inline regex + itemNoToCN) and
 * sdsV2ReportController.js (normalizeCn + toSpecCn) — three copies that could
 * drift apart. Every call site now delegates here.
 */

// "C25-00235" / "C25-0235" / "250235" / "250235-C" → "250235" (6-digit) | null
function toItemNo(raw) {
  if (raw == null) return null;
  // strip a trailing single-letter suffix (pc_production: "350528-C")
  const s = String(raw).trim().toUpperCase().replace(/-[A-Z]$/, '');
  if (/^\d{6}$/.test(s)) return s;
  // Cxx-0YYYY or Cxx-YYYY (leading zeros in the suffix are optional)
  const m = s.match(/^[A-Z](\d{2})-0*(\d{4})$/);
  if (m) return m[1] + m[2];
  return null;
}

// 6-digit itemNo → canonical "C25-00235" (prefix A for spherical class 41-49)
function itemNoToControlNo(itemNo) {
  if (!/^\d{6}$/.test(String(itemNo || ''))) return null;
  const classNum = String(itemNo).slice(0, 2);
  const seq = String(itemNo).slice(2); // 4 digits
  const prefix = classNum >= '41' && classNum <= '49' ? 'A' : 'C';
  return `${prefix}${classNum}-0${seq}`;
}

// any accepted shape → canonical "C25-00235" | null
function toControlNo(raw) {
  const item = toItemNo(raw);
  if (item) return itemNoToControlNo(item);
  // already canonical but with an unexpected suffix length we don't reshape
  const s = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]\d{2}-\d{4,5}$/.test(s) ? s : null;
}

// any accepted shape → 6-digit Tooling Select spec CN | null
const toSpecCn = toItemNo;

// Backward-compatible alias (was sdsV2SearchService.itemNoToCN). Kept so callers
// importing the old name keep working; identical output to itemNoToControlNo.
const itemNoToCN = itemNoToControlNo;

module.exports = { toItemNo, toControlNo, toSpecCn, itemNoToControlNo, itemNoToCN };
