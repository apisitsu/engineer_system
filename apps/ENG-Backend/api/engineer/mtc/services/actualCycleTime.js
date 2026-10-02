'use strict';

/**
 * Actual (not planned) cycle time per process, from `lpb.pc_production`.
 * ============================================================================
 * `lpb.eng_process_info.ct` is the FACTORY PLAN's cycle time and is frequently blank
 * (~55% of rows overall, ~45% for OD GRIND/1011 specifically) - a part can have a
 * fully worked process plan and still show nothing there. `pc_production.cycle_time`
 * is what each completed LOT actually ran at, in seconds/pc (same column family as
 * `set_time`; see CLAUDE.md's lot-tracking note). Reported live 2026-10-01 on
 * C29-04065 @1011: eng_process_info.ct was blank while pc_production had 7 real lots.
 *
 * A meaningful share of lots carry cycle_time = 0.00 - not recorded, not "took no
 * time" (that CN's 7 lots were 200/12/0/0/0/14/0). Per the owner's call (2026-10-01):
 * show the MOST RECENT lot that DID record one, not an average - one real number from
 * one real lot, not a statistic.
 *
 * PER MACHINE, not just per process (2026-10-01 follow-up): one (CN, process) commonly
 * runs on several machines - measured live, ~65% of all (CN, process) pairs in
 * pc_production run on 2+ distinct machines, with genuinely different cycle times
 * between them (e.g. CGM-04/CGM-07/CGM-13 giving 6/9/11s for the same CN+process). The
 * PDF is printed for ONE specific machine, so the cross-machine "latest lot overall"
 * could print a different machine's number on this sheet - `fetchActualCycleTime`
 * therefore groups by machine too, resolved to the same display name Machine History
 * chips use (`rodpc.m_machine` base, `sds_machine_code` override — mirrors
 * `sdsV2AdminController.buildMachineResolver`'s `nameOf`, minus the type-code half this
 * doesn't need), so the PDF and the page's per-machine tooltip can both ask for ONE
 * machine's own value and never silently borrow another machine's number.
 *
 * Pools are passed in (never imported directly) so this stays test-safe: requiring the
 * real instance/eng_db or instance/instance modules opens a live Postgres connection at
 * import time, which hangs Jest when nothing mocks them (hit this live while building
 * the feature — a 3-pool direct-import version stalled every test that transitively
 * requires sdsV2SearchService). `engPool` is optional and the resolver fails open to
 * rodpc's base name alone when it is omitted — degraded (misses the sparse
 * sds_machine_code overrides, e.g. HI-GRIND/CGM) but never throws or hangs.
 *
 * `fetchActualCycleTime` is the one query, shared by the SDS page (via GET
 * /cn-history: `flat` = cross-machine for the summary column, `byMachine` = per machine
 * for the Machine History tooltip) and the PDF's CYCLE TIME cell (via
 * sdsV2SearchService -> sdsV2HeadlessController, which reads ONLY the printed
 * machine's own entry) - every consumer sees the same underlying rows.
 */

const { TABLES } = require('../mtcConstants');
const cnFormat = require('../utils/cnFormat');

// Floor machine_code -> display name. Same precedence as buildMachineResolver.nameOf:
// rodpc base, sds_machine_code override wins. Cached per rodpcPool/engPool pair - this
// rarely changes and every search would otherwise re-fetch it.
const MAP_TTL_MS = 5 * 60 * 1000;
let _nameMapCache = null; // { at, nameOf }

async function _getNameOf(rodpcPool, engPool) {
  if (_nameMapCache && Date.now() - _nameMapCache.at < MAP_TTL_MS) return _nameMapCache.nameOf;
  const [rodpcRes, overrideRes] = await Promise.all([
    rodpcPool
      ? rodpcPool.query(
          `SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine
            WHERE m_model IS NOT NULL AND TRIM(m_model) <> ''`
        ).catch(() => ({ rows: [] }))
      : { rows: [] },
    engPool
      ? engPool.query(`SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`).catch(() => ({ rows: [] }))
      : { rows: [] },
  ]);
  const baseName = new Map();
  for (const r of rodpcRes.rows) if (r.m_model) baseName.set(r.machine_code, r.m_model);
  const overrideName = new Map();
  for (const r of overrideRes.rows) if (r.machine_name) overrideName.set(r.machine_code, r.machine_name);
  const nameOf = (code) => overrideName.get(code) || baseName.get(code) || code;
  _nameMapCache = { at: Date.now(), nameOf };
  return nameOf;
}

