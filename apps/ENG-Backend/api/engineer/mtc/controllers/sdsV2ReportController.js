const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const tselectFallback = require('../services/tselectFallback');
const searchService = require('../services/searchService');
const cnFormat = require('../utils/cnFormat');
const { syncNoStampBacklog } = require('../services/sdsBacklogIntake');
const templateBConformance = require('../services/templateBConformance');
const selectionConditionConformance = require('../services/selectionConditionConformance');
const { hasFeature } = require('../../../../middleware/mtcAuth');
const cache = require('../services/agents/CacheAgent');
// SDS coverage-report config is part of the SDS admin surface.
const isAdmin = hasFeature('sds_admin');

const router = express.Router();

// Flush the SDS search/PDF cache (sds:* keys) + the coverage cache after a config
// mutation on this router, so edits reflect on the very next search & PDF instead of
// waiting out the 10-min / 15-min TTLs. Mirrors sdsV2AdminController.flushSds — kept
// as a local copy because that controller already requires THIS module
// (invalidateCoverageCache), so importing it back would be circular.
const flushSds = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      cache.invalidatePrefix('sds:');
      invalidateCoverageCache();
    }
  });
  next();
};

// The coverage build runs in the background with no request in hand, so the
// socket.io instance is captured from request traffic instead. Only used to push
// realtime board updates — everything still works before the first request.
let _io = null;
router.use((req, _res, next) => {
  if (!_io) _io = req.app.get('io') || null;
  next();
});

/**
 * Pure coverage-level classifier for one evaluated SDS sheet. Extracted so the
 * COMPLETE / PENDING / NO_STAMP rules can be unit-tested without a DB (see
 * tests/mtc/sdsCoverageClassify.test.js).
 *
 * COMPLETE = PDF-ready (tool + Excel config) AND a FULL approval stamp
 * (prepared+checked+approved, approver≠preparer). A PDF-ready-but-unsigned sheet
 * stays PENDING with reason NO_STAMP — it becomes COMPLETE only once signed.
 *
 * @param {{has_tooling_match:boolean, has_machine_template:boolean,
 *          has_process:boolean, stamped_full:boolean, tooling_source:string}} r
 * @returns {{coverage_level:string, coverage_level_saved:string, pending_reason:?string}}
 */
function classifyCoverage(r) {
  // Tooling gate: a matched factory/T-Select tool OR a legitimate "no fixture needed"
  // (tooling_not_required — set for surface-grind parts on tooling-optional machines
  // whose process plan lists no tool). The latter is a real N/A state, NOT a T-Select
  // #1 boost, so it also satisfies the SAVED baseline gate below.
  const toolingSatisfied      = r.has_tooling_match || r.tooling_not_required;
  const toolingSatisfiedSaved = r.tooling_source === 'saved' || r.tooling_not_required;
  const coverage_level =
    toolingSatisfied && r.has_machine_template && r.stamped_full ? 'COMPLETE' :
    r.has_process                                                ? 'PENDING'  :
                                                                   'MISSING';
  // Baseline (saved factory-plan tool only, no T-Select #1). Also stamp-gated, so
  // complete − complete_saved isolates the T-Select #1 boost AMONG signed sheets.
  const coverage_level_saved =
    toolingSatisfiedSaved && r.has_machine_template && r.stamped_full ? 'COMPLETE' :
    r.has_process                                                     ? 'PENDING'  :
                                                                        'MISSING';
  // WHY the row is pending — separates "no tool", "no Excel config", and "ready but
  // not yet signed" (NO_STAMP). Order matters: tool/excel gaps are reported first;
  // a tool+excel-ready row that is still pending must be NO_STAMP.
  const pending_reason = coverage_level !== 'PENDING' ? null :
    !toolingSatisfied && !r.has_machine_template ? 'NO_TOOL_NO_EXCEL' :
    !toolingSatisfied                            ? 'NO_TOOL'          :
    !r.has_machine_template                      ? 'NO_EXCEL'         :
                                                   'NO_STAMP';
  return { coverage_level, coverage_level_saved, pending_reason };
}

// Full coverage-result cache. A cold build is expensive (the Tooling Select
// fallback runs hundreds of per-CN searches), so cache the assembled payload
// and serve it for COVERAGE_TTL_MS. Pass ?refresh=1 to force a rebuild.
let _coverageCache = null;     // { at, data }
let _coverageBuilding = null;  // Promise<payload> while a build is in flight
const COVERAGE_TTL_MS = 15 * 60 * 1000;

