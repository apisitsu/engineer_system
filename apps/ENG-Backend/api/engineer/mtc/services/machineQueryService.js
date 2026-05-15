'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

/**
 * Load machine configs from DB, with in-memory cache per process restart.
 * Returns array of config rows. Falls back to [] on DB error.
 */
let _configCache = null;
let _configCacheAt = 0;
const CONFIG_TTL_MS = 30_000; // 30s cache

async function loadMachineConfigs() {
  const now = Date.now();
  if (_configCache && now - _configCacheAt < CONFIG_TTL_MS) return _configCache;
  try {
    const res = await engPool.query(
      `SELECT * FROM ${TABLES.MTC_MACHINE_CONFIG} WHERE is_active = true ORDER BY id`
    );
    _configCache = res.rows;
    _configCacheAt = now;
    return _configCache;
  } catch {
    return _configCache || [];
  }
}

/** Invalidate the cache (call after any machine config mutation). */
function invalidateMachineConfigCache() {
  _configCache = null;
}

/**
 * Evaluate dimension conditions from DB against current calc/partData.
 * Returns { ok: boolean, reason: string|null }.
 */
function evaluateConditions(conditions, calc, partData) {
  const sources = { calc, partData };
  let failReason = null;

  const allMet = (conditions || []).every(cond => {
    const sourceObj = sources[cond.source] || calc;
    const val = parseFloat(sourceObj?.[cond.key]);

    let met;
    switch (cond.op) {
      case '<=': met = val <= cond.value; break;
      case '>=': met = val >= cond.value; break;
      case '<':  met = val <  cond.value; break;
      case '>':  met = val >  cond.value; break;
      case '=':
      case '==': met = val == cond.value; break;
      default:   met = false;
    }

    if (!met && !failReason) {
      const displayed = isNaN(val) ? 'N/A' : val.toFixed(3);
      failReason = `${cond.label || cond.key} = ${displayed} (required: ${cond.op} ${cond.value})`;
    }
    return met;
  });

  return { ok: allMet, reason: allMet ? null : failReason };
}

/**
 * Phase 1: Compute machine eligibility flags.
 * Reads conditions from mtc_machine_config when available; falls back to hardcoded values.
 * Returns okFlags object compatible with legacy callers plus _exclusionReasons map.
 *
 * @param {Object} calc      - calcs.calc (legacy common calc: jawA, bpAA, chuteCalcA ...)
 * @param {Object} calcs     - full calcs map (ks03a_calc, ks400b_calc ...)
 * @param {Object} partData  - normalized part spec (odAft, idAft, wAft ...)
 * @returns {Promise<Object>} okFlags with _exclusionReasons and _machineConfigs
 */
async function computeOkFlags(calc, calcs, partData) {
  const { ks03a_calc, ks400b_calc, ks500rd_calc, ks400b5_calc, ks400b6_calc } = calcs;

  // Hardcoded fallback (keeps backward compatibility if DB table missing)
  const hardcodedFlags = {
    ksb22gOK:  calc.jawA <= 38 && partData.idAft >= 4.8 && partData.idAft < 16 && partData.wAft >= 14,
    ksb80OK:   calc.jawA > 15 && calc.jawA <= 70 && partData.idAft >= 7.9 && partData.wAft >= 14,
    ks03aOK:   partData.odAft <= 33 && !ks03a_calc?.error,
    ks400bOK:  !ks400b_calc?.error,
    ks500rdOK: !ks500rd_calc?.error,
    ks400b5OK: !ks400b5_calc?.error,
    ks400b6OK: !ks400b6_calc?.error,
  };

  const exclusionReasons = {};
  const configs = await loadMachineConfigs();

  if (configs.length === 0) {
    // No DB config: compute reasons from hardcoded defaults
    if (!hardcodedFlags.ksb22gOK) {
      const parts = [];
      if (calc.jawA > 38)          parts.push(`Jaw A = ${calc.jawA.toFixed(3)} > 38`);
      if (partData.idAft < 4.8)    parts.push(`ID After = ${partData.idAft.toFixed(3)} < 4.8`);
      if (partData.idAft >= 16)    parts.push(`ID After = ${partData.idAft.toFixed(3)} >= 16`);
      if (partData.wAft < 14)      parts.push(`Width After = ${partData.wAft.toFixed(3)} < 14`);
      exclusionReasons['KS-B22G'] = parts.join(', ') || 'Out of range';
    }
    if (!hardcodedFlags.ksb80OK) {
      const parts = [];
      if (calc.jawA <= 15 || calc.jawA > 70) parts.push(`Jaw A = ${calc.jawA.toFixed(3)} (need 15–70)`);
      if (partData.idAft < 7.9)  parts.push(`ID After = ${partData.idAft.toFixed(3)} < 7.9`);
      if (partData.wAft < 14)    parts.push(`Width After = ${partData.wAft.toFixed(3)} < 14`);
      exclusionReasons['KS-B80'] = parts.join(', ') || 'Out of range';
    }
    if (!hardcodedFlags.ks03aOK) {
      exclusionReasons['KS-03A'] = ks03a_calc?.error
        ? `Formula error`
        : `OD After = ${partData.odAft?.toFixed(3)} > 33`;
    }
    if (!hardcodedFlags.ks400bOK)  exclusionReasons['KS400B']   = ks400b_calc?.error  ? 'Formula error' : 'Not eligible';
    if (!hardcodedFlags.ks500rdOK) exclusionReasons['KS500RD']  = ks500rd_calc?.error ? 'Formula error' : 'Not eligible';
    if (!hardcodedFlags.ks400b5OK) exclusionReasons['KS-400B5'] = ks400b5_calc?.error ? 'Formula error' : 'Not eligible';
    if (!hardcodedFlags.ks400b6OK) exclusionReasons['KS400B6']  = ks400b6_calc?.error ? 'Formula error' : 'Not eligible';

    return { ...hardcodedFlags, _exclusionReasons: exclusionReasons, _machineConfigs: [] };
  }

  // DB config available — evaluate per-machine
  const flags = {};
  const formulaCalcMap = { ks03a: ks03a_calc, ks400b: ks400b_calc, ks500rd: ks500rd_calc, ks400b5: ks400b5_calc, ks400b6: ks400b6_calc };

  for (const config of configs) {
    const flagKey = config.ok_flag_key || `${config.machine_key}OK`;

    // Check formula evaluation errors (machines that require successful formula run)
    const formulaCalc = formulaCalcMap[config.machine_key];
    if (formulaCalc?.error) {
      flags[flagKey] = false;
      exclusionReasons[config.machine_name] = 'Formula evaluation error';
      continue;
    }

    const { ok, reason } = evaluateConditions(config.conditions, calc, partData);
    flags[flagKey] = ok;
    if (!ok) exclusionReasons[config.machine_name] = reason || 'Dimension out of range';
  }

  // Fill flags not covered by DB config with hardcoded fallback
  for (const [k, v] of Object.entries(hardcodedFlags)) {
    if (!(k in flags)) flags[k] = v;
  }

  return { ...flags, _exclusionReasons: exclusionReasons, _machineConfigs: configs };
}

