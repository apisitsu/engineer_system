'use strict';

/**
 * PB Ring's own coverage rows — reuses the REAL coverage report's own
 * `classifyCoverage()` (sdsV2ReportController.js) so both speak the exact
 * same COMPLETE/PENDING + pending_reason (NO_TOOL/NO_EXCEL/NO_TOOL_NO_EXCEL/
 * NO_STAMP) vocabulary, confirmed by the user to be the right fit: that
 * function is pure and shape-driven ({has_process, has_tooling_match,
 * has_machine_template, stamped_full} -> {coverage_level, pending_reason}),
 * with no dependency on where the booleans came from.
 *
 * Deliberately NOT a copy of buildCoverage()'s enumeration — that one scans
 * the factory plan x the real machine registry (every CN producing on any
 * registered machine), which is exactly why registering a PB Ring machine
 * into sds_machine_type_code would pollute it for unrelated real CNs (see
 * CLAUDE.md "why strict separation matters"). PB Ring's own universe is
 * already bounded and known: every (cn, mc_key, process_code) combo that
 * exists in pbring_sds_param / pbring_sds_condition, further filtered to
 * ones with real production history (see getProducedComboKeys below).
 * Only ONE bulk maqPool query for that — unlike buildPbRingValueMap, which
 * is NOT reused here on purpose: calling it per-row for a sweep of every
 * PB Ring combo would be hundreds of factory look-ups per report build.
 * Bulk SQL only, same discipline the rest of this codebase uses.
 *
 * Merged into the real /coverage response by sdsV2ReportController.js's
 * mergeInPbRingCoverage() — this module only produces rows, it does not
 * touch the cache, the DB-persisted coverage payload, Auto Stamp or the
 * Kanban backlog intake (those all still see real-only data).
 */

const { engPool } = require('../../../instance/eng_db');
const { maqPool } = require('../../../instance/maq_db');
const cnFormat = require('../mtc/utils/cnFormat');

// Mirrors sdsV2ReportController.js's PART_TYPE_ITEM_PREFIX (not exported —
// small enough to keep a second copy rather than reach into that module for
// a constant object).
function partTypeFromItemNo(itemNo) {
  const d = String(itemNo || '').charAt(0);
  if (d === '3') return 'ball';
  if (d === '2') return 'race';
  if (d === '1' || d === '5') return 'body';
  if (d === '6') return 'sleeve';
  if (d === '9') return 'mecha';
  if (d === '4') return 'spherical';
  return null;
}