// Persist the last successful build to a DB row so it survives a process
// restart. A fresh process then serves the previous result instantly (stale) and
// rebuilds in the background, instead of forcing the first user to wait for a
// cold ~minutes-long build. (The in-memory cache stays the fast path.)
let _coverageTableReady = null;
function ensureCoverageTable() {
  if (!_coverageTableReady) {
    _coverageTableReady = engPool.query(`
      CREATE TABLE IF NOT EXISTS sds_coverage_cache (
        id       TEXT PRIMARY KEY,
        data     JSONB NOT NULL,
        built_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((e) => { _coverageTableReady = null; throw e; });
  }
  return _coverageTableReady;
}
async function persistCoverage(payload, at) {
  try {
    await ensureCoverageTable();
    await engPool.query(
      `INSERT INTO sds_coverage_cache (id, data, built_at) VALUES ('coverage', $1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, built_at = EXCLUDED.built_at`,
      [payload, new Date(at)]
    );
  } catch (e) { console.error('[SDS Report] persist coverage failed:', e.message); }
}
async function loadPersistedCoverage() {
  try {
    await ensureCoverageTable();
    const r = await engPool.query(`SELECT data, built_at FROM sds_coverage_cache WHERE id = 'coverage' LIMIT 1`);
    // Skip an empty/degraded snapshot (total=0) → rebuild instead of serving it.
    if (r.rows[0] && r.rows[0].data?.kpi?.total > 0) {
      return { at: new Date(r.rows[0].built_at).getTime(), data: r.rows[0].data };
    }
  } catch (e) { console.error('[SDS Report] load persisted coverage failed:', e.message); }
  return null;
}

// ── Monthly-status freeze — one immutable row per CLOSED calendar month ───────
// The coverage report recomputes monthlyStatus from scratch every build, so a
// config edit or a back-dated approval for an old part reshapes the WHOLE
// historical curve (every cumulative bar from that part's production month on).
// Freezing fixes that: the first build in a new month writes each now-closed
// month's bar and it is served verbatim forever after. Only the CURRENT
// (still-open) month stays live.
//
// NOTE: freezing captures whatever the numbers are the first time a month closes
// after this shipped — it locks in TODAY's history, it does not reconstruct an
// earlier state. To deliberately re-freeze a month after a real correction:
//   DELETE FROM sds_coverage_monthly WHERE month = '2026-07';   -- next build re-freezes it
let _covMonthlyTableReady = null;
function ensureCoverageMonthlyTable() {
  if (!_covMonthlyTableReady) {
    _covMonthlyTableReady = engPool.query(`
      CREATE TABLE IF NOT EXISTS sds_coverage_monthly (
        month     TEXT PRIMARY KEY,
        data      JSONB NOT NULL,
        frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((e) => { _covMonthlyTableReady = null; throw e; });
  }
  return _covMonthlyTableReady;
}
async function freezeMonthlyStatus(live) {
  const curMonth = new Date().toISOString().slice(0, 7);
  try {
    await ensureCoverageMonthlyTable();
    const { rows } = await engPool.query(`SELECT month, data FROM sds_coverage_monthly`);
    const frozen = new Map(rows.map((r) => [r.month, r.data]));

    const toFreeze = live.filter((m) => m.month < curMonth && !frozen.has(m.month));
    if (toFreeze.length) {
      const ph = toFreeze.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
      await engPool.query(
        `INSERT INTO sds_coverage_monthly (month, data) VALUES ${ph}
         ON CONFLICT (month) DO NOTHING`,
        toFreeze.flatMap((m) => [m.month, JSON.stringify(m)])
      );
      for (const m of toFreeze) frozen.set(m.month, m);
      console.log(`[SDS Report] froze ${toFreeze.length} monthlyStatus month(s): ${toFreeze.map((m) => m.month).join(', ')}`);
    }
    // Serve frozen for closed months, live for the current (open) month.
    return live.map((m) => (m.month < curMonth && frozen.has(m.month) ? frozen.get(m.month) : m));
  } catch (e) {
    console.warn('[SDS Report] freezeMonthlyStatus failed, serving live curve:', e.message);
    return live;   // fail open — a live curve beats a broken report
  }
}

// ── Report scope config (admin-editable) ─────────────────────────────────────
// The operational "dials" of the coverage scope, externalized from hardcode so
// admins can change them without a deploy. Defaults == the original hardcoded
// values, so behaviour is identical until edited. SEPARATE from sds_audit_config
// (Data Integrity) by design — that audits master eng_item, this scopes the
// production-based coverage report (different population). The part-type taxonomy
// (ball/race/mecha = C95+C99) stays in code (cnPartType) — see the config UI note.
const DEFAULT_REPORT_SCOPE = {
  part_types:    ['ball', 'race', 'mecha'],   // future: add 'sleeve', 'body'
  process_codes: ['1011','1012','1021','1022','1031','1041','1042','1061','1062','1101','1102','1161','1162','1241','1321'],
  work_centers:  ['05', '09', '29', '30', '31', '32', '37'],
  excluded_cns:  ['C39-00209', 'C29-04044', 'C29-04045'],
  since_date:    '2023-01-01',
  // Surface-grind machines where a fixture is genuinely optional: most parts are held
  // on a magnetic chuck with no dedicated tooling. For these machines, a CN whose
  // process plan lists NO tool for that process_code is treated as "tooling not
  // required" (satisfies the tooling gate) instead of the false "missing tooling"
  // gap. A plan that DOES list a tool which fails to match config stays a real NO_TOOL.
  tooling_optional_machines: ['PSG-64', 'GS-64PFII', 'MSG-410'],  // wc-32 MSB surface grinders (magnetic chuck); MSG-410 onboarded 2026-07-04
};

// part_type → pc_production item-number leading-digit prefix. Taxonomy stays in code
// (cnPartType does the precise C-prefix classification); part_types config only
// selects WHICH types are included in the report. Used to build query 11's prefix gate.
const PART_TYPE_ITEM_PREFIX = { ball: '3', race: '2', body: '[15]', sleeve: '6', mecha: '9', spherical: '4' };

async function ensureReportConfigTable() {
  await engPool.query(`
    CREATE TABLE IF NOT EXISTS sds_report_config (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
}

// Resolve the effective scope: defaults overlaid with any rows in sds_report_config.
async function getReportScope() {
  const scope = { ...DEFAULT_REPORT_SCOPE };
  try {
    await ensureReportConfigTable();
    const r = await engPool.query(`SELECT key, value FROM sds_report_config`);
    for (const row of r.rows) if (row.key in scope) scope[row.key] = row.value;
  } catch (e) { console.error('[report-scope] falling back to defaults:', e.message); }
  if (Array.isArray(scope.since_date)) scope.since_date = scope.since_date[0]; // stored as JSON scalar
  return scope;
}

// Force the next /coverage request to rebuild (called when scope config changes).
function invalidateCoverageCache() { _coverageCache = null; _coverageBuilding = null; }

// Convert pc_production.control_no (item number format) to standard CN format
// e.g. "350528" → "C35-00528", "350528-C" → "C35-00528", "C35-00528" → "C35-00528"
// Delegates to cnFormat (SSOT); falls back to the cleaned raw string when the
// shape is unrecognized so unmapped values still flow through the report.
function normalizeCn(raw) {
  return cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
}

// Derive part_type string from CN prefix
function cnPartType(cn) {
  if (!cn) return 'other';
  const m = String(cn).toUpperCase().match(/^([A-Z])(\d{2})/);
  if (!m) return 'other';
  const [, letter, digits] = m;
  const n = parseInt(digits, 10);
  if (letter === 'C') {
    if (n >= 31 && n <= 39) return 'ball';
    if (n >= 21 && n <= 29) return 'race';
    if ((n >= 11 && n <= 19) || (n >= 51 && n <= 59)) return 'body';
    if ((n >= 61 && n <= 64) || n === 69) return 'sleeve';
  }
  if (letter === 'A' && n >= 41 && n <= 49) return 'spherical';
  // Mecha = C95 (Mechanical Parts) + C99 (Others) only — the two C9x classes with
  // real grinding production. Keep in sync with DEFAULT_AUDIT_SUB_CLASSES (admin).
  if (letter === 'C' && (n === 95 || n === 99)) return 'mecha';
  return 'other';
}

// Fiscal year (Apr 1 – Mar 31). FYE N = Apr (N+1999) → Mar (N+2000), matching
// legacyMtcController's currentFye/fyeToRange. Emitted in the coverage payload as
// `fye` so the "New Parts per Month" / "Cumulative Coverage Status" charts window on
// the CURRENT FY plus one leading prior-FY bar — WITHOUT the frontend hardcoding the
// month strings (which silently break every April).
function currentFyeWindow(ref = new Date()) {
  const num = (ref.getMonth() + 1) >= 4 ? ref.getFullYear() - 1999 : ref.getFullYear() - 2000;
  const sy = num + 1999;                       // FY start calendar year
  const pad = (v) => String(v).padStart(2, '0');
  return {
    num,
    start:     `${sy}-04`,       // 'YYYY-MM', inclusive
    end:       `${sy + 1}-03`,   // inclusive
    prevStart: `${sy - 1}-04`,
    prevEnd:   `${sy}-03`,
    label:     `FYE${pad(num)}`,
    prevLabel: `FYE${pad(num - 1)}`,
  };
}

/**
 * GET /api/sds/v2/report/coverage
 *
 * Coverage is measured in 3 levels against CNs active in production (since 2023-01-01,
 * a fixed cutoff — not a rolling window):
 *   Level 1 — AUTO     : CN has dimension data + process info + tooling in factory DB (no manual work needed)
 *   Level 2 — CONFIGURED: CN also has sds_parameter rows (manual program no, stamps, revision)
 *   Level 3 — COMPLETE : Also has tool images + grinding images uploaded
 *
 * All data is read directly from DB — no CSV import required.
 */
// Heavy coverage build — extracted so it can run in the background. The per-CN
// Tooling Select fallback over ~800 CNs takes minutes, far longer than any
// interactive request should block, so the route triggers this and polls the
// cache instead of awaiting it inline.
async function buildCoverage() {
    // Effective scope (admin config overlaid on defaults). Parameterized into the
    // production queries below so the scope is data-driven, not hardcoded.
    const scope       = await getReportScope();
    const since       = scope.since_date;
    const wcArr       = scope.work_centers;
    const partTypes   = scope.part_types;
    const procCodes   = scope.process_codes;
    const exclItemNos = scope.excluded_cns.map(c => cnFormat.toItemNo(c)).filter(Boolean); // raw item-no form for pc_production
    // Combined item-number prefix for the selected part types (e.g. ball+race+mecha → ^(3|2|9))
    const prefixRegex = `^(${partTypes.map(pt => PART_TYPE_ITEM_PREFIX[pt]).filter(Boolean).join('|')})`;

    // ── Query all sources in parallel ───────────────────────────────────────
    const [
      prodCnsRes,          // CNs active in production
      cnWithProcessRes,    // CNs that have a process plan (eng_process_info)
      cnRpiToolRes,        // (control_no, tool_dwg_no) from process plan tooling
      machineToolsRes,     // tool_drawing_no whitelist from sds_machine_tool config
      sdsParamsRes,        // per-CN sds_parameter (cn IS NOT NULL)
      machineTemplatesRes, // machine-level sds_parameter template (cn IS NULL)
      toolImagesRes,       // Tool DWG nos that have images uploaded
      grindingImagesRes,
      machineCodesRes,
      sdsParamMonthRes,
      cnMachinePairsRes, // (CN × machine) pairs for monthly new-part counting
      rodpcMachineRes,   // machine_code → m_model from rodpc.m_machine (full master)
    ] = await Promise.all([

      // 1. Production CNs — since the configured cutoff (maqPool)
      maqPool.query(`
        SELECT DISTINCT control_no,
               MAX(comp_date) AS last_prod_date,
               MIN(comp_date) AS first_prod_date,
               MAX(machine)   AS machine_code
        FROM ${TABLES.LPB_PC_PRODUCTION}
        WHERE control_no IS NOT NULL
          AND control_no NOT LIKE 'PM%'
          AND comp_date >= $1
        GROUP BY control_no
      `, [since]).catch(() => ({ rows: [] })),

      // 2. CNs with process plan — eng_process_info.process_plan_no = CN
      maqPool.query(`
        SELECT DISTINCT process_plan_no AS control_no
        FROM ${TABLES.LPB_ENG_PROCESS_INFO}
        WHERE process_plan_no IS NOT NULL
          AND process_plan_no ~ '^[A-Z][0-9]{2}-'
      `).catch(() => ({ rows: [] })),

      // 4. Tooling items in process plan per CN (include process_code for directional check)
      maqPool.query(`
        SELECT process_plan_no AS control_no, process_code, tool_dwg_no
        FROM ${TABLES.LPB_ENG_R_PI_TOOL}
        WHERE process_plan_no IS NOT NULL
          AND process_plan_no ~ '^[A-Z][0-9]{2}-'
          AND tool_dwg_no IS NOT NULL
      `).catch(() => ({ rows: [] })),

      // 5. Machine Tool Config — tool list per (machine_type, process_code)
      engPool.query(`
        SELECT machine_type, process_code, tool_drawing_no
        FROM ${TABLES.SDS_V2_MACHINE_TOOL}
        WHERE tool_drawing_no IS NOT NULL
      `),

      // 6. Per-CN sds_parameter (program_no, sds_rev, stamps, etc.)
      engPool.query(`
        SELECT cn, machine_type_name, COUNT(param_key) AS param_count
        FROM ${TABLES.SDS_PARAMETER}
        WHERE cn IS NOT NULL
        GROUP BY cn, machine_type_name
      `),

      // 6b. Machine-level sds_parameter template (cn IS NULL) — common to all CNs on that machine
      engPool.query(`
        SELECT machine_type_name, COUNT(param_key) AS param_count
        FROM ${TABLES.SDS_PARAMETER}
        WHERE cn IS NULL
        GROUP BY machine_type_name
      `),

      // 7. Tool images
      engPool.query(`SELECT tool_dwg_no FROM ${TABLES.SDS_V2_TOOLING_IMAGE}`),

      // 8. Grinding images count
      engPool.query(`SELECT COUNT(*) AS cnt FROM ${TABLES.SDS_V2_GRINDING_IMAGE}`),

      // 9. Machine code → machine_name mapping (machine_name = machine_type_name in sds_parameter)
      engPool.query(`SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`),

      // 10. Monthly sds_parameter additions — the LAST 24 months. ORDER BY DESC so the
      //     LIMIT keeps the most RECENT window (ascending + LIMIT kept the OLDEST 24 and
      //     hid every recent month once history passed 24 months); re-sorted chronological
      //     in JS below (see `monthlyTrend`).
      engPool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', first_seen), 'YYYY-MM') AS month,
               COUNT(*) AS configs_added
        FROM (
          SELECT cn, MIN(updated_at) AS first_seen
          FROM ${TABLES.SDS_PARAMETER}
          WHERE cn IS NOT NULL AND updated_at IS NOT NULL
          GROUP BY cn
        ) sub
        GROUP BY DATE_TRUNC('month', first_seen)
        ORDER BY DATE_TRUNC('month', first_seen) DESC
        LIMIT 24
      `),

      // 11. CN × machine × process triples — first time each combo appeared in production.
      //     Fully config-driven (sds_report_config): part_types → prefix gate ($5),
      //     a single unified process_codes set ($4), work_centers ($3), excluded CNs ($1),
      //     since-date ($2). cnPartType still does the precise C-prefix classification below.
      maqPool.query(`
        SELECT control_no, machine, process, MIN(comp_date) AS first_seen
        FROM ${TABLES.LPB_PC_PRODUCTION}
        WHERE control_no IS NOT NULL
          AND control_no NOT LIKE 'PM%'
          AND control_no <> ALL($1)
          AND comp_date >= $2
          AND machine IS NOT NULL
          AND wc = ANY($3)
          AND process = ANY($4)
          AND control_no ~ $5
        GROUP BY control_no, machine, process
      `, [exclItemNos, since, wcArr, procCodes, prefixRegex]).catch(() => ({ rows: [] })),

      // 12. Machine master from rodpc — machine_code → m_model (machine type name)
      //     Used as base; sds_machine_code (query 9) overrides for SDS-curated names
      rodpcPool.query(`
        SELECT machine_code, TRIM(m_model) AS m_model
        FROM m_machine
        WHERE wc = ANY($1)
          AND m_model IS NOT NULL AND TRIM(m_model) != ''
      `, [wcArr]).catch(() => ({ rows: [] })),
    ]);

    // ── Extra refs for Tooling Select fallback ───────────────────────────────
    //   (machine_type_name → machine_group for matching T-Select grouped results,
    //    and the set of CNs that have a spec row — only those can be searched)
    const [mtcTypeRes, specCnsRes] = await Promise.all([
      engPool.query(`SELECT id, machine_type_name, machine_group FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE is_active`).catch(() => ({ rows: [] })),
      engPool.query(`SELECT cn FROM ${TABLES.SPEC_PROCESS}`).catch(() => ({ rows: [] })),
    ]);

    // ── Normalize production CNs and build lookup map (deduplicated) ─────────
    // pc_production stores item numbers (e.g. "350528", "350528-C")
    // Factory dim/process tables use standard format (e.g. "C35-00528")
    const prodCnMap = new Map();
    for (const row of prodCnsRes.rows) {
      const cn = normalizeCn(row.control_no);
      if (!prodCnMap.has(cn)) {
        prodCnMap.set(cn, { ...row, cn, first_prod_date: row.first_prod_date });
      }
    }

    // DWG prefix = first two dash-segments (e.g. "4556-01-0048" → "4556-01")
    const dwgPrefix = (no) => {
      if (!no) return '';
      const p = String(no).split('-');
      return p.length >= 2 ? `${p[0]}-${p[1]}` : no;
    };

    // Machine Tool Config keyed by "machine_type||process_code" → Set of DWG prefixes
    // Direction: config defines what tools SHOULD appear in the process plan
    const machineToolMap = new Map();
    for (const r of machineToolsRes.rows) {
      const key = `${r.machine_type}||${r.process_code}`;
      if (!machineToolMap.has(key)) machineToolMap.set(key, new Set());
      machineToolMap.get(key).add(dwgPrefix(r.tool_drawing_no));
    }

    // CN process plan tools keyed by "cn||process_code" → Set of DWG prefixes
    const cnProcessToolPrefixes = new Map();
    for (const row of cnRpiToolRes.rows) {
      const key = `${row.control_no}||${row.process_code}`;
      if (!cnProcessToolPrefixes.has(key)) cnProcessToolPrefixes.set(key, new Set());
      cnProcessToolPrefixes.get(key).add(dwgPrefix(row.tool_dwg_no));
    }

    // hasToolingMatch(cn, machineTypeName, processCode):
    // true = Machine Tool Config exists for (machine, process) AND
    //        at least one configured tool appears in the CN's process plan for that process_code
    const checkToolingMatch = (cn, machineTypeName, processCode) => {
      if (!machineTypeName || !processCode) return false;
      const configPrefixes = machineToolMap.get(`${machineTypeName}||${processCode}`);
      if (!configPrefixes || configPrefixes.size === 0) return false;
      const planPrefixes = cnProcessToolPrefixes.get(`${cn}||${processCode}`);
      if (!planPrefixes || planPrefixes.size === 0) return false;
      for (const prefix of configPrefixes) {
        if (planPrefixes.has(prefix)) return true;
      }
      return false;
    };

    const hasProcess    = new Set(cnWithProcessRes.rows.map(r => r.control_no));

    // machine_code → machine_type_name
    // Base: rodpc.m_machine (m_model) — covers all floor machines
    // Override: sds_machine_code — curated SDS names that match sds_parameter entries
    const machineCodeMap = {};
    for (const r of rodpcMachineRes.rows) {
      if (r.m_model) machineCodeMap[r.machine_code] = r.m_model;
    }
    for (const r of machineCodesRes.rows) {
      machineCodeMap[r.machine_code] = r.machine_name; // sds_machine_code wins
    }

    // Machines excluded from SDS coverage scope
    const EXCLUDED_MACHINE_TYPES = new Set(['KS-H70(#C41)']);

    // Decommissioned floor machines excluded by machine CODE (not type) — SPG-08 (HIGRIND-1-D)
    // is retired, but its sibling HIGRIND-1-D units CGM-13/CGM-14 stay, so we drop only SPG-08.
    const EXCLUDED_MACHINE_CODES = new Set(['SPG-08']);

    // Exclude PSG-52AN (SGM-01) entirely; exclude other SGM for face-grind (1021/1022) only
    const cnMachinePairs = cnMachinePairsRes.rows.filter(row => {
      if (row.machine === 'SGM-01') return false;
      if (EXCLUDED_MACHINE_CODES.has(row.machine)) return false;
      const mName = machineCodeMap[row.machine] || '';
      if (EXCLUDED_MACHINE_TYPES.has(mName)) return false;
      if (row.process !== '1021' && row.process !== '1022') return true;
      return !mName.toUpperCase().startsWith('SGM');
    });

    // per-CN sds_parameter keyed by "cn||machine_type_name"
    const hasParamsByMachine = new Map();
    for (const r of sdsParamsRes.rows) {
      hasParamsByMachine.set(`${r.cn}||${r.machine_type_name}`, parseInt(r.param_count, 10));
    }

    // machine-level template: machines that have sds_parameter (cn IS NULL) configured
    const machineTemplateSet = new Set(
      machineTemplatesRes.rows
        .filter(r => parseInt(r.param_count, 10) > 0)
        .map(r => r.machine_type_name)
    );

    // Grouped machines (e.g. KS-400B1/B2/B7, TSG-300W/TSG-300ZNC) share ONE SDS
    // config stored under a single representative machine_type_name. Resolve every
    // member → representative so siblings inherit that config instead of looking
    // unconfigured. Generic: works for any machine_group in sds_machine_type_code.
    // Representative = the member that actually HOLDS config (Excel template or tool
    // whitelist); falls back to the lowest-id member when none is configured yet.
    const configuredNames = new Set([
      ...machineTemplateSet,
      ...machineToolsRes.rows.map(r => r.machine_type),
    ]);
    const nameToGroup   = {};   // machine_type_name → machine_group
    const groupMembers  = {};   // machine_group → [{ id, name }]
    for (const r of mtcTypeRes.rows) {
      if (!r.machine_group) continue;
      nameToGroup[r.machine_type_name] = r.machine_group;
      (groupMembers[r.machine_group] = groupMembers[r.machine_group] || []).push({ id: r.id, name: r.machine_type_name });
    }
    const groupRepName = {};   // machine_group → representative machine_type_name
    for (const [grp, members] of Object.entries(groupMembers)) {
      members.sort((a, b) => a.id - b.id);
      const configured = members.find(m => configuredNames.has(m.name));
      groupRepName[grp] = (configured || members[0]).name;
    }
    const repOf        = (name) => (name && nameToGroup[name]) ? (groupRepName[nameToGroup[name]] || name) : name;
    const displayGroup = (name) => (name && nameToGroup[name]) ? nameToGroup[name] : name;

    // CNs excluded from coverage scope (normalized form) — from report config
    const EXCLUDED_CNS = new Set(scope.excluded_cns.map(normalizeCn));

    // Dedup by (control_no, machine_type_name, process):
    // multiple machine codes sharing the same type (e.g. IDG-03..07 → KS-03A)
    // represent ONE SDS requirement — keep row with earliest first_seen
    // Resolve to the group representative so B1/B2/B7 production of the same CN+process
    // collapses into ONE SDS requirement (config lives under the representative).
    // Key on the NORMALIZED CN (not raw control_no) so a part's dual production
    // forms — "310016" and "310016-C" — collapse to ONE requirement instead of two.
    const _deduped = new Map();
    for (const row of cnMachinePairs) {
      const mTypeName = repOf(machineCodeMap[row.machine] || row.machine);
      const key = `${normalizeCn(row.control_no)}||${mTypeName}||${row.process}`;
      const existing = _deduped.get(key);
      if (!existing || row.first_seen < existing.first_seen) _deduped.set(key, row);
    }
    const cnMachinePairsDeduped = [..._deduped.values()];

    // ── Evaluate coverage for each CN × machine_type × process triple ─────────
    // PENDING      : has process plan BUT tool doesn't match sds_machine_tool
    //               OR tool matches but machine has no Excel Parameter Config (cn IS NULL)
    // COMPLETE     : tool match ✅ + machine Excel Config ✅ → PDF ready
    //               (per-record params are optional — PDF generates with empty fields if absent)
    // Machines where a fixture is genuinely optional (surface grind — magnetic chuck).
    const toolingOptionalMachines = new Set(scope.tooling_optional_machines || []);

    const evaluated = [];
    for (const row of cnMachinePairsDeduped) {
      const cn = normalizeCn(row.control_no);
      if (EXCLUDED_CNS.has(cn)) continue;
      const pt = cnPartType(cn);

      if (!partTypes.includes(pt)) continue;

      const prodRow             = prodCnMap.get(cn) || {};
      const machineTypeName     = repOf(machineCodeMap[row.machine] || null);
      const hasPlan             = hasProcess.has(cn);
      const hasTooling          = hasPlan && checkToolingMatch(cn, machineTypeName, row.process);
      const hasMachineTemplate  = machineTypeName ? machineTemplateSet.has(machineTypeName) : false;
      const perRecordCount      = machineTypeName
        ? (hasParamsByMachine.get(`${cn}||${machineTypeName}`) || 0) : 0;
      // Tooling-optional machine + the CN's process plan lists NO tool for this
      // process_code → the part legitimately needs no fixture (not a missing-tooling
      // gap). If a tool IS listed but fails to match config, this stays false so the
      // row is still a real NO_TOOL.
      const toolingNotRequired  = !hasTooling
        && toolingOptionalMachines.has(machineTypeName)
        && !cnProcessToolPrefixes.has(`${cn}||${row.process}`);

      evaluated.push({
        cn,
        machine_code:         row.machine,
        machine_type_name:    machineTypeName,
        process_code:         row.process,
        part_type:            pt,
        last_prod_date:       prodRow.last_prod_date,
        first_prod_date:      row.first_seen,
        has_process:          hasPlan,
        has_tooling_match:    hasTooling,
        tooling_not_required: toolingNotRequired,
        has_machine_template: hasMachineTemplate,
        param_count:          perRecordCount,
        tooling_source:       hasTooling ? 'saved' : (toolingNotRequired ? 'not_required' : null),
        // coverage_level computed after the Tooling Select fallback pass below
      });
    }

    // ── Tooling Select fallback ───────────────────────────────────────────────
    // For rows still lacking a saved tooling match, count the tooling as matched
    // when Tooling Select can compute a tool for that machine + part. Only CNs that
    // have a spec row are searchable; results are cached per CN (TTL) so each CN is
    // searched once even though it appears in several machine/process rows.
    const specCnSet = new Set(specCnsRes.rows.map(r => String(r.cn).trim()));
    const toSpecCn = cnFormat.toSpecCn; // SSOT: control-no / item-no → 6-digit spec CN
    // Unique CNs (report format → spec CN) that need a lookup
    const needTs = new Map();
    for (const r of evaluated) {
      if (r.has_tooling_match || r.tooling_not_required || !r.machine_type_name) continue;
      const sc = toSpecCn(r.cn);
      if (sc && specCnSet.has(sc)) needTs.set(r.cn, sc);
    }

    // Search in bounded-concurrency batches: each search fans out internally over
    // machines × toolings, so a small outer concurrency keeps the pg pool (max 20)
    // healthy while cutting wall time ~2.7× vs fully sequential. Verified: no pool
    // timeouts at concurrency 8; 6 is the safe default.
    const tsByCn = new Map();
    const tsEntries = [...needTs.entries()];
    // Warm the in-memory cache from the persisted per-CN T-Select results in ONE
    // bulk query, so most safeSearch() calls below hit memory and skip the
    // expensive full search (rebuilds become near-instant for unchanged CNs).
    await tselectFallback.preloadPersisted(tsEntries.map(([, sc]) => sc));
    const TS_CONCURRENCY = 6;
    for (let i = 0; i < tsEntries.length; i += TS_CONCURRENCY) {
      const batch = tsEntries.slice(i, i + TS_CONCURRENCY);
      await Promise.all(batch.map(async ([cn, sc]) => {
        tsByCn.set(cn, await tselectFallback.safeSearch(sc));
      }));
    }

    for (const r of evaluated) {
      if (r.has_tooling_match || r.tooling_not_required || !r.machine_type_name) continue;
      const tsResult = tsByCn.get(r.cn);
      if (!tsResult) continue;
      const acceptable = new Set([r.machine_type_name]);
      if (nameToGroup[r.machine_type_name]) acceptable.add(nameToGroup[r.machine_type_name]);
      // Direction gate is SKIPPED here (partHasProcess:true): every evaluated row is
      // production-derived (cnMachinePairs = a machine that actually ran this CN+process),
      // so the part genuinely undergoes this process_code. A multi-grind part (e.g. a ball
      // with both ID grind 1061 and spherical grind 1041) stores only ONE spec.process
      // direction, so the gate would otherwise wrongly drop a valid spherical machine's
      // tooling on the 1041 row — undercounting coverage. Matches the SDS PDF behaviour.
      //
      // acceptFamilies: this machine's own sds_machine_tool whitelist. It lets a T-Select
      // result filed under a SIBLING that IS in the T-Select registry (e.g. OC-16A's
      // centreless COLLAR/PIN/RACE PUSHER on 4560-*) count for machines that are not —
      // OC-18BR-150 / OC-20BR-200 / HI-GRIND-1-D share the identical config + whitelist.
      // Same widening the SDS PDF renderer already applies, so report and sheet agree.
      if (tselectFallback.tselectToolsForMachine(tsResult, acceptable, {
            processCode: r.process_code, partHasProcess: true,
            acceptFamilies: machineToolMap.get(`${r.machine_type_name}||${r.process_code}`),
          }).length > 0) {
        r.has_tooling_match = true;
        r.tooling_source = 'tselect';
      }
    }

    // ── Limit-excluded / limit-softened rows ──────────────────────────────────
    // A CN may appear in production on a machine whose Tooling Select size LIMIT
    // (tooling_machine_limit) says the part cannot physically run there. T-Select
    // now splits those two ways (searchService.limitExcludedMachines):
    //   • excluded — over the limit AND no sustained production history → a genuine
    //     data anomaly (wrong limit, or an odd production record). Flagged red.
    //   • softened — over the limit BUT the floor has genuinely run this CN here →
    //     T-Select searches it normally ('limit_note'). NOT an anomaly; it is the
    //     worklist of bounds a surgical tooling_machine_limit fix should look at.
    // Cheap: spec context + in-memory limit cache, no inventory search. Runs for
    // EVERY spec'd CN since a produced-there part is often matched.
    const needLimit = new Map(); // report cn → spec cn
    for (const r of evaluated) {
      if (!r.machine_type_name) continue;
      const sc = toSpecCn(r.cn);
      if (sc && specCnSet.has(sc)) needLimit.set(r.cn, sc);
    }
    const limitExcludedByCn = new Map(); // report cn → Map<displayName, reason>
    const limitSoftenedByCn = new Map(); // report cn → Map<displayName, reason>
    const limitEntries = [...needLimit.entries()];
    for (let i = 0; i < limitEntries.length; i += TS_CONCURRENCY) {
      const batch = limitEntries.slice(i, i + TS_CONCURRENCY);
      await Promise.all(batch.map(async ([cn, sc]) => {
        try {
          const r = await searchService.limitExcludedMachines(sc);
          if (r?.excluded?.size) limitExcludedByCn.set(cn, r.excluded);
          if (r?.softened?.size) limitSoftenedByCn.set(cn, r.softened);
        } catch (_) { /* fail-open: cannot judge → keep the row, no flag */ }
      }));
    }
    // A row matches when its machine (rep name OR its group label — the form
    // searchService emits) is in the CN's set. Fail-open otherwise.
    const inSet = (byCn) => (r) => {
      const s = byCn.get(r.cn);
      if (!s || !r.machine_type_name) return false;
      if (s.has(r.machine_type_name)) return true;
      const g = nameToGroup[r.machine_type_name];
      return g ? s.has(g) : false;
    };
    const isLimitExcluded = inSet(limitExcludedByCn);
    const isLimitSoftened = inSet(limitSoftenedByCn);
    // COUNT-BACK (2026-07-02, revised 2026-08-31): produced-but-limit-excluded rows
    // rest on contradictory data (the T-Select size limit and a real production record
    // disagree), so they are NOT an actionable "needs a signature / needs config" task.
    // They are FLAGGED (`limit_excluded`) and pulled OUT of `needsAttention` below;
    // `limitExcludedByMachine` is the reconcile worklist that replaces them — each line
    // is a (machine, process) whose `tooling_machine_limit` bound or production log
    // needs checking. Mirrors `limitSoftenedByMachine`.
    const limitExcludedRows = evaluated.filter(isLimitExcluded);
    for (const r of limitExcludedRows) r.limit_excluded = true;
    const limitExcludedCount = limitExcludedRows.length;
    // `limit_softened` rows classify normally (they get tooling — often COMPLETE), so
    // they are not a worklist row-by-row; the (machine, process) breakdown IS — each
    // line is a `tooling_machine_limit` bound a surgical fix should measure next.
    const limitSoftenedRows = evaluated.filter(isLimitSoftened);
    for (const r of limitSoftenedRows) r.limit_softened = true;
    const limitSoftenedCount = limitSoftenedRows.length;
    // (machine, process) → { machine, process, reason, cn_count }, sorted by cn_count DESC.
    // `reasonByCn` maps report cn → Map<displayName, reason> (the failing-limit text).
    const byMachineWorklist = (rows, reasonByCn) => {
      const m = new Map();   // "machine||process" → { machine, process, reason, cns:Set }
      for (const r of rows) {
        const machine = displayGroup(r.machine_type_name);
        const key = `${machine}||${r.process_code || '-'}`;
        if (!m.has(key)) {
          const s = reasonByCn.get(r.cn);
          const reason = (s && (s.get(machine) || s.get(r.machine_type_name)))
            || (nameToGroup[r.machine_type_name] && s && s.get(nameToGroup[r.machine_type_name]))
            || null;
          m.set(key, { machine, process: r.process_code || '-', reason, cns: new Set() });
        }
        m.get(key).cns.add(r.cn);
      }
      return [...m.values()]
        .map(({ cns, ...rest }) => ({ ...rest, cn_count: cns.size }))
        .sort((a, b) => b.cn_count - a.cn_count);
    };
    const limitSoftenedByMachine = byMachineWorklist(limitSoftenedRows, limitSoftenedByCn);
    const limitExcludedByMachine = byMachineWorklist(limitExcludedRows, limitExcludedByCn);

    // ── Stamp (approval) status — computed BEFORE coverage so COMPLETE can require
    // a FULL stamp (prepared+checked+approved). A stamp is keyed (cn, machine,
    // process); align to the group rep (repOf) so a stamp under any group member
    // matches the rep-named sheet. ──
    let stampSrc = { rows: [] };
    try {
      // `full` (segregation of duties): all three stages signed AND the approver is
      // not the preparer — one person cannot prepare and self-approve a sheet into
      // COMPLETE. (checked==prepared is tolerated; only the final approval gate is
      // enforced, the minimal SoD rule. Tighten to all-distinct if policy requires.)
      stampSrc = await engPool.query(`
        SELECT cn, machine_type_name, process_code,
               (prepared_em_id IS NOT NULL AND checked_em_id IS NOT NULL AND approved_em_id IS NOT NULL
                AND approved_em_id <> prepared_em_id) AS full,
               GREATEST(prepared_at, checked_at, approved_at) AS full_at
        FROM ${TABLES.SDS_APPROVAL}`);
    } catch (e) { /* table may not exist yet → every sheet reads as un-stamped */ }
    const anyStamp = new Set(), fullStamp = new Set(), fullStampAt = new Map();
    for (const s of stampSrc.rows) {
      const k = `${s.cn}||${repOf(s.machine_type_name)}||${s.process_code}`;
      anyStamp.add(k);
      if (s.full) { fullStamp.add(k); if (s.full_at) fullStampAt.set(k, s.full_at); }
    }
    for (const r of evaluated) {
      const k = `${r.cn}||${r.machine_type_name}||${r.process_code}`;
      r.stamped         = anyStamp.has(k);
      r.stamped_full    = fullStamp.has(k);
      // When the sheet became fully stamped (max of the three sign timestamps). Used
      // by monthlyStatus to attribute a completion to the month the WORK happened,
      // not the month the part was first produced.
      r.stamped_full_at = fullStampAt.get(k) || null;
    }

    // Finalize coverage level (after T-Select augmentation).
    //   coverage_level       = WITH the T-Select #1 fallback counted (current behaviour)
    //   coverage_level_saved = BASELINE — only a saved factory-plan tool counts as a match
    //                          (i.e. what the report would show WITHOUT T-Select #1)
    // The delta between them = the extra completes that T-Select #1 ( * ) unlocks.
    for (const r of evaluated) {
      Object.assign(r, classifyCoverage(r));
    }

    const total         = evaluated.length;
    const uniqueCnCount = new Set(evaluated.map(r => r.cn)).size;
    const complete      = evaluated.filter(r => r.coverage_level === 'COMPLETE').length;
    // Baseline complete (saved tools only, no T-Select #1). complete - completeSaved
    // = the completes unlocked by the T-Select #1 ( * ) fallback.
    const completeSaved = evaluated.filter(r => r.coverage_level_saved === 'COMPLETE').length;
    const missing       = evaluated.filter(r => r.coverage_level === 'MISSING').length;
    const toolMatch     = evaluated.filter(r => r.has_tooling_match).length;
    // Surface-grind rows counted as tooling-satisfied because no fixture is required
    // (informational — explains part of the tooling-gate pass rate).
    const toolingNotRequired = evaluated.filter(r => r.tooling_not_required).length;
    const excelConfig   = evaluated.filter(r => r.has_machine_template).length;
    // PDF-ready = tooling gate satisfied + Excel config, regardless of approval stamp.
    // Since COMPLETE now also requires a full stamp, this is the only metric that answers
    // "what % can actually be printed". pdfReady − complete = the NO_STAMP backlog.
    // The tooling gate must match classifyCoverage's — `tooling_not_required` (a real
    // no-fixture surface-grind sheet) prints fine and IS COMPLETE-eligible, so counting
    // only `has_tooling_match` here made pdfReady < complete possible and broke the
    // "pdfReady − complete = NO_STAMP" identity.
    const pdfReadyRows  = evaluated.filter(r => (r.has_tooling_match || r.tooling_not_required) && r.has_machine_template);
    const pdfReady      = pdfReadyRows.length;
    const pdfReadyPct   = total > 0 ? parseFloat(((pdfReady / total) * 100).toFixed(1)) : 0;

    // Gap breakdown: which (machine, process) contribute most to a missing piece.
    // Skip rows with no mapped machine_type_name (cannot be configured). Sorted
    // by count DESC = lowest coverage first → "config these to gain most completes".
    const topGaps = (rows, predicate) => {
      const m = new Map();
      for (const r of rows) {
        if (!r.machine_type_name || !predicate(r)) continue;
        const machine = displayGroup(r.machine_type_name); // show group label (e.g. KS-400B1/B2/B7)
        const key = `${machine}||${r.process_code || '-'}`;
        if (!m.has(key)) m.set(key, { machine, process: r.process_code || '-', count: 0 });
        m.get(key).count += 1;
      }
      return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    };
    // A tooling-not-required (surface-grind) row has no matched tool but is NOT a gap —
    // exclude it so it never appears in the "missing tooling" gap breakdown.
    const noToolMatchPred   = r => !r.has_tooling_match && !r.tooling_not_required;
    const noExcelConfigPred = r => !r.has_machine_template;

    // ── CNs needing attention — build first so pending KPI matches table row count ──
    // Use machine_code as fallback for null machine_type_name (unmapped machines)
    const cnMachineProcessKey = r =>
      `${r.cn}||${r.machine_type_name || r.machine_code || ''}||${r.process_code || ''}`;
    const cnMachineMap = new Map();
    for (const r of evaluated) {
      if (r.coverage_level !== 'PENDING') continue;
      // Limit-anomaly rows are excluded from the worklist — they rest on contradictory
      // data, not a missing piece of config. They stay flagged on the row and are
      // surfaced by `limitExcludedByMachine` / `kpi.limitExcluded` instead.
      if (r.limit_excluded) continue;
      cnMachineMap.set(cnMachineProcessKey(r), r);
    }
    const needsAttention = [...cnMachineMap.values()]
      .sort((a, b) => a.cn.localeCompare(b.cn));

    const pending    = needsAttention.length; // derived from table so both always match
    // Pending split by missing piece. toolReady* = rows whose tooling is already
    // solved (the only gap is the machine Excel Parameter Config) — configuring
    // that machine's template converts them straight to COMPLETE.
    const pendingByReason = {
      noExcel:          needsAttention.filter(r => r.pending_reason === 'NO_EXCEL').length,
      noTool:           needsAttention.filter(r => r.pending_reason === 'NO_TOOL').length,
      noToolNoExcel:    needsAttention.filter(r => r.pending_reason === 'NO_TOOL_NO_EXCEL').length,
      noStamp:          needsAttention.filter(r => r.pending_reason === 'NO_STAMP').length,
      // NO_STAMP split by tool provenance: a 'saved' row is genuinely just awaiting
      // signature; a 'tselect' row's tool is only the T-Select #1 suggestion, so it
      // may be blocked on tool confirmation, not the signature — don't conflate them.
      noStampSaved:     needsAttention.filter(r => r.pending_reason === 'NO_STAMP' && r.tooling_source === 'saved').length,
      noStampTselect:   needsAttention.filter(r => r.pending_reason === 'NO_STAMP' && r.tooling_source === 'tselect').length,
      toolReadySaved:   needsAttention.filter(r => r.pending_reason === 'NO_EXCEL' && r.tooling_source === 'saved').length,
      toolReadyTselect: needsAttention.filter(r => r.pending_reason === 'NO_EXCEL' && r.tooling_source === 'tselect').length,
    };
    const completePct    = total > 0 ? parseFloat(((complete / total) * 100).toFixed(1)) : 0;
    const completeSavedPct = total > 0 ? parseFloat(((completeSaved / total) * 100).toFixed(1)) : 0;
    const pendingPct = total > 0 ? parseFloat(((pending / total) * 100).toFixed(1)) : 0;

    // ── By part type (the configured set) ────────────────────────────────────
    const byPartType = partTypes.map(pt => {
      const rows = evaluated.filter(r => r.part_type === pt);
      if (!rows.length) return null;
      const ptComplete = rows.filter(r => r.coverage_level === 'COMPLETE').length;
      const ptCompleteSaved = rows.filter(r => r.coverage_level_saved === 'COMPLETE').length;
      const ptPending  = needsAttention.filter(r => r.part_type === pt).length;
      return {
        part_type:    pt,
        total:        rows.length,
        cn_count:     new Set(rows.map(r => r.cn)).size, // distinct CN (dedup across machine×process)
        complete:     ptComplete,
        complete_saved: ptCompleteSaved,  // baseline (saved only); complete - complete_saved = T-Select #1 boost
        pending:      ptPending,
        tool_match:   rows.filter(r => r.has_tooling_match).length,
        // Surface-grind rows counted as tooling-satisfied (no fixture needed) — NOT a
        // "no tool match" gap. Subtracted from the card's gap badge so they don't show
        // as missing tooling.
        tooling_not_required: rows.filter(r => r.tooling_not_required).length,
        excel_config: rows.filter(r => r.has_machine_template).length,
        complete_pct: parseFloat(((ptComplete / rows.length) * 100).toFixed(1)),
        complete_saved_pct: parseFloat(((ptCompleteSaved / rows.length) * 100).toFixed(1)),
        gaps: {
          noToolMatch:   topGaps(rows, noToolMatchPred),
          noExcelConfig: topGaps(rows, noExcelConfigPred),
        },
      };
    }).filter(Boolean);

    // ── Monthly new parts — count unique (CN × machine) pairs by first appearance ──
    // e.g. CN C31-00165 first seen on KS-03A in Mar 2026 AND KS-B22RD in Apr 2026 → counts 2
    const monthlyMap = new Map(); // 'YYYY-MM' → { <part_type>: count }
    const zeroMonth = () => Object.fromEntries(partTypes.map(t => [t, 0]));
    for (const row of cnMachinePairsDeduped) {
      const cn = normalizeCn(row.control_no);
      const pt = cnPartType(cn);
      if (!partTypes.includes(pt)) continue;
      if (EXCLUDED_CNS.has(cn)) continue;
      if (!row.first_seen) continue;
      const month = new Date(row.first_seen).toISOString().slice(0, 7);
      if (!monthlyMap.has(month)) monthlyMap.set(month, zeroMonth());
      monthlyMap.get(month)[pt] += 1;
    }
    const monthlyNewParts = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts }));

    // ── Monthly trend (from sds_parameter activity — when manual config was done) ──
    // Query 10 returns the last 24 months newest-first; restore chronological order.
    const monthlyTrend = sdsParamMonthRes.rows.slice().reverse();

    // ── Monthly coverage status — cumulative "% PDF-complete" by production month ─
    //
    // `complete` = a sheet that is TOOL + EXCEL ready AND fully approval-stamped
    // (`coverage_level === 'COMPLETE'`); `complete_saved` is the same via a factory-plan
    // tool only (the KZW baseline; the gap up to `complete` is the T-Select #1 boost).
    // Both numerator and denominator bucket on the sheet's FIRST-PRODUCED month, and
    // MISSING rows (no process plan at all) are excluded — so `complete_pct` reads
    // "of the sheets we could work on, how many are done" per production cohort.
    //
    // A closed month is served from `sds_coverage_monthly` (frozen the first build in
    // the next month) so a later config edit or a back-dated approval never rewrites a
    // bar already reported. Only the current month is recomputed live. See
    // `freezeMonthlyStatus`.
    const ym = (d) => new Date(d).toISOString().slice(0, 7);
    const stMon = new Map();   // first-produced 'YYYY-MM' → { workable, complete, completeSaved }
    for (const r of evaluated) {
      if (r.coverage_level === 'MISSING' || !r.first_prod_date) continue;
      const m = ym(r.first_prod_date);
      const e = stMon.get(m) || { workable: 0, complete: 0, completeSaved: 0 };
      e.workable += 1;
      if (r.coverage_level === 'COMPLETE')       e.complete += 1;
      if (r.coverage_level_saved === 'COMPLETE') e.completeSaved += 1;
      stMon.set(m, e);
    }
    let cumWorkable = 0, cumComplete = 0, cumCompleteSaved = 0;
    const monthlyStatusLive = [...stMon.keys()].sort().map((month) => {
      const d = stMon.get(month);
      cumWorkable      += d.workable;
      cumComplete      += d.complete;
      cumCompleteSaved += d.completeSaved;
      const pct = (n) => (cumWorkable > 0 ? parseFloat(((n / cumWorkable) * 100).toFixed(1)) : 0);
      return {
        month,
        complete:       cumComplete,         // tool + Excel + stamped, incl. T-Select #1
        complete_saved: cumCompleteSaved,    // same via factory-plan tool only (KZW)
        pending:        Math.max(0, cumWorkable - cumComplete),
        complete_pct:       pct(cumComplete),
        complete_saved_pct: pct(cumCompleteSaved),
      };
    });
    // Past months are served from the freeze table; only the current month is live.
    const monthlyStatus = await freezeMonthlyStatus(monthlyStatusLive);

    // NOTE: the dedicated "Stamp Tracking" page (and the `stamp` payload section it
    // consumed) was removed 2026-06-28. Once COMPLETE was redefined to require a
    // full approval stamp, the coverage report itself became the stamp tracker:
    // `pendingByReason.noStamp` + the NO_STAMP rows in `needsAttention` ARE the
    // PDF-ready-but-unsigned worklist, and `complete` == fully-signed PDF-ready.
    // The per-row r.stamped / r.stamped_full flags above still feed coverage_level;
    // only the now-redundant summary aggregation was dropped.

    const payload = {
      kpi: {
        total,
        uniqueCnCount,
        complete,             // PDF-ready AND fully signed
        completePct,
        pdfReady,             // tool + Excel config, regardless of stamp (printable set)
        pdfReadyPct,
        completeSaved,        // baseline: complete with saved tools only (no T-Select #1)
        completeSavedPct,
        pending,
        pendingPct,
        pendingByReason,
        missing,
        toolMatch,
        toolingNotRequired,   // surface-grind rows satisfied because no fixture needed
        excelConfig,
        gaps: {
          noToolMatch:   topGaps(evaluated, noToolMatchPred),
          noExcelConfig: topGaps(evaluated, noExcelConfigPred),
        },
        toolImageCount:     toolImagesRes.rows.length,
        grindingImageCount: parseInt(grindingImagesRes.rows[0].cnt, 10),
        machineCodeMapped:  machineCodesRes.rows.length,
        // Produced-but-size-limit-excluded (CN × machine) rows — over the limit AND no
        // sustained history. Still counted in `total`, but PULLED OUT of `needsAttention`
        // (they rest on contradictory data, not a config gap). `limitExcludedByMachine`
        // is the reconcile worklist — each (machine, process) has a tooling_machine_limit
        // bound or a production record that needs checking.
        limitExcluded:      limitExcludedCount,
        limitExcludedByMachine,
        // Over the limit BUT the floor has genuinely run the CN there → T-Select
        // softens it ('limit_note') instead of excluding. `limitSoftenedByMachine` is
        // the worklist: each (machine, process) here is a tooling_machine_limit bound
        // to measure against the plan and fix surgically.
        limitSoftened:          limitSoftenedCount,
        limitSoftenedByMachine,
      },
      // The configured part-type set (scope.part_types), in config order. Exposed so the
      // frontend charts (esp. "New Parts per Month") build their series from the scope
      // instead of a hardcoded ball/race/mecha list — add/remove a type in the report
      // config and the charts follow.
      partTypes,
      // Current fiscal year (Apr–Mar) + the previous-FY window, so the New Parts /
      // Cumulative Status charts window on this FY plus one leading prior-FY bar
      // without the frontend hardcoding month strings that break every April.
      fye: currentFyeWindow(),
      byPartType,
      monthlyTrend,
      monthlyNewParts,
      monthlyStatus,
      needsAttention,
      coverageLevelSummary: [
        { level: 'COMPLETE',     count: complete,    label: 'Complete (PDF Ready)' },
        { level: 'PENDING', count: pending, label: 'Pending (needs config)' },
      ],
    };

    return payload;
}

