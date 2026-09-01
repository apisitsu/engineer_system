'use strict';

/**
 * "Has this CN actually been produced on this machine?" — the factory-plan answer
 * key used to SOFTEN a size-limit exclusion.
 *
 * `tooling_machine_limit` is the DESIGN authority (the RE330 work-size standards).
 * The factory floor is the ANSWER KEY: if `lpb.pc_production` shows a control number
 * was genuinely run on a machine, the part fits — the standard is what needs
 * revising, not the run. `searchService` consults this to downgrade an over-limit
 * machine from EXCLUDED (`type:'limit'`, toolings not searched at all) to an
 * advisory (`type:'limit_note'`, searched normally) when the plan disagrees. This is
 * the same "factory-first" pattern as `noJigRule._factoryPlansJig`.
 *
 * FAILS CLOSED. If production history can't be read (maqdb or rodpc down), the limit
 * stays a HARD exclusion — a design rule is not softened on missing evidence.
 *
 * The returned identifiers are `machine_group || machine_name` per produced floor
 * code, i.e. the exact `displayName` key `searchService.search()` and
 * `limitExcludedMachines()` use for a machine, so a caller checks membership with a
 * plain `set.has(displayName)`.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const cnFormat = require('../utils/cnFormat');

// Only production this recent counts as evidence — a decade-old lot on a
// since-retired setup does not prove the current machine runs the part. Matches the
// SDS coverage report's own production cutoff.
const SINCE = '2023-01-01';

// A SINGLE ancient one-off run is not evidence the machine "runs" the part — it may
// have been an emergency, a mis-logged machine code, or a lot that failed QC and was
// never linked back. So a machine only softens a size limit when the plan shows real,
// sustained use:
//   • at least MIN_LOTS production records since SINCE, OR
//   • any run within the last RECENT_MONTHS (a current setup counts even at one lot).
const MIN_LOTS = 3;
const RECENT_MONTHS = 18;

// floor machine_code → the machine's display identifier (`machine_group` when it
// belongs to one, else `machine_name`). rodpc.m_machine.m_model is the base name
// for every floor machine; sds_machine_code overrides for curated SDS spellings;
// sds_machine_type_code supplies the group label. Mirrors the resolver chain in
// sdsV2AdminController.buildMachineResolver / sdsV2ReportController.
let _codeMap = null;
let _codeMapAt = 0;
const MAP_TTL_MS = 30 * 60 * 1000;

async function codeToDisplayName() {
  if (_codeMap && Date.now() - _codeMapAt < MAP_TTL_MS) return _codeMap;
  const [rodpc, sds, grp] = await Promise.all([
    rodpcPool.query(
      `SELECT machine_code, TRIM(m_model) AS name FROM m_machine
        WHERE m_model IS NOT NULL AND TRIM(m_model) <> ''`
    ).catch(() => ({ rows: [] })),
    engPool.query(
      `SELECT machine_code, machine_name FROM sds_machine_code
        WHERE machine_name IS NOT NULL AND TRIM(machine_name) <> ''`
    ).catch(() => ({ rows: [] })),
    engPool.query(
      `SELECT machine_type_name, machine_group FROM sds_machine_type_code
        WHERE machine_group IS NOT NULL AND machine_type_name IS NOT NULL`
    ).catch(() => ({ rows: [] })),
  ]);

  const nameByCode = new Map();
  for (const r of rodpc.rows) nameByCode.set(r.machine_code, r.name);
  for (const r of sds.rows) nameByCode.set(r.machine_code, String(r.machine_name).trim()); // override wins
  const groupByName = new Map();
  for (const r of grp.rows) groupByName.set(r.machine_type_name, r.machine_group);

  const out = new Map();
  for (const [code, name] of nameByCode) out.set(code, groupByName.get(name) || name);

  // Cache only a populated map — an all-failed load must not stick for the TTL.
  if (out.size) { _codeMap = out; _codeMapAt = Date.now(); }
  return out;
}

// specCn → { at, names:Set<displayName> }
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * The machine display-names (`machine_group || machine_name`) this CN has SUSTAINED
 * production history on (>= {@link MIN_LOTS} lots since {@link SINCE}, or any lot in
 * the last {@link RECENT_MONTHS} months). Empty Set on any failure — the caller then
 * keeps every over-limit machine hard-excluded.
 *
 * @param {string} cn  CN in any form
 * @returns {Promise<Set<string>>}
 */
async function producedMachineNames(cn) {
  const key = cnFormat.toSpecCn(cn) || String(cn).trim();
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.names;

  const names = new Set();
  try {
    const item = cnFormat.toItemNo(key) || key;
    const recentCutoff = new Date();
    recentCutoff.setMonth(recentCutoff.getMonth() - RECENT_MONTHS);
    const [prod, map] = await Promise.all([
      maqPool.query(
        `SELECT machine, count(*)::int AS n, max(comp_date) AS last_date
           FROM lpb.pc_production
          WHERE (control_no = $1 OR control_no LIKE $2)
            AND machine IS NOT NULL AND machine <> '' AND comp_date >= $3
          GROUP BY machine`,
        [item, `${item}-%`, SINCE]
      ),
      codeToDisplayName(),
    ]);
    for (const r of prod.rows) {
      const sustained = r.n >= MIN_LOTS
        || (r.last_date && new Date(r.last_date) >= recentCutoff);
      if (!sustained) continue;
      const n = map.get(r.machine);
      if (n) names.add(n);
    }
  } catch (_) { /* fail closed — leave `names` empty */ }

  _cache.set(key, { at: Date.now(), names });
  return names;
}

function _clearCache() {
  _cache.clear();
  _codeMap = null;
  _codeMapAt = 0;
}

module.exports = { producedMachineNames, _clearCache, SINCE, MIN_LOTS, RECENT_MONTHS };
