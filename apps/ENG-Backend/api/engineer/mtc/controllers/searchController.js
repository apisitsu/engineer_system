'use strict';

const searchService = require('../services/searchService');
const productionHistoryService = require('../services/productionHistoryService');
const { maqPool } = require('../../../../instance/maq_db');
const cnFormat = require('../utils/cnFormat');

const search = async (req, res) => {
  const { cn } = req.body;
  if (!cn?.toString().trim()) {
    return res.status(400).json({ success: false, error: 'cn (CN number) is required' });
  }
  try {
    // withSimilarRef: only the user-facing search renders the "Similar" reference
    // column, so only it pays for the extra per-machine + cross-pool lookups.
    const result = await searchService.search(cn.toString().trim(), {
      user_empno: req.user?.empno ?? null,
      withSimilarRef: true,
    });
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
    // Flag which result machines are in THIS part's factory process plan
    // (lpb.eng_r_pi_tool) vs offered only because the part fits by size. Lets the
    // page split the two so a heavy C/N doesn't render 15 collapsed machines.
    await annotatePlanProcess(result, cn);

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

// 2-segment DWG family of a drawing number: "4664-01-0012" -> "4664-01".
const dwgFamily = (no) => {
  const p = String(no || '').trim().split('-');
  return p.length >= 2 ? `${p[0]}-${p[1]}` : '';
};

// Tag each result with whether the machine's tooling appears in the part's own
// factory process plan, and with the plan process code(s) it sits under. One
// maqPool query, fail-open: on any error `result.planProcess.applied` stays false
// and the page renders the flat machine list exactly as before.
async function annotatePlanProcess(result, cn) {
  const controlNo = cnFormat.toControlNo(cn);
  if (!controlNo || !Array.isArray(result.results)) {
    result.planProcess = { applied: false, reason: 'cn_unparseable' };
    return;
  }
  try {
    const { rows } = await maqPool.query(
      `SELECT DISTINCT process_code,
              split_part(tool_dwg_no, '-', 1) || '-' || split_part(tool_dwg_no, '-', 2) AS fam
         FROM lpb.eng_r_pi_tool
        WHERE process_plan_no = $1
          AND tool_dwg_no IS NOT NULL AND btrim(tool_dwg_no) <> ''`,
      [controlNo]);

    if (!rows.length) {
      // A real plan with no tooled steps, or a model not in the plan yet — either
      // way there is nothing to split on, so leave the flat view.
      result.planProcess = { applied: false, reason: 'no_plan_tooling' };
      return;
    }

    const famProc = new Map();          // fam -> Set(process_code)
    for (const r of rows) {
      if (!r.fam) continue;
      if (!famProc.has(r.fam)) famProc.set(r.fam, new Set());
      if (r.process_code) famProc.get(r.fam).add(String(r.process_code).trim());
    }
    const planFamilies = new Set(famProc.keys());

    let inPlanCount = 0;
    for (const res of result.results) {
      const fams = new Set();
      if (/^\d{4}-\d{2}/.test(res.tooling || '')) fams.add(String(res.tooling).slice(0, 7));
      for (const m of res.matches || []) {
        const f = dwgFamily(m.tooling_no || m.tool_dwg_no || m.dwg);
        if (f) fams.add(f);
      }
      const hit = [...fams].filter((f) => planFamilies.has(f));
      res.planInPlan = hit.length > 0;
      if (res.planInPlan) inPlanCount += 1;
      const pcs = new Set();
      for (const f of hit) for (const pc of famProc.get(f)) pcs.add(pc);
      res.planProcessCodes = [...pcs].sort();
    }

    result.planProcess = {
      applied: true,
      processCodes: [...new Set(rows.map((r) => String(r.process_code || '').trim()).filter(Boolean))].sort(),
      inPlanResults: inPlanCount,
    };
  } catch (err) {
    console.warn(`[tselect] plan-process annotate skipped for ${cn}: ${err.message}`);
    result.planProcess = { applied: false, reason: 'plan_source_unavailable' };
  }
}

module.exports = { search };
