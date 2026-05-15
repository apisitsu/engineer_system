'use strict';

const SpecAgent    = require('./agents/SpecAgent');
const FormulaAgent = require('./agents/FormulaAgent');
const cache        = require('./agents/CacheAgent');
const monitor      = require('./agents/MonitorAgent');
const { buildCalcMap }                    = require('./partDataMapper');
const { computeOkFlags, fetchToolingRows } = require('./machineQueryService');
const { assembleResults, MAX_JAW_DEPTH }  = require('./fixtureAssembler');
const { findDynamicFixtures }             = require('./dynamicLogic');

// Legacy machines whose formulas are stored in tooling_formula.
// Order is not significant — all run in parallel.
const LEGACY_MACHINES = [
  'KS-B22G',
  'TSG-300ZNC',
  'KS400B',
  'KS-03A',
  'KS500RD',
  'KS-400B5',
  'KS400B6',
];

async function findFixtures(cnNumber) {
  const start    = Date.now();
  const cacheKey = `tooling:${String(cnNumber).trim().toUpperCase()}`;
  const cached   = cache.get(cacheKey);
  if (cached) {
    monitor.record('ToolingOrchestrator:cache-hit', 0);
    return { ...cached, _fromCache: true };
  }

  // ── 1. Spec Agent ────────────────────────────────────────────────────────
  const specResult = await new SpecAgent().execute({ cnNumber });
  if (specResult._agentError) return { success: false, error: specResult.error };
  const partData = specResult;

  // ── 2. Formula Swarm — all machines in parallel, partial failure OK ──────
  const formulaSettled = await Promise.allSettled(
    LEGACY_MACHINES.map(m => new FormulaAgent(m).execute({ partData }))
  );

  const dynMap        = {};
  const formulaErrors = {};

  formulaSettled.forEach((r, i) => {
    const m = LEGACY_MACHINES[i];
    if (r.status === 'fulfilled' && !r.value._agentError) {
      dynMap[m] = r.value.result;
    } else {
      const msg = r.reason?.message ?? r.value?.error ?? 'Formula agent failed';
      dynMap[m]        = { error: msg };
      formulaErrors[m] = msg;
    }
  });

  // ── 3. Build adapted calc maps from raw formula outputs ──────────────────
  const calcs = buildCalcMap(
    {
      dynKSB22G:    dynMap['KS-B22G'],
      dynTSG300ZNC: dynMap['TSG-300ZNC'],
      dynKS400B:    dynMap['KS400B'],
      dynKS03A:     dynMap['KS-03A'],
      dynKS500RD:   dynMap['KS500RD'],
      dynKS400B5:   dynMap['KS-400B5'],
      dynKS400B6:   dynMap['KS400B6'],
    },
    partData
  );

  // ── 4. Eligibility check (fast, sequential — depends on calcs) ───────────
  const okFlags = await computeOkFlags(calcs.calc, calcs, partData);

  // ── 5. Search Swarm — legacy SQL + dynamic rules in parallel ─────────────
  const [rows, dynamicFixtures] = await Promise.all([
    fetchToolingRows(okFlags, calcs.calc),
    findDynamicFixtures(
      partData,
      {
        ks400b:  calcs.ks400b_calc,
        ks03a:   calcs.ks03a_calc,
        ks500rd: calcs.ks500rd_calc,
        ks400b5: calcs.ks400b5_calc,
        ks400b6: calcs.ks400b6_calc,
        tsg:     calcs.calc,
        ksb22g:  dynMap['KS-B22G'],
      },
      okFlags
    ),
  ]);

  // ── 6. Assembly ───────────────────────────────────────────────────────────
  const results = assembleResults(rows, okFlags, calcs, partData);
  const calc    = calcs.calc;

  const payload = {
    success: true,
    cn:      String(cnNumber).trim(),
    part:    partData,
    dynamicFixtures,
    exclusionReasons: okFlags._exclusionReasons || {},
    // Surface formula warnings without crashing — caller can show a banner
    ...(Object.keys(formulaErrors).length > 0 && { _formulaWarnings: formulaErrors }),
    calc: {
      A:        calc.jawA.toFixed(3),
      B:        calc.jawB.toFixed(3),
      C:        calc.baseC.toFixed(2),
      D_Limit:  MAX_JAW_DEPTH.toFixed(2),
      AA:       calc.bpAA.toFixed(2),
      BB:       calc.bpBB.toFixed(2),
      chuteA:   calc.chuteCalcA.toFixed(2),
      chuteB:   calc.chuteCalcB.toFixed(2),
      chuteC:   calc.chuteCalcC.toFixed(2),
      chuteD:   calc.chuteCalcD.toFixed(2),
      carrierA: calc.carrierCalcA.toFixed(2),
      carrierB: calc.carrierCalcB.toFixed(2),
      carrierC: calc.carrierCalcC.toFixed(2),
    },
    ...results,
  };

  cache.set(cacheKey, payload, cache.TTL.TOOLING);
  monitor.record('ToolingOrchestrator:full', Date.now() - start);
  return payload;
}

// Expose cache invalidation for use when inventory or formula rows change
function invalidateCache(cnNumber) {
  cache.invalidate(`tooling:${String(cnNumber).trim().toUpperCase()}`);
}

module.exports = { findFixtures, invalidateCache };
