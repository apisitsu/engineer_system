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

    // Annotate (do NOT remove) each result with whether the machine actually
    // PRODUCED this CN (lpb.pc_production). Previously this hard-removed machines
    // with no production history — but that hid every result for a brand-new model
    // (never produced anywhere), so the engineer couldn't see what tooling it could
    // use. Now we keep all results and flag `producedHistory`; the UI de-emphasises
    // (collapses + greys) the no-history machines so the view stays uncluttered
    // while new models remain visible. Tooling Select carries no process_code, so
    // the flag is machine-level. Applied only in this user-facing controller — the
    // shared searchService stays unannotated for the coverage report / SDS overlay
    // that call it via tselectFallback.
    await applyProductionFilter(result, cn);

    res.json(result);
  } catch (err) {
    console.error('tsv2 search error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

async function applyProductionFilter(result, cn) {
  const produced = await productionHistoryService.getProducedMachines(cn);
  // Production source unavailable / CN shape unparseable → fail-open (no flag),
  // so a maqPool outage never mislabels every machine as "no history". Leaving
  // producedHistory undefined makes the UI treat each machine as normal.
  if (!produced) {
    result.productionFilter = { applied: false, reason: 'production_source_unavailable' };
    return;
  }

  // Keep every result; just flag which machines have real production history.
  let withHistory = 0;
  for (const r of result.results) {
    r.producedHistory = produced.machineTypes.has(r.machine);
    if (r.producedHistory) withHistory++;
  }

  result.productionFilter = {
    applied: true,
    hadProduction: produced.hasData,   // false = brand-new model (never produced)
    producedMachines: [...produced.machineTypes],
    machinesWithHistory: withHistory,
    machinesWithoutHistory: result.results.length - withHistory,
  };
}

module.exports = { search };