async function _queryRows(maqPool, cn) {
  const itemNo = cnFormat.toItemNo(cn);
  if (!itemNo) return [];
  try {
    // pc_production.control_no is item-no form, sometimes with a trailing "-C".
    const { rows } = await maqPool.query(
      `SELECT machine, process, lot_no, cycle_time, comp_date AS last_date
         FROM ${TABLES.LPB_PC_PRODUCTION}
        WHERE (control_no = $1 OR control_no LIKE $1 || '-%') AND cycle_time > 0
        ORDER BY process, comp_date DESC, lot_no DESC`,
      [itemNo]
    );
    return rows;
  } catch (_) {
    return []; // production DB unavailable → caller treats as "no actual data", never throws
  }
}

/**
 * @param {Array<{process:string, cycle_time:string|number, lot_no?:string|null,
 *                 last_date?:string|Date|null}>} rows
 *   ordered so the first row seen for a process is the one to keep (the caller's query
 *   already sorts by comp_date DESC, lot_no DESC - duplicates per process are tolerated,
 *   not required to be pre-deduped).
 * @returns {Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>}
 *   a process missing from the map means no lot ever recorded one - show "-", never 0.
 */
function summarizeCycleTime(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r || r.process == null || r.process === '') continue;
    const proc = String(r.process).trim();
    if (out[proc]) continue; // keep the first (latest) seen
    const ct = Number(r.cycle_time);
    if (!Number.isFinite(ct) || ct <= 0) continue; // defensive - the SQL should already filter this
    out[proc] = { ct, lotNo: r.lot_no || null, lastDate: r.last_date || null };
  }
  return out;
}

/**
 * Same as {@link summarizeCycleTime} but keyed by (process, machine display name) -
 * one machine's own latest lot never borrows another machine's number.
 * @param {Array} rows  same shape as summarizeCycleTime, plus `machine` (floor code)
 * @param {(code:string) => string} nameOf  floor code -> display name
 * @returns {Object<string, Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>>}
 */
function groupCycleTimeByMachine(rows, nameOf) {
  const out = {};
  for (const r of rows || []) {
    if (!r || r.process == null || r.process === '') continue;
    const proc = String(r.process).trim();
    const machineName = (nameOf ? nameOf(r.machine) : r.machine) || 'Unknown';
    if (!out[proc]) out[proc] = {};
    if (out[proc][machineName]) continue; // keep the first (latest) seen for this machine
    const ct = Number(r.cycle_time);
    if (!Number.isFinite(ct) || ct <= 0) continue;
    out[proc][machineName] = { ct, lotNo: r.lot_no || null, lastDate: r.last_date || null };
  }
  return out;
}

/**
 * @param {{maqPool:{query:Function}, rodpcPool?:{query:Function}, engPool?:{query:Function}}} pools
 *   `maqPool` is required (that's where pc_production lives); `rodpcPool`/`engPool` are
 *   used only to resolve floor codes to display names and degrade gracefully if omitted.
 * @param {string} cn  any accepted CN shape (item-no, Cxx-0YYYY, with -C suffix)
 * @returns {Promise<{
 *   flat: Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>,
 *   byMachine: Object<string, Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>>
 * }>}
 *   both empty when the CN shape is unrecognized or the production source is
 *   unavailable (fail-open, mirroring productionHistoryService.getProducedMachines).
 */
async function fetchActualCycleTime({ maqPool, rodpcPool, engPool } = {}, cn) {
  const rows = await _queryRows(maqPool, cn);
  if (!rows.length) return { flat: {}, byMachine: {} };
  const flat = summarizeCycleTime(rows);
  const nameOf = await _getNameOf(rodpcPool, engPool);
  const byMachine = groupCycleTimeByMachine(rows, nameOf);
  return { flat, byMachine };
}

module.exports = {
  summarizeCycleTime, groupCycleTimeByMachine, fetchActualCycleTime,
  _clearCache: () => { _nameMapCache = null; },
};
