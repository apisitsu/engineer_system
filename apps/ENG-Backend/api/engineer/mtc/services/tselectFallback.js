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

// Periodic sweep so expired entries are evicted even when never read again.
// Without this the Map only checks TTL on read → stale entries accumulate in RAM
// during a long-running process (the coverage build touches hundreds of CNs).
// Timer is unref'd so it never keeps the process alive on its own.
const _sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, v] of _cache) {
    if (now - v.at >= TTL_MS) _cache.delete(key);
  }
}, TTL_MS);
if (typeof _sweepTimer.unref === 'function') _sweepTimer.unref();

// Factory grinding process_code → grinding direction (mirrors specController's
// ID_GRIND_PROCESS_CODES / OD_GRIND_PROCESS_CODES). Tooling Select itself has no
// concept of process_code — it stores direction on the spec — so this lets the
// SDS side gate a per-process tool match by the part's actual grinding direction.
const PROCESS_CODE_DIRECTION = {
  '1041': 'OD->ID', '1042': 'OD->ID',
  '1061': 'ID->OD', '1062': 'ID->OD',
};
function directionForProcessCode(code) {
  return PROCESS_CODE_DIRECTION[String(code ?? '').trim()] || null;
}

// inventory match row → tool number (mirrors frontend getMatchNo in SdsV2Page.jsx)
// All inventory tables use the canonical `tooling_no` column — audited 2026-06-06:
// every tooling_* table has tooling_no; none use No/no/part_no. The old
// `?? No ?? no ?? part_no` fallback read columns that exist in no current table,
// so it was removed. If a non-canonical inventory table is ever added, the
// diagnostics SQL (20260606_tselect_sds_diagnostics.sql, section E) flags it.
function matchNo(m) {
  if (!m) return null;
  const raw = m.tooling_no ?? null;
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
 * @param opts.processCode (optional) factory grinding process_code. When given
 *                        AND it maps to a grinding direction AND the part's spec
 *                        has a (different) direction, the match is rejected — the
 *                        T-Select tooling set is for the part's actual grinding
 *                        direction, so it must not satisfy an opposite-direction
 *                        process row. Missing/unknown direction → not gated
 *                        (additive: only removes provable false positives).
 * @returns [{ tooling_name, tooling_no }] — first (closest) match per tooling
 */
function tselectToolsForMachine(tsResult, acceptableNames, opts = {}) {
  if (!tsResult || !tsResult.success || !Array.isArray(tsResult.results)) return [];

  // Direction gate — only rejects on a proven conflict, never on missing data.
  const expectedDir = directionForProcessCode(opts.processCode);
  const specDir = String(tsResult.spec?.process ?? '').toUpperCase().trim();
  if (expectedDir && specDir && specDir !== expectedDir) return [];

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

module.exports = { safeSearch, tselectToolsForMachine, matchNo, directionForProcessCode };