const COMBOS_SQL = `
WITH combos AS (
  SELECT DISTINCT mc_key, cn, process_code FROM pbring_sds_param
  UNION
  SELECT DISTINCT mc_key, cn, process_code FROM pbring_sds_condition
),
tooling AS (
  SELECT mc_key, cn, process_code,
         bool_or(COALESCE(trim(tooling_no), '') <> '' OR COALESCE(trim(tool_detail), '') <> '') AS has_tooling_match
    FROM pbring_sds_condition
   GROUP BY mc_key, cn, process_code
),
machine_names AS (
  SELECT DISTINCT ON (mc_key, cn, process_code) mc_key, cn, process_code, machine
    FROM (
      SELECT mc_key, cn, process_code, machine FROM pbring_sds_param WHERE machine IS NOT NULL
      UNION ALL
      SELECT mc_key, cn, process_code, machine FROM pbring_sds_condition WHERE machine IS NOT NULL
    ) x
   ORDER BY mc_key, cn, process_code
),
approval AS (
  SELECT cn, machine_type_name AS mc_key, process_code,
         (prepared_em_id IS NOT NULL AND checked_em_id IS NOT NULL AND approved_em_id IS NOT NULL) AS stamped_full
    FROM pbring_sds_approval
)
SELECT c.mc_key, c.cn, c.process_code,
       -- "Excel Config" for PB Ring requires BOTH: the machine has a PDF
       -- layout assigned (pbring_machine_type.grid_template_id — without
       -- this nothing can render at all, regardless of params), AND the
       -- GRINDING CONDITION values have actually been typed in for THIS
       -- part. The first half is a one-time, near-universal setup step
       -- (true for almost every combo the day a machine is configured) so
       -- it never gated anything per-CN on its own — user finding
       -- (2026-10-11): sheets were reporting NO_STAMP (tool+config ready,
       -- just needs a signature) with zero grinding-condition data
       -- entered. Confirmed live: the row_N_A/row_N_F rows
       -- pbring_sds_parameter carries are the auto-seeded LABELS/UNITS
       -- from the original xlsx import
       -- (updated_by='import:pbring-sds-template-v3.4.2-labels'), not
       -- readings anyone typed in. A real per-CN row (cn IS NOT NULL) only
       -- ever exists from an admin actually entering a value for that
       -- part — confirmed live: 38 such rows exist total, for exactly 1
       -- of 3,416 combos. Scoped the same way resolveManualParamMap
       -- resolves precedence: a process-agnostic override (process_code
       -- IS NULL) counts for every process of that CN.
       (mt.grid_template_id IS NOT NULL) AND EXISTS (
         SELECT 1 FROM pbring_sds_parameter hp
          WHERE hp.cn = c.cn AND hp.machine_type_name = c.mc_key
            AND (hp.process_code IS NULL OR hp.process_code = c.process_code)
       ) AS has_machine_template,
       COALESCE(t.has_tooling_match, false) AS has_tooling_match,
       COALESCE(a.stamped_full, false) AS stamped_full,
       mn.machine
  FROM combos c
  LEFT JOIN pbring_machine_type mt ON mt.machine_type_name = c.mc_key AND mt.is_active
  LEFT JOIN tooling  t ON t.mc_key = c.mc_key AND t.cn = c.cn AND t.process_code = c.process_code
  LEFT JOIN approval a ON a.mc_key = c.mc_key AND a.cn = c.cn AND a.process_code = c.process_code
  LEFT JOIN machine_names mn ON mn.mc_key = c.mc_key AND mn.cn = c.cn AND mn.process_code = c.process_code
`;

// Bulk production-history check — user request (2026-10-11): a combo with no
// real lot ever run on the floor shouldn't count as Pending (or Complete)
// at all, only ones the shop has actually produced. One query for every
// combo in this build, same discipline as the rest of this file (never a
// per-row maqPool round trip). Mirrors productionHistoryService.getProducedMachines's
// own normalization — lpb.pc_production.control_no is the plain item-no form
// and sometimes carries a trailing variant suffix ("350528-C"); split_part
// strips it on both sides of the join so "294065" and "294065-C" match the
// same key. Matches on (cn, process) only, deliberately not machine — PB
// Ring's own machine naming frequently doesn't map to the real floor code.
async function getProducedComboKeys(itemNos) {
  if (!itemNos.length) return new Set();
  const { rows } = await maqPool.query(
    `SELECT DISTINCT split_part(control_no, '-', 1) AS cn, process
       FROM lpb.pc_production
      WHERE process IS NOT NULL
        AND split_part(control_no, '-', 1) = ANY($1)`,
    [itemNos]
  );
  return new Set(rows.map((r) => `${r.cn}||${r.process}`));
}

/**
 * @param {(r) => {coverage_level, coverage_level_saved, pending_reason}} classifyCoverage
 *   Passed in rather than required directly, so this module never needs to
 *   `require()` the report controller (which boots an express Router at
 *   module load) just to reach one pure function.
 */
