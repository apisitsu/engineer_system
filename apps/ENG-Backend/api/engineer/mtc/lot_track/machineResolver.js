'use strict';

/**
 * Floor machine code -> a human label, for the Lot Status Tracker.
 *
 * Production steps in `lpb.pc_production` carry codes like `SBM-04`, `OVN-07`, `QC2`
 * (sandblast machine, oven, QC bench) — not grinder type-names. `rodpc.m_machine` is
 * the master for all of them; `sds_machine_code` overrides for the curated SDS
 * spellings where one exists. This mirrors the resolver chain in
 * `productionHistoryService._getMachineMaps` but keeps this module free-standing.
 *
 * Fail-open: if either master cannot be read the raw code is used as the label.
 */

const { engPool } = require('../../../../instance/eng_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES: MTC_TABLES } = require('../mtcConstants');

const MAP_TTL_MS = 5 * 60 * 1000;
let _cache = null; // { at, byCode: Map<code, label> }

async function _load() {
  if (_cache && Date.now() - _cache.at < MAP_TTL_MS) return _cache;

  const [rodpc, sds] = await Promise.all([
    rodpcPool.query(
      `SELECT machine_code,
              TRIM(m_model)        AS m_model,
              TRIM(m_name)         AS m_name,
              TRIM(m_section_name) AS section
         FROM m_machine`
    ).catch(() => ({ rows: [] })),
    engPool.query(
      `SELECT machine_code, machine_name FROM ${MTC_TABLES.SDS_MACHINE_CODE}`
    ).catch(() => ({ rows: [] })),
  ]);

  const byCode = new Map();
  for (const r of rodpc.rows) {
    const label = r.m_name || r.m_model || r.machine_code;
    byCode.set(r.machine_code, { label, section: r.section || null });
  }
  for (const r of sds.rows) {
    if (!r.machine_name) continue;
    const prev = byCode.get(r.machine_code) || {};
    byCode.set(r.machine_code, { label: String(r.machine_name).trim(), section: prev.section || null });
  }

  _cache = { at: Date.now(), byCode };
  return _cache;
}

/**
 * @param {string[]} codes
 * @returns {Promise<Map<string, {label:string, section:string|null}>>}
 *          Every input code is present in the map; unknown codes map to themselves.
 */
async function resolveMachines(codes) {
  const want = [...new Set((codes || []).filter(Boolean).map(String))];
  const out = new Map();
  if (!want.length) return out;
  let byCode = new Map();
  try { ({ byCode } = await _load()); } catch (_) { /* fail-open */ }
  for (const c of want) out.set(c, byCode.get(c) || { label: c, section: null });
  return out;
}

module.exports = { resolveMachines, _clearCache: () => { _cache = null; } };