// Start a background build (idempotent — reuses the in-flight build if any),
// storing the payload in the cache on success.
function kickCoverageBuild() {
  if (_coverageBuilding) return _coverageBuilding;
  const p = buildCoverage().then(payload => {
    // Don't cache an empty build (total=0 = degraded, e.g. data pool down) — it
    // would serve an empty report for the whole TTL. This request still gets it.
    if (payload?.kpi?.total > 0) {
      const at = Date.now();
      _coverageCache = { at, data: payload };
      persistCoverage(payload, at); // fire-and-forget → survives restarts
      // Seed the board with the sheets that are printable but unsigned. Gated on
      // the same total>0 check: a degraded build reports everything as pending,
      // which would be a false backlog. Fire-and-forget and fail-open — the
      // report must never fail because a board is misconfigured.
      syncNoStampBacklog(payload.needsAttention, { io: _io })
        .catch(e => console.warn('[SDS Report] backlog intake failed:', e.message));
    } else {
      console.warn('[SDS Report] coverage build returned total=0 — not caching');
    }
    return payload;
  });
  _coverageBuilding = p;
  p.catch(err => console.error('[SDS Report] coverage build failed:', err.message))
   .finally(() => { if (_coverageBuilding === p) _coverageBuilding = null; });
  return p;
}