/**
 * Phase 2: Fetch tooling rows from legacy SQL.
 * When a machine has use_dynamic_rules=true in its config, its legacy SQL is skipped
 * and the dynamic rules engine (dynamicLogic.js) is expected to handle it instead.
 */
async function fetchToolingRows(okFlags, calc) {
  const { ksb22gOK, ksb80OK, ks03aOK, ks400bOK, ks500rdOK, ks400b5OK, ks400b6OK } = okFlags;
  const machineConfigs = okFlags._machineConfigs || [];
  const none = Promise.resolve({ rows: [] });

  // Build lookup of machines delegated to dynamic rules
  const dynamicSet = new Set(
    machineConfigs.filter(c => c.use_dynamic_rules).map(c => c.machine_key)
  );

  const skipLegacy = (key) => dynamicSet.has(key);

  const [ksb22g, ksb80, tsg300, ks03a, ks400b, ks500rd, ks400b5, ks400b6] = await Promise.all([
    (ksb22gOK && !skipLegacy('ksb22g')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KSB22G}
      WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
         OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
      [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA, calc.bpAA + 2.5]
    ) : none,

    (ksb80OK && !skipLegacy('ksb80')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
             dim_d AS "Dim_D", dim_e AS "Dim_E",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KSB80}
      WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
         OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
      [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA - 0.4, calc.bpAA + 3.1]
    ) : none,

    !skipLegacy('tsg300') ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_TSG300}
      WHERE (tooling_name ILIKE '%CHUTE%' AND dim_a BETWEEN $1 AND $2 AND dim_b BETWEEN $3 AND $4)
         OR (tooling_name ILIKE '%CARRIER%' AND dim_a BETWEEN $5 AND $6)`,
      [
        calc.chuteCalcA, calc.chuteCalcA + 1.0,
        calc.chuteCalcB - 0.1, calc.chuteCalcB + 3.0,
        Math.min(calc.carrierCalcA, calc.tsgW_Amin) - 0.1,
        Math.max(calc.carrierCalcA + 1.0, calc.tsgW_Amax) + 0.1,
      ]
    ) : none,

    (ks03aOK && !skipLegacy('ks03a')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", machine AS "Machine"
      FROM ${TABLES.TOOLING_KS03A}
      WHERE tooling_name ILIKE ANY(ARRAY['%ROLLER SHOE%','%CPX SHOE%','%CHUTE COVER%','%FRONT PLATE%',
             '%SETTING GAUGE%','%MASTER RING%','%PLUG GAUGE%','%LOADER%','%ROTOR%'])`) : none,

    (ks400bOK && !skipLegacy('ks400b')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
             dim_d AS "Dim_D", dim_e AS "Dim_E", dim_f AS "Dim_F",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KS400B}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%','%SUPPORT BLOCK%','%CHUTE%','%PLUG%'])`) : none,

    (ks500rdOK && !skipLegacy('ks500rd')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KS500RD}
      WHERE tooling_name ILIKE ANY(ARRAY['%LOADING PINTLE%','%WORK DRIVER%','%FRONT SHOE%'])`) : none,

    (ks400b5OK && !skipLegacy('ks400b5')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
      FROM ${TABLES.TOOLING_KS400B5}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK CLAMP%','%SHAFT%','%WORK CHUTE%','%WORK LOADER%',
             '%WORK CHUCK%','%WORK HOLDER%','%CHUCK JAW%','%CHUTE GUIDE%','%STOPPER%','%MASTER RING%'])`) : none,

    (ks400b6OK && !skipLegacy('ks400b6')) ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
      FROM ${TABLES.TOOLING_KS400B6}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%','%CHUTE%','%PLUG%','%WORK GUIDE%',
             '%WORK PUSHER%','%FRONT SHOE%','%REAR SHOE%','%PILOT PIN%'])`) : none,
  ]);

  return {
    ksb22g:  ksb22g.rows,
    ksb80:   ksb80.rows,
    tsg300:  tsg300.rows,
    ks03a:   ks03a.rows,
    ks400b:  ks400b.rows,
    ks500rd: ks500rd.rows,
    ks400b5: ks400b5.rows,
    ks400b6: ks400b6.rows,
  };
}

module.exports = {
  computeOkFlags,
  fetchToolingRows,
  loadMachineConfigs,
  invalidateMachineConfigCache,
};
