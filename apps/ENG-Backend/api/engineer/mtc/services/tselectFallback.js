'use strict';

// ── Tooling Select fallback helper ────────────────────────────────────────────
// Shared by SDS PDF generation and the SDS coverage report so both decide
// "what tool does Tooling Select compute for this machine" identically.
//
// Tooling Select (searchService.search) is per-CN and relatively heavy (it loops
// machine × tooling × inventory). A short-lived TTL cache keyed by the spec CN
// keeps repeat lookups (same CN across PDF + report rows) cheap.

const searchService = require('./searchService');
const { engPool } = require('../../../../instance/eng_db');

const _cache = new Map();            // specCn → { at, result }
const TTL_MS = 10 * 60 * 1000;       // 10 minutes — matches SDS search cache TTL

// ── Persisted per-CN cache (DB) ───────────────────────────────────────────────
// The in-memory _cache is lost on restart, so the SDS coverage report re-runs
// hundreds of full Tooling Select searches on every cold build. Persist each CN's
// result to a DB row so rebuilds (and PDF generation across restarts) reuse it.
// Invalidated explicitly when T-Select config or part spec changes (clearPersisted),
// with a 6h TTL backstop.
const PERSIST_TTL_MS = 6 * 60 * 60 * 1000;
let _persistReady = null;
function ensurePersistTable() {
  if (!_persistReady) {
    _persistReady = engPool.query(`
      CREATE TABLE IF NOT EXISTS tselect_cn_cache (
        cn       TEXT PRIMARY KEY,
        result   JSONB,
        built_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((e) => { _persistReady = null; throw e; });
  }
  return _persistReady;
}
async function readPersisted(cn) {
  try {
    await ensurePersistTable();
    const r = await engPool.query(
      `SELECT result FROM tselect_cn_cache WHERE cn = $1 AND built_at > $2`,
      [cn, new Date(Date.now() - PERSIST_TTL_MS)]
    );
    if (r.rowCount) return { hit: true, result: r.rows[0].result };
  } catch (_) {}
  return { hit: false };
}
async function writePersisted(cn, result) {
  try {
    await ensurePersistTable();
    await engPool.query(
      `INSERT INTO tselect_cn_cache (cn, result, built_at) VALUES ($1, $2, NOW())
       ON CONFLICT (cn) DO UPDATE SET result = EXCLUDED.result, built_at = NOW()`,
      [cn, result]
    );
  } catch (_) {}
}
// Bulk-load fresh persisted rows into the in-memory cache (one query for the
// whole CN set, instead of a per-CN round trip). Called by the report before
// its search loop so most safeSearch() calls hit memory.
async function preloadPersisted(cns) {
  const keys = [...new Set((cns || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (!keys.length) return 0;
  try {
    await ensurePersistTable();
    const r = await engPool.query(
      `SELECT cn, result FROM tselect_cn_cache WHERE cn = ANY($1) AND built_at > $2`,
      [keys, new Date(Date.now() - PERSIST_TTL_MS)]
    );
    const now = Date.now();
    for (const row of r.rows) _cache.set(String(row.cn), { at: now, result: row.result });
    return r.rowCount;
  } catch (_) { return 0; }
}
// Drop the whole cache (memory + DB) — call on any T-Select config / spec change.
async function clearPersisted() {
  _cache.clear();
  try { await ensurePersistTable(); await engPool.query('DELETE FROM tselect_cn_cache'); } catch (_) {}
}

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
  // Persisted layer (survives restart; cleared on config/spec change)
  const p = await readPersisted(key);
  if (p.hit) { _cache.set(key, { at: Date.now(), result: p.result }); return p.result; }
  try {
    // A success OR a legitimate "spec not found" ({success:false}) is cacheable —
    // both are stable answers for this CN.
    const result = await searchService.search(key);
    _cache.set(key, { at: Date.now(), result });
    writePersisted(key, result); // fire-and-forget → survives restarts
    return result;
  } catch (_) {
    // Transient failure (e.g. a DB blip) — do NOT cache. Caching null here would
    // serve an empty result for the whole TTL (10 min) and silently drop the CN
    // from the coverage report / PDF tool list. Return null so the next call retries.
    return null;
  }
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
  // SKIPPED when opts.partHasProcess is true: a multi-grind part (e.g. a ball with
  // BOTH ID grind 1061 and spherical grind 1041) stores only ONE spec.process
  // direction (deriveProcess returns the first grind in seq). Without this skip the
  // gate wrongly rejects a spherical-grind machine's tooling (KS-500RD 4033-xx) on
  // the 1041 row just because the part's stored direction is ID->OD. When the part's
  // process plan genuinely contains the rendered process_code, that process is real
  // for this part → its T-Select tooling is legitimate regardless of stored direction.
  if (!opts.partHasProcess) {
    const expectedDir = directionForProcessCode(opts.processCode);
    const specDir = String(tsResult.spec?.process ?? '').toUpperCase().trim();
    if (expectedDir && specDir && specDir !== expectedDir) return [];
  }

  const out = [];
  const seen = new Set();
  for (const r of tsResult.results) {
    if (!acceptableNames.has(r.machine)) continue;
    // Similar-part fallbacks are suggestions (the factory's pick for the most
    // dimensionally-similar part), not a factory-confirmed tool. The SDS Setup
    // Data Sheet opts IN (opts.includeSimilar) so the sheet still carries a Tool
    // No — flagged isSimilar so the caller can mark it. The coverage report
    // leaves it OUT (default) so reported coverage stays confirmed-only.
    const isSimilar = r.overrideBy === 'similar_part';
    if (isSimilar && !opts.includeSimilar) continue;
    const no = matchNo(r.matches && r.matches[0]);
    if (!no) continue;
    const key = `${r.tooling}||${no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tooling_name: r.tooling, tooling_no: no, isSimilar });
  }
  return out;
}

module.exports = { safeSearch, tselectToolsForMachine, matchNo, directionForProcessCode, preloadPersisted, clearPersisted };
