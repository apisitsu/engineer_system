'use strict';

const searchService = require('../services/searchService');
const productionHistoryService = require('../services/productionHistoryService');

const search = async (req, res) => {
  const { cn } = req.body;
  if (!cn?.toString().trim()) {
    return res.status(400).json({ success: false, error: 'cn (CN number) is required' });
  }
  try {
    const result = await searchService.search(cn.toString().trim(), { user_empno: req.user?.empno ?? null });
    if (!result.success) return res.status(404).json(result);

    // Hard-filter results to machines that actually PRODUCED this CN
    // (lpb.pc_production). Tooling Select results carry no process_code, so the
    // filter is machine-level here (machine+process granularity applies on the
    // SDS side, whose blocks are per process). Applied only in this user-facing
    // controller — the shared searchService stays unfiltered for the coverage
    // report / SDS overlay that call it via tselectFallback.
    await applyProductionFilter(result, cn);

    res.json(result);
  } catch (err) {
    console.error('tsv2 search error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

async function applyProductionFilter(result, cn) {
  const produced = await productionHistoryService.getProducedMachines(cn);
  // Production source unavailable / CN shape unparseable → fail-open (no filter),
  // so a maqPool outage never silently empties every search.
  if (!produced) {
    result.productionFilter = { applied: false, reason: 'production_source_unavailable' };
    return;
  }

  const before = result.results.length;
  result.results = result.results.filter(r => produced.machineTypes.has(r.machine));

  result.productionFilter = {
    applied: true,
    hadProduction: produced.hasData,
    producedMachines: [...produced.machineTypes],
    removed: before - result.results.length,
  };
}

module.exports = { search };
