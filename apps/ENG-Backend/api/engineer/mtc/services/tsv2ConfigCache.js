'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');

/**
 * In-memory snapshot of the (rarely-changed) Tooling Select config tables:
 * machines, machine limits, formulas, and search rules.
 *
 * Why: a single CN search fans out over machines × toolings, re-querying these
 * config tables per combination (~2 + 2M + 3·M·T queries). The coverage report
 * runs that for hundreds of CNs → hundreds of thousands of identical config
 * queries. One snapshot serves an entire search AND the whole report batch.
 *
 * Staleness is bounded by TTL_MS, and flush() forces an immediate reload — the
 * admin mutation routes call it on save so edits are reflected at once. We cache
 * config ONLY; inventory tables (the actual search target) are never cached.
 */
const TTL_MS = 60 * 1000;

let _cache   = null;   // built snapshot (see _load)
let _loading = null;   // in-flight load promise — dedupes concurrent cold callers

async function _load() {
  const [machines, limits, formulas, rules] = await Promise.all([
    engPool.query(`SELECT * FROM ${TSV2_TABLES.MACHINE} WHERE enabled = true ORDER BY machine_name ASC`),
    engPool.query(`SELECT * FROM ${TSV2_TABLES.LIMIT} ORDER BY machine_id ASC, sort_order ASC, id ASC`),
    engPool.query(`SELECT * FROM ${TSV2_TABLES.FORMULA} ORDER BY machine_id ASC, sort_order ASC, id ASC`),
    engPool.query(`SELECT * FROM ${TSV2_TABLES.SEARCH_RULE} ORDER BY machine_id ASC, sort_priority ASC, id ASC`),
  ]);

  // machine_id → limit rows (already in sort_order, id order)
  const limitsByMachine = new Map();
  for (const r of limits.rows) {
    if (!limitsByMachine.has(r.machine_id)) limitsByMachine.set(r.machine_id, []);
    limitsByMachine.get(r.machine_id).push(r);
  }

  // `${machine_id}||${tooling_name}` → formula rows (sort_order, id order);
  // plus machine_id → distinct tooling names (sorted, == old DISTINCT … ORDER BY)
  const formulasByKey      = new Map();
  const toolingSetByMachine = new Map();
  for (const r of formulas.rows) {
    const key = `${r.machine_id}||${r.tooling_name}`;
    if (!formulasByKey.has(key)) formulasByKey.set(key, []);
    formulasByKey.get(key).push(r);
    if (!toolingSetByMachine.has(r.machine_id)) toolingSetByMachine.set(r.machine_id, new Set());
    toolingSetByMachine.get(r.machine_id).add(r.tooling_name);
  }
  const toolingNamesByMachine = new Map();
  for (const [mid, set] of toolingSetByMachine) toolingNamesByMachine.set(mid, [...set].sort());

  // `${machine_id}||${tooling_name}` → search rule rows (sort_priority, id order)
  const rulesByKey = new Map();
  for (const r of rules.rows) {
    const key = `${r.machine_id}||${r.tooling_name}`;
    if (!rulesByKey.has(key)) rulesByKey.set(key, []);
    rulesByKey.get(key).push(r);
  }

  return { at: Date.now(), machines: machines.rows, limitsByMachine, formulasByKey, toolingNamesByMachine, rulesByKey };
}

async function _get() {
  if (_cache && (Date.now() - _cache.at) < TTL_MS) return _cache;
  if (!_loading) {
    _loading = _load()
      .then(snap => { _cache = snap; _loading = null; return snap; })
      .catch(err => { _loading = null; throw err; });
  }
  return _loading;
}

const getMachines     = async ()                      => (await _get()).machines;
const getLimits       = async (machineId)             => (await _get()).limitsByMachine.get(machineId) || [];
const getToolingNames = async (machineId)             => (await _get()).toolingNamesByMachine.get(machineId) || [];
const getFormulas     = async (machineId, toolingName) => (await _get()).formulasByKey.get(`${machineId}||${toolingName}`) || [];
const getSearchRules  = async (machineId, toolingName) => (await _get()).rulesByKey.get(`${machineId}||${toolingName}`) || [];

/** Drop the snapshot so the next read reloads from DB (called on config mutations). */
function flush() { _cache = null; _loading = null; }

module.exports = { getMachines, getLimits, getToolingNames, getFormulas, getSearchRules, flush, TTL_MS };
