const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES } = require('../mtcConstants');
const tselectFallback = require('../services/tselectFallback');
const cnFormat = require('../utils/cnFormat');
const { isAdmin } = require('../../../../middleware/mtcAuth');

const router = express.Router();

// Full coverage-result cache. A cold build is expensive (the Tooling Select
// fallback runs hundreds of per-CN searches), so cache the assembled payload
// and serve it for COVERAGE_TTL_MS. Pass ?refresh=1 to force a rebuild.
let _coverageCache = null;     // { at, data }
let _coverageBuilding = null;  // Promise<payload> while a build is in flight
const COVERAGE_TTL_MS = 15 * 60 * 1000;

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

      // 10. Monthly sds_parameter additions
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
        ORDER BY DATE_TRUNC('month', first_seen)
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

    // Exclude PSG-52AN (SGM-01) entirely; exclude other SGM for face-grind (1021/1022) only
    const cnMachinePairs = cnMachinePairsRes.rows.filter(row => {
      if (row.machine === 'SGM-01') return false;
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
        has_machine_template: hasMachineTemplate,
        param_count:          perRecordCount,
        tooling_source:       hasTooling ? 'saved' : null,
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
      if (r.has_tooling_match || !r.machine_type_name) continue;
      const sc = toSpecCn(r.cn);
      if (sc && specCnSet.has(sc)) needTs.set(r.cn, sc);
    }

    // Search in bounded-concurrency batches: each search fans out internally over
    // machines × toolings, so a small outer concurrency keeps the pg pool (max 20)
    // healthy while cutting wall time ~2.7× vs fully sequential. Verified: no pool
    // timeouts at concurrency 8; 6 is the safe default.
    const tsByCn = new Map();
    const tsEntries = [...needTs.entries()];
    const TS_CONCURRENCY = 6;
    for (let i = 0; i < tsEntries.length; i += TS_CONCURRENCY) {
      const batch = tsEntries.slice(i, i + TS_CONCURRENCY);
      await Promise.all(batch.map(async ([cn, sc]) => {
        tsByCn.set(cn, await tselectFallback.safeSearch(sc));
      }));
    }

    for (const r of evaluated) {
      if (r.has_tooling_match || !r.machine_type_name) continue;
      const tsResult = tsByCn.get(r.cn);
      if (!tsResult) continue;
      const acceptable = new Set([r.machine_type_name]);
      if (nameToGroup[r.machine_type_name]) acceptable.add(nameToGroup[r.machine_type_name]);
      // Gate by grinding direction: a T-Select tooling set computed for the part's
      // direction must not satisfy an opposite-direction process_code row.
      if (tselectFallback.tselectToolsForMachine(tsResult, acceptable, { processCode: r.process_code }).length > 0) {
        r.has_tooling_match = true;
        r.tooling_source = 'tselect';
      }
    }

    // Finalize coverage level (after T-Select augmentation).
    //   coverage_level       = WITH the T-Select #1 fallback counted (current behaviour)
    //   coverage_level_saved = BASELINE — only a saved factory-plan tool counts as a match
    //                          (i.e. what the report would show WITHOUT T-Select #1)
    // The delta between them = the extra completes that T-Select #1 ( * ) unlocks.
    for (const r of evaluated) {
      r.coverage_level =
        r.has_tooling_match && r.has_machine_template ? 'COMPLETE' :
        r.has_process                                 ? 'PENDING'  :
                                                        'MISSING';
      r.coverage_level_saved =
        r.tooling_source === 'saved' && r.has_machine_template ? 'COMPLETE' :
        r.has_process                                          ? 'PENDING'  :
                                                                 'MISSING';
    }

    const total         = evaluated.length;
    const uniqueCnCount = new Set(evaluated.map(r => r.cn)).size;
    const complete      = evaluated.filter(r => r.coverage_level === 'COMPLETE').length;
    // Baseline complete (saved tools only, no T-Select #1). complete - completeSaved
    // = the completes unlocked by the T-Select #1 ( * ) fallback.
    const completeSaved = evaluated.filter(r => r.coverage_level_saved === 'COMPLETE').length;
    const missing       = evaluated.filter(r => r.coverage_level === 'MISSING').length;
    const toolMatch     = evaluated.filter(r => r.has_tooling_match).length;
    const excelConfig   = evaluated.filter(r => r.has_machine_template).length;

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
    const noToolMatchPred   = r => !r.has_tooling_match;
    const noExcelConfigPred = r => !r.has_machine_template;

    // ── CNs needing attention — build first so pending KPI matches table row count ──
    // Use machine_code as fallback for null machine_type_name (unmapped machines)
    const cnMachineProcessKey = r =>
      `${r.cn}||${r.machine_type_name || r.machine_code || ''}||${r.process_code || ''}`;
    const cnMachineMap = new Map();
    for (const r of evaluated) {
      if (r.coverage_level !== 'PENDING') continue;
      cnMachineMap.set(cnMachineProcessKey(r), r);
    }
    const needsAttention = [...cnMachineMap.values()]
      .sort((a, b) => a.cn.localeCompare(b.cn));

    const pending    = needsAttention.length; // derived from table so both always match
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
    const monthlyTrend = sdsParamMonthRes.rows;

    // ── Monthly coverage status — cumulative running total by first-seen month ──
    const monthlyStatusMap = new Map();
    for (const r of evaluated) {
      if (!r.first_prod_date) continue;
      const month = new Date(r.first_prod_date).toISOString().slice(0, 7);
      if (!monthlyStatusMap.has(month)) monthlyStatusMap.set(month, { complete: 0, completeSaved: 0, pending: 0 });
      const entry = monthlyStatusMap.get(month);
      if (r.coverage_level === 'COMPLETE') entry.complete += 1;
      else if (r.coverage_level === 'PENDING') entry.pending += 1;
      if (r.coverage_level_saved === 'COMPLETE') entry.completeSaved += 1;
    }
    let cumComplete = 0;
    let cumCompleteSaved = 0;
    let cumAutoPending = 0;
    const monthlyStatus = [...monthlyStatusMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, c]) => {
        cumComplete      += c.complete;
        cumCompleteSaved += c.completeSaved;
        cumAutoPending   += c.pending;
        const total = cumComplete + cumAutoPending;
        return {
          month,
          complete:       cumComplete,         // with T-Select #1
          complete_saved: cumCompleteSaved,    // baseline (saved only)
          pending: cumAutoPending,
          complete_pct: total > 0 ? parseFloat(((cumComplete / total) * 100).toFixed(1)) : 0,
          complete_saved_pct: total > 0 ? parseFloat(((cumCompleteSaved / total) * 100).toFixed(1)) : 0,
        };
      });

    const payload = {
      kpi: {
        total,
        uniqueCnCount,
        complete,
        completePct,
        completeSaved,        // baseline: complete with saved tools only (no T-Select #1)
        completeSavedPct,
        pending,
        pendingPct,
        missing,
        toolMatch,
        excelConfig,
        gaps: {
          noToolMatch:   topGaps(evaluated, noToolMatchPred),
          noExcelConfig: topGaps(evaluated, noExcelConfigPred),
        },
        toolImageCount:     toolImagesRes.rows.length,
        grindingImageCount: parseInt(grindingImagesRes.rows[0].cnt, 10),
        machineCodeMapped:  machineCodesRes.rows.length,
      },
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
    _coverageCache = { at: Date.now(), data: payload };
    return payload;
  });
  _coverageBuilding = p;
  p.catch(err => console.error('[SDS Report] coverage build failed:', err.message))
   .finally(() => { if (_coverageBuilding === p) _coverageBuilding = null; });
  return p;
}

router.get('/coverage', async (req, res) => {
  try {
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
    if (cn?.trim()) { params.push(cn.trim()); where = 'WHERE cn = $1'; }
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
 * POST /api/sds/v2/report/parameters/bulk-import
 * Bulk-upsert sds_parameter rows from CSV payload.
 * Body: { rows: [{ cn, machine_type_name, param_key, param_value }], updated_by }
 */
router.post('/parameters/bulk-import', async (req, res) => {
  const { rows, updated_by } = req.body;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  const REQUIRED = ['cn', 'machine_type_name', 'param_key', 'param_value'];
  for (let i = 0; i < rows.length; i++) {
    for (const f of REQUIRED) {
      if (rows[i][f] == null) return res.status(400).json({ error: `Row ${i}: missing '${f}'` });
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
        r.cn, r.machine_type_name, r.param_key, String(r.param_value), updated_by || null,
      ]);
      await client.query(
        `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value, updated_by)
         VALUES ${placeholders}
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key)
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
  const ARRAY_KEYS = ['part_types', 'process_codes', 'work_centers', 'excluded_cns'];
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

module.exports = router;