async function buildPbRingCoverageRows(classifyCoverage) {
  const [{ rows: comboRows }, monitorCns] = await Promise.all([
    engPool.query(COMBOS_SQL),
    getPbRingMonitorCns(),
  ]);

  const producedKeys = await getProducedComboKeys([...new Set(comboRows.map((r) => r.cn))]);
  const rows = comboRows.filter((r) => producedKeys.has(`${r.cn}||${r.process_code}`));

  return rows.map((r) => {
    const cn = cnFormat.toControlNo(r.cn) || r.cn;
    // machine_type_name is the DISPLAY name (e.g. "KVD-300CRII"), not the
    // mc_key ("KVD300") — it has to match the real report's own
    // machine_type_name spelling so the dedup key in mergeInPbRingCoverage
    // actually collides for a name-sharing machine ("PB Ring wins", the
    // same rule SdsV2Page.jsx's picker and the public PDF link both use).
    const base = {
      cn,
      // A CN confirmed on PB Ring's own MONITOR list (pbring_tooling, see
      // getPbRingMonitorCns) gets a dedicated Part Type label instead of
      // the usual Ball/Race/Body/Sleeve/Spherical/Mecha classification —
      // user request (2026-10-11): that list is the authoritative "this is
      // a PB Ring part" confirmation, not just a CN with SDS sheet data
      // filled in (the broader pbring_sds_param/condition universe every
      // row here is actually drawn from). Only ever visible on a row that
      // reaches the merged report at all, i.e. one that got promoted to
      // Complete (mergeInPbRingCoverage) — PB Ring's own Pending rows are
      // never surfaced there.
      part_type: monitorCns.has(cn) ? 'PB Ring Parts' : partTypeFromItemNo(r.cn),
      machine_type_name: r.machine || r.mc_key,
      machine_code: null,
      process_code: r.process_code,
      has_process: true,
      has_tooling_match: r.has_tooling_match,
      tooling_not_required: false,
      has_machine_template: r.has_machine_template,
      stamped_full: r.stamped_full,
      tooling_source: 'pbring',
      limit_excluded: false,
      limit_reason: null,
      first_prod_date: null,
      last_prod_date: null,
      first_month: null,
      _pbring: true,
      _pbRingKey: r.mc_key,
      // Every pbring_* table (including pbring_sds_approval) keys on the
      // plain item-no form — `cn` above is converted to control-no ONLY to
      // match the real report's own dedup key. Using `cn` for a write here
      // was the exact "C29-04065 vs 294065" format mismatch this codebase
      // has already been bitten by once (see pbringGridController.js's own
      // normalizeCn note) — confirmed live: pbringAutoStamp signed 491 rows
      // keyed by control-no, and the approval CTE above (joined on the
      // combos CTE's item-no cn) never matched them, so stamped_full stayed
      // false for all of them despite the rows existing.
      _pbRingCn: r.cn,
    };
    const classified = classifyCoverage(base);
    return { ...base, ...classified, coverage_level_saved: classified.coverage_level };
  });
}

/**
 * The CNs on PB Ring's own monitor list (pbring_tooling — the "Tooling PB
 * Ring" page's Search tab / HW cost-tracking list), NOT the much larger
 * pbring_sds_param/pbring_sds_condition universe every other function in
 * this file reads (36-ish CNs vs ~870 — confirmed live, 2026-10-11). User
 * decision: THIS is the list that says "this CN is a PB Ring part" — once
 * a CN is on it, every process for that CN belongs to PB Ring, not just
 * whichever machine/process pbring_sds_param happens to also have data
 * for. Returned as control-no form (e.g. "C29-04065") to match
 * cohortRows/needsAttention's own cn spelling — pbring_tooling itself
 * stores the plain item-no form like every other pbring_* table.
 */
async function getPbRingMonitorCns() {
  const { rows } = await engPool.query(`SELECT DISTINCT cn FROM pbring_tooling WHERE cn IS NOT NULL`);
  return new Set(rows.map((r) => cnFormat.toControlNo(r.cn) || r.cn));
}

module.exports = { buildPbRingCoverageRows, partTypeFromItemNo, getPbRingMonitorCns };
