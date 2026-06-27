'use strict';

/**
 * Production-history lookup for a single CN.
 *
 * Answers "which machines (and machine+process pairs) actually PRODUCED this CN"
 * from `lpb.pc_production`, with the floor machine codes resolved to the
 * Tooling Select / SDS machine TYPE names (and grouped display names) so the
 * resulting sets can be matched directly against search results.
 *
 * Used to hard-filter Tooling Select results to machines with real production
 * history (machine+process is only meaningful for SDS, whose results are keyed
 * per process_code; Tooling Select results carry no process, so callers there
 * filter at machine level).
 *
 * Mirrors the machine-code → type-name resolution already used by the SDS
 * coverage report (sdsV2ReportController): rodpc.m_machine base + sds_machine_code
 * override + sds_machine_type_code group collapse.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const cnFormat = require('../utils/cnFormat');

// Machine master (floor code → type name, group resolution) changes rarely;
// cache the resolved maps so we don't re-query three tables on every search.
const MAP_TTL_MS = 5 * 60 * 1000;
let _mapCache = null; // { at, machineCodeMap, displayGroup }

async function _getMachineMaps() {
  if (_mapCache && Date.now() - _mapCache.at < MAP_TTL_MS) return _mapCache;

  const [rodpcRes, overrideRes, typeRes] = await Promise.all([
    rodpcPool.query(
      `SELECT machine_code, TRIM(m_model) AS m_model
         FROM m_machine
        WHERE m_model IS NOT NULL AND TRIM(m_model) <> ''`
    ).catch(() => ({ rows: [] })),
    engPool.query(
      `SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`
    ).catch(() => ({ rows: [] })),
    engPool.query(
      `SELECT machine_type_name, machine_group FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE is_active`
    ).catch(() => ({ rows: [] })),
  ]);

  // floor machine_code → machine_type_name (rodpc base, sds_machine_code wins)
  const machineCodeMap = {};
  for (const r of rodpcRes.rows) if (r.m_model) machineCodeMap[r.machine_code] = r.m_model;
  for (const r of overrideRes.rows) machineCodeMap[r.machine_code] = r.machine_name;

  // machine_type_name → machine_group display label. A CN produced on KS-400B2
  // must match a Tooling Select result labeled "KS-400B1/B2/B7", so collapse
  // grouped members to the group name. Non-grouped names map to themselves.
  const nameToGroup = {};
  for (const r of typeRes.rows) if (r.machine_group) nameToGroup[r.machine_type_name] = r.machine_group;
  const displayGroup = (name) => (name && nameToGroup[name]) ? nameToGroup[name] : name;

  _mapCache = { at: Date.now(), machineCodeMap, displayGroup };
  return _mapCache;
}

/**
 * @param {string} cn  any accepted CN shape (item-no, Cxx-0YYYY, with -C suffix)
 * @returns {Promise<null | {
 *   machineTypes: Set<string>,          // produced machine type / group names
 *   machineProcessPairs: Set<string>,   // `${typeOrGroup}||${process_code}`
 *   hasData: boolean                    // false = CN found-shape but never produced
 * }>}  null = production source unavailable / unparseable CN → caller may fail-open.
 */
async function getProducedMachines(cn) {
  const itemNo = cnFormat.toItemNo(cn);
  if (!itemNo) return null;

  let prodRows;
  try {
    // pc_production.control_no is item-no form, sometimes with a trailing "-C".
    const r = await maqPool.query(
      `SELECT DISTINCT machine, process
         FROM ${TABLES.LPB_PC_PRODUCTION}
        WHERE machine IS NOT NULL
          AND (control_no = $1 OR control_no LIKE $1 || '-%')`,
      [itemNo]
    );
    prodRows = r.rows;
  } catch (_) {
    return null; // production DB unavailable → let caller decide (fail-open)
  }

  const { machineCodeMap, displayGroup } = await _getMachineMaps();

  const machineTypes = new Set();
  const machineProcessPairs = new Set();
  for (const row of prodRows) {
    const typeName = displayGroup(machineCodeMap[row.machine] || row.machine);
    machineTypes.add(typeName);
    if (row.process != null && row.process !== '') {
      machineProcessPairs.add(`${typeName}||${String(row.process).trim()}`);
    }
  }

  return { machineTypes, machineProcessPairs, hasData: prodRows.length > 0 };
}

module.exports = { getProducedMachines, _clearCache: () => { _mapCache = null; } };
