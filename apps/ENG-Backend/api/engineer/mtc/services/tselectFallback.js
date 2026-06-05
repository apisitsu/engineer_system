'use strict';

// ── Tooling Select fallback helper ────────────────────────────────────────────
// Shared by SDS PDF generation and the SDS coverage report so both decide
// "what tool does Tooling Select compute for this machine" identically.
//
// Tooling Select (searchService.search) is per-CN and relatively heavy (it loops
// machine × tooling × inventory). A short-lived TTL cache keyed by the spec CN
// keeps repeat lookups (same CN across PDF + report rows) cheap.

const searchService = require('./searchService');

const _cache = new Map();            // specCn → { at, result }
const TTL_MS = 10 * 60 * 1000;       // 10 minutes — matches SDS search cache TTL

// inventory match row → tool number (mirrors frontend getMatchNo in SdsV2Page.jsx)
function matchNo(m) {
  if (!m) return null;
  const raw = m.tooling_no ?? m.No ?? m.no ?? m.part_no ?? null;
  return raw != null ? String(raw).trim() : null;
}

/**
 * Run Tooling Select for one CN. Never throws (returns null on error) and caches
 * the result for TTL_MS. `cn` may be 6-digit (e.g. "350528") or Cxx-0YYYY form —
 * searchService normalizes internally.
 */
async function safeSearch(cn) {
  const key = String(cn || '').trim();
  if (!key) return null;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  let result = null;
  try { result = await searchService.search(key); } catch (_) { result = null; }
  _cache.set(key, { at: Date.now(), result });
  return result;
}

/**
 * Best Tooling Select tool per tooling for a given machine.
 *
 * @param tsResult        result of safeSearch(cn) / searchService.search(cn)
 * @param acceptableNames Set of names that identify this machine inside the
 *                        result (the machine_type_name and its machine_group —
 *                        T-Select labels grouped machines by machine_group).
 * @returns [{ tooling_name, tooling_no }] — first (closest) match per tooling
 */
function tselectToolsForMachine(tsResult, acceptableNames) {
  if (!tsResult || !tsResult.success || !Array.isArray(tsResult.results)) return [];
  const out = [];
  const seen = new Set();
  for (const r of tsResult.results) {
    if (!acceptableNames.has(r.machine)) continue;
    const no = matchNo(r.matches && r.matches[0]);
    if (!no) continue;
    const key = `${r.tooling}||${no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tooling_name: r.tooling, tooling_no: no });
  }
  return out;
}

module.exports = { safeSearch, tselectToolsForMachine, matchNo };
