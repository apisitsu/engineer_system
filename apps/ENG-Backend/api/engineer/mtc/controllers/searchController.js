'use strict';

const searchService = require('../services/searchService');
const productionHistoryService = require('../services/productionHistoryService');
const { engPool } = require('../../../../instance/eng_db');
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

// displayName -> Set(process_code) that a T-Select machine is configured for in
// sds_machine_tool. A grouped machine's results carry the group label, so the set
// is the union over the group's members. Small + rarely changes; cached 5 min.
let _smtCache = { at: 0, map: null };
async function machineProcessCodes() {
  if (_smtCache.map && Date.now() - _smtCache.at < 300000) return _smtCache.map;
  const [tm, smt] = await Promise.all([
    engPool.query(`SELECT machine_name, machine_group FROM tooling_machine WHERE enabled`),
    engPool.query(`SELECT DISTINCT machine_type, process_code FROM sds_machine_tool WHERE process_code IS NOT NULL`),
  ]);
  const byName = new Map();
  for (const r of smt.rows) {
    const k = String(r.machine_type);
    if (!byName.has(k)) byName.set(k, new Set());
    byName.get(k).add(String(r.process_code).trim());
  }
  const map = new Map();
  for (const m of tm.rows) {
    const disp = m.machine_group || m.machine_name;
    if (!map.has(disp)) map.set(disp, new Set());
    for (const pc of byName.get(m.machine_name) || []) map.get(disp).add(pc);
  }
  _smtCache = { at: Date.now(), map };
  return map;
}

// Tag each result with whether its machine is in THIS part's factory route, and
// with the process code(s) it sits under. Two signals, both fail-open:
//   1. tool DWG family present in lpb.eng_r_pi_tool for the C/N   (precise, sparse)
//   2. the machine's sds_machine_tool process code is in the C/N's process route
//      (lpb.eng_process_info)                                     (covers routes
//      whose 2071/1011/... steps carry no tool DWG, e.g. 414303)
// On any error `result.planProcess.applied` stays false → the page's flat list.
async function annotatePlanProcess(result, cn) {
  const controlNo = cnFormat.toControlNo(cn);
  if (!controlNo || !Array.isArray(result.results) || !result.results.length) {
    result.planProcess = { applied: false, reason: 'cn_unparseable' };
    return;
  }
  try {
    const [toolRes, routeRes, smtMap] = await Promise.all([
      maqPool.query(
        `SELECT DISTINCT process_code,
                split_part(tool_dwg_no, '-', 1) || '-' || split_part(tool_dwg_no, '-', 2) AS fam
           FROM lpb.eng_r_pi_tool
          WHERE process_plan_no = $1
            AND tool_dwg_no IS NOT NULL AND btrim(tool_dwg_no) <> ''`, [controlNo]),
      maqPool.query(
        `SELECT DISTINCT process_code FROM lpb.eng_process_info
          WHERE process_plan_no = $1 AND process_code IS NOT NULL`, [controlNo]),
      machineProcessCodes(),
    ]);

    const routeCodes = new Set(routeRes.rows.map((r) => String(r.process_code).trim()).filter(Boolean));
    if (!routeCodes.size && !toolRes.rows.length) {
      result.planProcess = { applied: false, reason: 'no_plan' };
      return;
    }

    const famProc = new Map();          // fam -> Set(process_code)
    for (const r of toolRes.rows) {
      if (!r.fam) continue;
      if (!famProc.has(r.fam)) famProc.set(r.fam, new Set());
      if (r.process_code) famProc.get(r.fam).add(String(r.process_code).trim());
    }
    const planFamilies = new Set(famProc.keys());

    let inPlanCount = 0;
    const matchedCodes = new Set();
    for (const res of result.results) {
      const pcs = new Set();
      // signal 1 — tool family
      const fams = new Set();
      if (/^\d{4}-\d{2}/.test(res.tooling || '')) fams.add(String(res.tooling).slice(0, 7));
      for (const m of res.matches || []) {
        const f = dwgFamily(m.tooling_no || m.tool_dwg_no || m.dwg);
        if (f) fams.add(f);
      }
      for (const f of fams) if (planFamilies.has(f)) for (const pc of famProc.get(f)) pcs.add(pc);
      // signal 2 — configured process code in the part's route
      for (const pc of smtMap.get(res.machine) || []) if (routeCodes.has(pc)) pcs.add(pc);

      res.planInPlan = pcs.size > 0;
      res.planProcessCodes = [...pcs].sort();
      if (res.planInPlan) { inPlanCount += 1; for (const pc of pcs) matchedCodes.add(pc); }
    }

    result.planProcess = {
      applied: true,
      processCodes: [...matchedCodes].sort(),
      routeCodes: [...routeCodes].sort(),
      inPlanResults: inPlanCount,
    };
  } catch (err) {
    console.warn(`[tselect] plan-process annotate skipped for ${cn}: ${err.message}`);
    result.planProcess = { applied: false, reason: 'plan_source_unavailable' };
  }
}

module.exports = { search };
