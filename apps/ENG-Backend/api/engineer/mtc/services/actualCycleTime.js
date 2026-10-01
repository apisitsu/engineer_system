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
 * one real lot, not a statistic. The caller's SQL does the ORDER BY / DISTINCT ON;
 * this module only shapes the result into a `process -> value` map.
 *
 * `fetchLatestActualCycleTime` is the one query, shared by the SDS page's Process Info
 * column (via GET /cn-history) and the PDF's CYCLE TIME cell (via sdsV2SearchService ->
 * sdsV2HeadlessController) - both must print the same number for the same (CN, process).
 */

const { TABLES } = require('../mtcConstants');
const cnFormat = require('../utils/cnFormat');

/**
 * @param {Array<{process:string, lot_no:string|null, cycle_time:string|number,
 *                 last_date:string|Date|null}>} rows
 *   one row per process_code - the caller's query already picked the latest lot with
 *   cycle_time > 0 (DISTINCT ON (process) ... WHERE cycle_time > 0 ORDER BY comp_date DESC)
 * @returns {Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>}
 *   a process missing from the map means no lot ever recorded one - show "-", never 0.
 */
function summarizeCycleTime(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!r || r.process == null || r.process === '') continue;
    const ct = Number(r.cycle_time);
    if (!Number.isFinite(ct) || ct <= 0) continue; // defensive - the SQL should already filter this
    out[String(r.process).trim()] = { ct, lotNo: r.lot_no || null, lastDate: r.last_date || null };
  }
  return out;
}

/**
 * @param {{query: Function}} maqPool
 * @param {string} cn  any accepted CN shape (item-no, Cxx-0YYYY, with -C suffix)
 * @returns {Promise<Object<string, {ct:number, lotNo:string|null, lastDate:string|null}>>}
 *   {} when the CN shape is unrecognized or the production source is unavailable
 *   (fail-open, mirroring productionHistoryService.getProducedMachines).
 */
async function fetchLatestActualCycleTime(maqPool, cn) {
  const itemNo = cnFormat.toItemNo(cn);
  if (!itemNo) return {};
  try {
    // pc_production.control_no is item-no form, sometimes with a trailing "-C".
    const { rows } = await maqPool.query(
      `SELECT DISTINCT ON (process) process, lot_no, cycle_time, comp_date AS last_date
         FROM ${TABLES.LPB_PC_PRODUCTION}
        WHERE (control_no = $1 OR control_no LIKE $1 || '-%') AND cycle_time > 0
        ORDER BY process, comp_date DESC, lot_no DESC`,
      [itemNo]
    );
    return summarizeCycleTime(rows);
  } catch (_) {
    return {}; // production DB unavailable → caller treats as "no actual data", never throws
  }
}

module.exports = { summarizeCycleTime, fetchLatestActualCycleTime };