router.get('/coverage', async (req, res) => {
  try {
    // Fresh process with no in-memory cache → hydrate from the persisted copy so
    // we serve the previous result instantly instead of a cold 202/build.
    if (!_coverageCache && !req.query.refresh) {
      const persisted = await loadPersistedCoverage();
      if (persisted) _coverageCache = persisted;
    }

    const fresh = _coverageCache && Date.now() - _coverageCache.at < COVERAGE_TTL_MS;

    // Fresh cache → serve immediately
    if (!req.query.refresh && fresh) {
      return res.json({ ..._coverageCache.data, cached: true, cachedAt: new Date(_coverageCache.at).toISOString() });
    }

    // Stale cache → serve stale now, rebuild in background (stale-while-revalidate)
    if (!req.query.refresh && _coverageCache) {
      kickCoverageBuild();
      return res.json({ ..._coverageCache.data, cached: true, stale: true, cachedAt: new Date(_coverageCache.at).toISOString() });
    }

    // No cache (or ?refresh=1) → ensure a build is running. ?wait=1 awaits it
    // (heavy — only for tooling/CLI); otherwise return 202 so the client polls.
    const buildPromise = kickCoverageBuild();
    if (req.query.wait) {
      const data = await buildPromise;
      return res.json({ ...data, cached: false });
    }
    return res.status(202).json({ building: true });
  } catch (err) {
    console.error('[SDS Report] coverage:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sds/v2/report/backlog-to-board — push the report's unsigned-but-printable
 * (NO_STAMP, non-anomaly) sheets onto the project board's first list.
 *
 * Runs automatically after every coverage build; this is the manual trigger, for
 * seeding immediately after a config change instead of waiting out the 15-min TTL.
 * `?dryRun=1` lists what would be created without writing anything.
 *
 * Reads the cached payload only — it will not kick an expensive cold build.
 */
router.post('/backlog-to-board', isAdmin, async (req, res) => {
  try {
    if (!_coverageCache) {
      const persisted = await loadPersistedCoverage();
      if (persisted) _coverageCache = persisted;
    }
    if (!_coverageCache) {
      return res.status(409).json({ error: 'No coverage build available yet — open the coverage report first' });
    }
    const result = await syncNoStampBacklog(_coverageCache.data.needsAttention, {
      io: req.app.get('io'),
      dryRun: !!req.query.dryRun,
    });
    res.json({ ...result, builtAt: new Date(_coverageCache.at).toISOString() });
  } catch (err) {
    console.error('[SDS Report] backlog-to-board:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sds/v2/report/access-log
 */
router.post('/access-log', async (req, res) => {
  const { cn, machine_type_name, access_type, accessed_by } = req.body;
  if (!cn || !access_type) return res.status(400).json({ error: 'cn and access_type required' });
  const ALLOWED = ['VIEW', 'PDF', 'ADMIN'];
  if (!ALLOWED.includes(access_type)) {
    return res.status(400).json({ error: `access_type must be one of: ${ALLOWED.join(', ')}` });
  }
  try {
    await engPool.query(
      `INSERT INTO sds_access_log (cn, machine_type_name, access_type, accessed_by) VALUES ($1,$2,$3,$4)`,
      [cn, machine_type_name || null, access_type, accessed_by || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sds/v2/report/access-log
 */
router.get('/access-log', async (req, res) => {
  const { cn, limit = '50' } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 50, 500);
  try {
    const params = [];
    let where = '';
    // The log stores whatever CN form the viewer's page held (usually control-no); the
    // searcher may type either spelling or only a prefix. Match partial + both forms —
    // an exact `cn = $1` made "search by item-no" silently return nothing (mirrors the
    // /print-log filter).
    if (cn?.trim()) {
      const raw = cn.trim();
      const ctrl = cnFormat.toControlNo(raw) || raw;
      params.push(`%${raw}%`, `%${ctrl}%`);
      where = 'WHERE (cn ILIKE $1 OR cn ILIKE $2)';
    }
    const result = await engPool.query(
      `SELECT id, cn, machine_type_name, access_type, accessed_by, accessed_at
       FROM sds_access_log ${where}
       ORDER BY accessed_at DESC LIMIT ${lim}`,
      params
    );
    res.json({ rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * GET /api/sds/v2/report/print-log
 * Paged history of SDS PDFs actually produced (`sds_print_log`).
 *
 * Distinct from /access-log, which records who OPENED a sheet. This records what was
 * PRINTED — and is written by services/sdsPrintLog.js from both PDF paths, so it is the
 * one place that shows the deep-link traffic from Ball_Grinding_Plan alongside in-app use.
 *
 * Filters are all optional and AND together: cn (either spelling), machine, process, lot,
 * source ('app' | 'public'), and a from/to date window on printed_at. `lotState` narrows
 * on the three-way `lot_verified` — 'verified' | 'unverified' | 'none' — which is the
 * distinction the column exists to preserve (see the migration header).
 *
 * `tooling_snapshot` is returned as-is: it is the fixture list AS PRINTED, and the only
 * field that can answer "was this sheet the same as that one" — `pdf_sha256` cannot,
 * because Chrome stamps a generation timestamp into every PDF, so two renders of an
 * identical sheet one second apart differ by exactly those bytes.
 */
router.get('/print-log', async (req, res) => {
  const { cn, machine, process: processCode, lot, source, lotState, client, from, to } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('$?', `$${params.length}`)); };

  if (cn && cn.trim()) {
    // The table stores both spellings — `C35-00164` and `350164` — and a user types
    // whichever they have in hand, often only the first digits of it. So all three arms
    // are PARTIAL matches: an exact compare on item_no meant "35016" found nothing while
    // "350164" worked, which reads as the search being broken. The canonical control-no is
    // still derived so that typing the item number finds the row by its `cn` too.
    const raw = cn.trim();
    const ctrl = cnFormat.toControlNo(raw) || raw;
    params.push(`%${raw}%`, `%${ctrl}%`);
    where.push(`(cn ILIKE $${params.length - 1} OR item_no ILIKE $${params.length - 1} OR cn ILIKE $${params.length})`);
  }
  // One box searches both the model and the floor code — a user knows the sheet by one or
  // the other, rarely by which of the two the row happens to store.
  if (machine && machine.trim()) {
    params.push(`%${machine.trim()}%`);
    where.push(`(machine_type_name ILIKE $${params.length} OR machine_code ILIKE $${params.length})`);
  }
  if (processCode && processCode.trim()) add('process_code = $?', processCode.trim());
  if (lot && lot.trim())              add('lot_no ILIKE $?', `%${lot.trim()}%`);
  if (source && source.trim())        add('source = $?', source.trim());
  // "which computer asked" — matched against the resolved name or the raw address, since
  // a host with no PTR record is only ever identifiable by its IP.
  if (client && client.trim()) {
    params.push(`%${client.trim()}%`);
    where.push(`(client_host ILIKE $${params.length} OR client_ip ILIKE $${params.length})`);
  }
  if (from && from.trim())            add('printed_at >= $?', from.trim());
  if (to && to.trim())                add('printed_at < ($?::date + 1)', to.trim());

  if (lotState === 'verified')        where.push('lot_verified IS TRUE');
  else if (lotState === 'unverified') where.push('lot_verified IS FALSE');
  else if (lotState === 'none')       where.push('lot_no IS NULL');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const { rows: countRows } = await engPool.query(
      `SELECT count(*)::int AS total FROM ${TABLES.SDS_PRINT_LOG} ${clause}`, params);

    const { rows } = await engPool.query(
      `SELECT id, cn, item_no, parts_no, parts_name, lot_no, lot_verified,
              machine_type_name, machine_code, process_code, source, requested_by,
              pdf_sha256, pdf_bytes, tooling_snapshot, client_ip, client_host, printed_at
         FROM ${TABLES.SDS_PRINT_LOG} ${clause}
        ORDER BY printed_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}`, params);

    res.json({ success: true, total: countRows[0].total, page, limit, rows });
  } catch (e) {
    console.error('[print-log]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/sds/v2/report/print-log/facets — distinct values for the filter dropdowns. */
router.get('/print-log/facets', async (_req, res) => {
  try {
    const { rows } = await engPool.query(
      `SELECT
         (SELECT array_agg(DISTINCT machine_type_name ORDER BY machine_type_name)
            FROM ${TABLES.SDS_PRINT_LOG} WHERE machine_type_name IS NOT NULL) AS machines,
         (SELECT array_agg(DISTINCT machine_code ORDER BY machine_code)
            FROM ${TABLES.SDS_PRINT_LOG} WHERE machine_code IS NOT NULL) AS machine_codes,
         (SELECT array_agg(DISTINCT process_code ORDER BY process_code)
            FROM ${TABLES.SDS_PRINT_LOG} WHERE process_code IS NOT NULL) AS processes,
         (SELECT array_agg(DISTINCT source ORDER BY source)
            FROM ${TABLES.SDS_PRINT_LOG}) AS sources,
         (SELECT array_agg(DISTINCT coalesce(client_host, client_ip) ORDER BY coalesce(client_host, client_ip))
            FROM ${TABLES.SDS_PRINT_LOG} WHERE client_ip IS NOT NULL) AS clients`);
    res.json({ success: true, ...rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/sds/v2/report/parameters/bulk-import
 * Bulk-upsert sds_parameter rows from CSV payload.
 * Body: { rows: [{ cn, machine_type_name, param_key, param_value }], updated_by }
 *
 * Writes the same table as sdsV2AdminController's PUT /parameters — so it carries the
 * identical guard (isAdmin = 'AD' or 'sds_admin' feature) and cache flush (flushSds).
 */
router.post('/parameters/bulk-import', isAdmin, flushSds, async (req, res) => {
  const { rows, updated_by } = req.body;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  // Identity columns must be present AND non-blank: a blank `cn` is not NULL, so
  // COALESCE(cn, '__machine_config__') would treat '' as a real key and write a row
  // that matches nothing on read. `param_value` may legitimately be '' (clearing a
  // value), so it is only checked for presence.
  const KEY_FIELDS = ['cn', 'machine_type_name', 'param_key'];
  for (let i = 0; i < rows.length; i++) {
    for (const f of KEY_FIELDS) {
      if (rows[i][f] == null || !String(rows[i][f]).trim()) {
        return res.status(400).json({ error: `Row ${i}: '${f}' is required and must not be blank` });
      }
    }
    if (rows[i].param_value == null) {
      return res.status(400).json({ error: `Row ${i}: missing 'param_value'` });
    }
  }
  const CHUNK = 200;
  let inserted = 0;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const COLS = 5;
      const placeholders = chunk.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      const vals = chunk.flatMap(r => [
        String(r.cn).trim(), String(r.machine_type_name).trim(), String(r.param_key).trim(),
        String(r.param_value), updated_by || null,
      ]);
      await client.query(
        // process_code omitted → defaults NULL (process-agnostic); the ON CONFLICT target
        // must still list all four index expressions to match the rebuilt uq_sds_parameter.
        `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value, updated_by)
         VALUES ${placeholders}
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
         DO UPDATE SET param_value = EXCLUDED.param_value,
                       updated_by  = EXCLUDED.updated_by,
                       updated_at  = NOW()`,
        vals
      );
      inserted += chunk.length;
    }
    await client.query('COMMIT');
    res.json({ ok: true, inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Report scope config (admin) ──────────────────────────────────────────────
// Separate from sds_audit_config (Data Integrity) by design. The report page is
// unchanged; this is edited from the SDS Admin → Configure Settings tab.

/** GET /api/sds/v2/report/config — effective scope (defaults overlaid with overrides) */
router.get('/config', async (req, res) => {
  try {
    res.json({ success: true, data: await getReportScope(), defaults: DEFAULT_REPORT_SCOPE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TEMPLATE_B conformance ───────────────────────────────────────────────────
// Cheap enough (~1.5 s: one workbook parse plus four queries) that it needs none of the
// coverage report's 202/poll machinery — a short TTL and a persisted copy are enough.
// The persisted row is what makes a fresh process answer instantly instead of parsing
// 31 sheets for the first caller.
const CONFORMANCE_TTL_MS = 10 * 60 * 1000;
let _conformanceCache = null;

async function loadPersistedConformance() {
  try {
    await ensureCoverageTable();
    const r = await engPool.query(
      `SELECT data, built_at FROM sds_coverage_cache WHERE id = 'template_b_conformance' LIMIT 1`);
    if (r.rows[0] && r.rows[0].data?.kpi?.pairsInTemplateB > 0) {
      return { at: new Date(r.rows[0].built_at).getTime(), data: r.rows[0].data };
    }
  } catch (e) { console.error('[SDS Report] load persisted conformance failed:', e.message); }
  return null;
}

/**
 * GET /api/sds/v2/report/template-b-conformance
 *
 * How much of TEMPLATE_B the live Machine Tool Config covers, per (machine, process).
 * `?refresh=1` rebuilds instead of serving the cache — use it right after editing config,
 * which is the whole reason this is a page rather than a static export.
 */
router.get('/template-b-conformance', async (req, res) => {
  try {
    if (!_conformanceCache && !req.query.refresh) {
      const persisted = await loadPersistedConformance();
      if (persisted) _conformanceCache = persisted;
    }
    const fresh = _conformanceCache && Date.now() - _conformanceCache.at < CONFORMANCE_TTL_MS;
    if (!req.query.refresh && fresh) {
      return res.json({ ..._conformanceCache.data, cached: true,
                        cachedAt: new Date(_conformanceCache.at).toISOString() });
    }

    const data = await templateBConformance.build();
    const at = Date.now();
    _conformanceCache = { at, data };
    // fire-and-forget: a persist failure must not fail the request
    ensureCoverageTable()
      .then(() => engPool.query(
        `INSERT INTO sds_coverage_cache (id, data, built_at) VALUES ('template_b_conformance', $1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, built_at = EXCLUDED.built_at`,
        [data, new Date(at)]))
      .catch((e) => console.error('[SDS Report] persist conformance failed:', e.message));

    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[SDS Report] template-b-conformance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Selection-condition conformance ─────────────────────────────────────────
// Sibling of the TEMPLATE_B page: does every tooling the index workbook
// (20260202_Tooling_Excel_List.xlsm) puts in Tooling Select scope actually have a
// selection rule (formula + search_rule), a per-C/N pin, or a recorded reason it has
// neither. Same cheap shape — a short TTL plus a persisted copy.
let _selCondCache = null;

async function loadPersistedSelCond() {
  try {
    await ensureCoverageTable();
    const r = await engPool.query(
      `SELECT data, built_at FROM sds_coverage_cache WHERE id = 'selection_condition_conformance' LIMIT 1`);
    if (r.rows[0] && r.rows[0].data?.kpi?.scoped > 0) {
      return { at: new Date(r.rows[0].built_at).getTime(), data: r.rows[0].data };
    }
  } catch (e) { console.error('[SDS Report] load persisted selection-cond failed:', e.message); }
  return null;
}

/**
 * GET /api/sds/v2/report/selection-condition-conformance
 *
 * Per scoped tooling family: whether the live config can actually SELECT it.
 * `?refresh=1` rebuilds instead of serving the 10-min cache.
 */
router.get('/selection-condition-conformance', async (req, res) => {
  try {
    if (!_selCondCache && !req.query.refresh) {
      const persisted = await loadPersistedSelCond();
      if (persisted) _selCondCache = persisted;
    }
    const fresh = _selCondCache && Date.now() - _selCondCache.at < CONFORMANCE_TTL_MS;
    if (!req.query.refresh && fresh) {
      return res.json({ ..._selCondCache.data, cached: true,
                        cachedAt: new Date(_selCondCache.at).toISOString() });
    }

    const data = await selectionConditionConformance.build();
    const at = Date.now();
    _selCondCache = { at, data };
    ensureCoverageTable()
      .then(() => engPool.query(
        `INSERT INTO sds_coverage_cache (id, data, built_at) VALUES ('selection_condition_conformance', $1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, built_at = EXCLUDED.built_at`,
        [data, new Date(at)]))
      .catch((e) => console.error('[SDS Report] persist selection-cond failed:', e.message));

    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[SDS Report] selection-condition-conformance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sds/v2/report/wc-options — work centers from rodpc.m_workcenter (code + name) */
router.get('/wc-options', async (req, res) => {
  try {
    const r = await rodpcPool.query(`SELECT wc_code, name FROM rodpc.m_workcenter WHERE status = '1' ORDER BY wc_code`);
    res.json(r.rows.map(x => ({ value: String(x.wc_code), label: `${x.wc_code} — ${x.name || ''}`.trim() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/sds/v2/report/config — upsert scope keys; flushes the coverage cache so the next build uses the new scope */
router.put('/config', isAdmin, async (req, res) => {
  const ARRAY_KEYS = ['part_types', 'process_codes', 'work_centers', 'excluded_cns', 'tooling_optional_machines'];
  try {
    await ensureReportConfigTable();
    const entries = Object.entries(req.body || {}).filter(([k]) => k in DEFAULT_REPORT_SCOPE);
    for (const [key, raw] of entries) {
      let value = raw;
      if (ARRAY_KEYS.includes(key)) {
        if (!Array.isArray(value)) return res.status(400).json({ error: `${key} must be an array` });
        value = [...new Set(value.map(v => String(v).trim()).filter(Boolean))];
      } else if (key === 'since_date') {
        value = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: 'since_date must be YYYY-MM-DD' });
      }
      await engPool.query(
        `INSERT INTO sds_report_config (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    invalidateCoverageCache();
    res.json({ success: true, data: await getReportScope() });
  } catch (err) {
    console.error('[report-config PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Warm the cache shortly after process start so users almost never hit a cold
// build: hydrate the in-memory cache from the persisted copy, and only kick a
// (background) rebuild when there's nothing persisted or it's already stale.
// Small delay so this never competes with server startup / first requests.
setTimeout(() => {
  loadPersistedCoverage()
    .then((persisted) => {
      if (persisted) _coverageCache = persisted;
      const stale = !persisted || Date.now() - persisted.at >= COVERAGE_TTL_MS;
      if (stale) kickCoverageBuild();
    })
    .catch(() => {});
}, 8000);

module.exports = router;
module.exports.invalidateCoverageCache = invalidateCoverageCache;
module.exports.classifyCoverage = classifyCoverage;
module.exports.buildCoverage = buildCoverage; // exposed for tests / CLI verification
