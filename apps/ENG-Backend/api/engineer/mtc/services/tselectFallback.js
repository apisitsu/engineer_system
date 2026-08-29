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
async function safeSearch(cn, opts = {}) {
  const key = String(cn || '').trim();
  if (!key) return null;
  // withSimilarRef enriches every result with `similarRef` (the tool a dimensionally
  // SIMILAR produced part actually used). It costs extra per-machine + cross-pool
  // queries, so it is OPT-IN — only the SDS PDF requests it. The cache/persist key is
  // namespaced (`::sim`) so the coverage report (plain safeSearch) never pays for it
  // and the two variants never collide.
  const withSimilarRef = !!opts.withSimilarRef;
  const ck = withSimilarRef ? `${key}::sim` : key;
  const hit = _cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  // Persisted layer (survives restart; cleared on config/spec change)
  const p = await readPersisted(ck);
  if (p.hit) { _cache.set(ck, { at: Date.now(), result: p.result }); return p.result; }
  try {
    // A success OR a legitimate "spec not found" ({success:false}) is cacheable —
    // both are stable answers for this CN.
    const result = await searchService.search(key, withSimilarRef ? { withSimilarRef: true } : {});
    _cache.set(ck, { at: Date.now(), result });
    writePersisted(ck, result); // fire-and-forget → survives restarts
    return result;
  } catch (_) {
    // Transient failure (e.g. a DB blip) — do NOT cache. Caching null here would
    // serve an empty result for the whole TTL (10 min) and silently drop the CN
    // from the coverage report / PDF tool list. Return null so the next call retries.
    return null;
  }
}

// '9901-09-0005' → '9901-09'. Anything that is not a two-segment DWG number yields '',
// which the caller below rejects outright — so a malformed Tool No can never widen the gate.
function familyOf(no) {
  const m = String(no || '').trim().match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
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
 * @param opts.acceptFamilies (optional) Set of 2-segment DWG families ('9901-09')
 *                        that THIS machine's Machine Tool Config whitelists. A
 *                        result filed under a DIFFERENT machine name is admitted
 *                        when its tool's family is in that set.
 *
 *                        Some tooling is used ON a machine but belongs to another
 *                        machine's registry code, so T-Select files it elsewhere
 *                        and the name gate above drops it. 9901-09 CONCENTRICITY
 *                        MEASURING PIN is the worked case: TEMPLATE_B lists it as
 *                        the first tool of every X-100 block, but its family
 *                        resolves to registry code 901 = `測定用治具全般`, so on an
 *                        X-100 sheet T-Select could never supply the Tool No and
 *                        the slot printed name-only.
 *
 *                        The whitelist is what makes this safe: it is the sheet's
 *                        own statement of what belongs on it, so a foreign-machine
 *                        result can only enter through a family the config already
 *                        reserves a slot for. Unrelated tooling stays out.
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
  const acceptFamilies = opts.acceptFamilies instanceof Set ? opts.acceptFamilies : null;
  for (const r of tsResult.results) {
    // A foreign-machine result is still a candidate when acceptFamilies is given —
    // its DWG family decides, and that is only known once `no` is resolved below.
    const machineOk = acceptableNames.has(r.machine);
    if (!machineOk && !acceptFamilies) continue;
    // Similar-part suggestions (not a factory-confirmed selection). Two forms:
    //   1. overrideBy='similar_part' — a partno_map twin that FILLED an empty tooling
    //      (matches was replaced with the twin's tool).
    //   2. similarRef — a dimensionally-similar PRODUCED part's actual tool, attached
    //      ALONGSIDE a real dimensional match (only present when searched withSimilarRef).
    // The coverage report opts OUT (includeSimilar unset) → confirmed dimensional
    // matches only, so its counts are unaffected by this preference.
    const isOverrideSimilar = r.overrideBy === 'similar_part';
    if (isOverrideSimilar && !opts.includeSimilar) continue;
    // Preference order for the SDS PDF fallback (includeSimilar): pick the SIMILAR
    // produced part's tool (similarRef) FIRST; only when there is none fall back to
    // the raw dimensional closest inventory match (matches[0] = "T-Select #1").
    let no, isSimilar;
    if (opts.includeSimilar && r.similarRef && r.similarRef.tool_dwg_no) {
      no = String(r.similarRef.tool_dwg_no).trim();
      isSimilar = true;
    } else {
      no = matchNo(r.matches && r.matches[0]);
      isSimilar = isOverrideSimilar;
    }
    if (!no) continue;
    // An empty family is rejected here rather than trusted to be absent from the
    // whitelist — a caller that let one through would otherwise admit every foreign
    // tool whose number is not a DWG number at all.
    const fam = machineOk ? null : familyOf(no);
    if (!machineOk && (!fam || !acceptFamilies.has(fam))) continue;
    const key = `${r.tooling}||${no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tooling_name: r.tooling, tooling_no: no, isSimilar });
  }
  return out;
}

module.exports = { safeSearch, tselectToolsForMachine, matchNo, directionForProcessCode, preloadPersisted, clearPersisted };
