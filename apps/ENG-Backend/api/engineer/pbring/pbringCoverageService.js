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
 * exists in pbring_sds_param / pbring_sds_condition. No external DB calls
 * (maqPool/rodpcPool) — unlike buildPbRingValueMap, which is NOT reused
 * here on purpose: calling it per-row for a sweep of every PB Ring combo
 * would be hundreds of factory look-ups per report build. Bulk SQL only.
 *
 * Merged into the real /coverage response by sdsV2ReportController.js's
 * mergeInPbRingCoverage() — this module only produces rows, it does not
 * touch the cache, the DB-persisted coverage payload, Auto Stamp or the
 * Kanban backlog intake (those all still see real-only data).
 */

const { engPool } = require('../../../instance/eng_db');
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
       (mt.grid_template_id IS NOT NULL) AS has_machine_template,
       COALESCE(t.has_tooling_match, false) AS has_tooling_match,
       COALESCE(a.stamped_full, false) AS stamped_full,
       mn.machine
  FROM combos c
  LEFT JOIN pbring_machine_type mt ON mt.machine_type_name = c.mc_key AND mt.is_active
  LEFT JOIN tooling  t ON t.mc_key = c.mc_key AND t.cn = c.cn AND t.process_code = c.process_code
  LEFT JOIN approval a ON a.mc_key = c.mc_key AND a.cn = c.cn AND a.process_code = c.process_code
  LEFT JOIN machine_names mn ON mn.mc_key = c.mc_key AND mn.cn = c.cn AND mn.process_code = c.process_code
`;

/**
 * @param {(r) => {coverage_level, coverage_level_saved, pending_reason}} classifyCoverage
 *   Passed in rather than required directly, so this module never needs to
 *   `require()` the report controller (which boots an express Router at
 *   module load) just to reach one pure function.
 */
async function buildPbRingCoverageRows(classifyCoverage) {
  const { rows } = await engPool.query(COMBOS_SQL);

  return rows.map((r) => {
    // machine_type_name is the DISPLAY name (e.g. "KVD-300CRII"), not the
    // mc_key ("KVD300") — it has to match the real report's own
    // machine_type_name spelling so the dedup key in mergeInPbRingCoverage
    // actually collides for a name-sharing machine ("PB Ring wins", the
    // same rule SdsV2Page.jsx's picker and the public PDF link both use).
    const base = {
      cn: cnFormat.toControlNo(r.cn) || r.cn,
      part_type: partTypeFromItemNo(r.cn),
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
    };
    const classified = classifyCoverage(base);
    return { ...base, ...classified, coverage_level_saved: classified.coverage_level };
  });
}

module.exports = { buildPbRingCoverageRows, partTypeFromItemNo };
