'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TSV2_TABLES } = require('../tsv2Constants');
const formulaService = require('./FormulaService');

// ── Spec ────────────────────────────────────────────────────────────────────

/**
 * Build formula evaluation context from spec row (tooling_spec_process).
 *
 * After  : OD/ID/W (nominal) · odAft_max/odAft_min = nominal + tolerance delta (absolute bounds)
 * Before : odBf/idBf/wBf (nominal) · odBf_max/odBf_min = nominal + tolerance delta
 * Flags  : isBallInner, isABR, isIDtoOD, isODtoID  (1=true / 0=false)
 *
 * DB tolerance columns (od_aft_max, od_aft_min …) store signed DELTA from nominal,
 * so the context already converts them to absolute values (nominal + delta).
 */
function buildSpecContext(spec) {
  const num  = (v) => (v !== null && v !== undefined && v !== '') ? Number(v) : 0;
  const str  = (v) => (v ?? '').toString().toUpperCase().trim();
  const flag = (v) => v ? 1 : 0;

  const od   = num(spec.od_aft);
  const id   = num(spec.id_aft);
  const w    = num(spec.w_aft);
  const sd   = num(spec.sd ?? 0);
  const odBf = num(spec.od_bf);
  const idBf = num(spec.id_bf);
  const wBf  = num(spec.w_bf);

  const type    = str(spec.type);
  const yball   = str(spec.yball);
  const process = str(spec.process ?? '');

  return {
    // ── After (nominal) ───────────────────────────────────────────────────────
    OD: od, ID: id, W: w, SD: sd,
    odAft: od, idAft: id, wAft: w,

    // After max / min — DB stores tolerance DELTA; nominal + delta = absolute bound
    // e.g. od_aft=22.555, od_aft_max=0, od_aft_min=-0.01 → upper=22.555, lower=22.545
    odAft_max: od + num(spec.od_aft_max), odAft_min: od + num(spec.od_aft_min),
    idAft_max: id + num(spec.id_aft_max), idAft_min: id + num(spec.id_aft_min),
    wAft_max:  w  + num(spec.w_aft_max),  wAft_min:  w  + num(spec.w_aft_min),

    // ── Before (nominal + max / min) ──────────────────────────────────────────
    odBf, idBf, wBf,
    odBf_max: odBf + num(spec.od_bf_max), odBf_min: odBf + num(spec.od_bf_min),
    idBf_max: idBf + num(spec.id_bf_max), idBf_min: idBf + num(spec.id_bf_min),
    wBf_max:  wBf  + num(spec.w_bf_max),  wBf_min:  wBf  + num(spec.w_bf_min),

    // ── Derived boolean flags (1 = true, 0 = false) ───────────────────────────
    isBallInner: flag(type.includes('INNER') || yball === 'Y'),
    isABR:       flag(type.includes('ABR')),
    isIDtoOD:    flag(process === 'ID->OD'),
    isODtoID:    flag(process === 'OD->ID'),

    // ── Raw strings ───────────────────────────────────────────────────────────
    Type: type, YBall: yball, Process: process,
  };
}

// ── Machine Limit Check ──────────────────────────────────────────────────────

async function checkMachineLimits(machineId, ctx) {
  const { rows } = await engPool.query(
    `SELECT * FROM ${TSV2_TABLES.LIMIT}
      WHERE machine_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [machineId]
  );

  for (const limit of rows) {
    const key = limit.input_var;
    const val = ctx[key] !== undefined ? ctx[key] : ctx[key.toLowerCase()];
    if (val === undefined || val === null) continue;

    if (limit.min_value !== null) {
      const ok = limit.min_inclusive ? val >= Number(limit.min_value) : val > Number(limit.min_value);
      if (!ok) return { ok: false, reason: `${key}=${val} < min ${limit.min_value}` };
    }
    if (limit.max_value !== null) {
      const ok = limit.max_inclusive ? val <= Number(limit.max_value) : val < Number(limit.max_value);
      if (!ok) return { ok: false, reason: `${key}=${val} > max ${limit.max_value}` };
    }
  }
  return { ok: true };
}

// ── Inventory Table Validation ───────────────────────────────────────────────

const _validatedTables = new Set();
async function assertTableExists(table) {
  if (_validatedTables.has(table)) return;
  const r = await engPool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  if (r.rows.length === 0) throw new Error(`Table "${table}" not found`);
  _validatedTables.add(table);
}

// Column names are validated against information_schema to prevent injection
const _columnCache = new Map();
async function getTableColumns(table) {
  if (_columnCache.has(table)) return _columnCache.get(table);
  const r = await engPool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  const cols = new Set(r.rows.map(row => row.column_name));
  _columnCache.set(table, cols);
  return cols;
}

// ── Inventory Search ─────────────────────────────────────────────────────────

/**
 * Search inventory table using the search rules for one (machine, tooling).
 *
 * Rules with tolerance (tol_plus/tol_minus set):
 *   → WHERE col BETWEEN (computed − tol_minus) AND (computed + tol_plus)
 * Rules without tolerance (both null):
 *   → no WHERE filter; contribute to combined-distance ORDER BY only
 *
 * ALL active rules (withTol + withoutTol) contribute to a single combined-distance
 * ORDER BY: SUM of ABS(col − computed) across all dimensions. This ensures the
 * returned rows are the closest overall matches, not just the closest by dim_a.
 *
 * Returns top 2 rows.
 */
async function searchInventory(machine, rules, computedDims) {
  const tableOverride = rules[0]?.inventory_table_override || null;
  const { inventory_table: baseTable, inventory_machine_filter: machineFilter } = machine;
  const table = tableOverride || baseTable;
  if (!table) return [];

  await assertTableExists(table);
  const validCols = await getTableColumns(table);

  const conditions   = [];
  const params       = [];
  let   pi           = 1;

  // Optional machine column filter
  if (machineFilter && validCols.has('Machine')) {
    conditions.push(`"Machine" = $${pi++}`);
    params.push(machineFilter);
  }

  // Optional inventory tooling_name filter (from search rule inventory_tooling_filter)
  // Exact case-insensitive match — prevents e.g. 'LOADER' from matching 'NYLON LOADER'
  const inventoryToolingFilter = rules.find(r => r.inventory_tooling_filter)?.inventory_tooling_filter;
  if (inventoryToolingFilter && validCols.has('tooling_name')) {
    conditions.push(`"tooling_name" ILIKE $${pi++}`);
    params.push(inventoryToolingFilter);
  }

  const withTol    = rules.filter(r => r.tol_plus !== null || r.tol_minus !== null);
  const withoutTol = rules.filter(r => r.tol_plus === null && r.tol_minus === null);

  // distanceRules: rules that contribute to ORDER BY, each carrying its sort_priority
  // Sorted by sort_priority → builds hierarchical ORDER BY (col0 ASC, col1 ASC …)
  // so priority=0 is primary sort key, priority=1 is tie-breaker only.
  const distanceRules = [];

  for (const rule of withTol) {
    const computed = computedDims[rule.output_key];
    if (computed === undefined || !validCols.has(rule.inventory_column)) continue;

    const hasTolPlus  = rule.tol_plus  !== null;
    const hasTolMinus = rule.tol_minus !== null;
    const col = `"${rule.inventory_column}"::numeric`;

    if (hasTolPlus && hasTolMinus) {
      // Both sides → BETWEEN lo AND hi
      const lo = computed - Math.abs(Number(rule.tol_minus));
      const hi = computed + Math.abs(Number(rule.tol_plus));
      conditions.push(`${col} BETWEEN $${pi} AND $${pi + 1}`);
      params.push(lo, hi);
      pi += 2;
    } else if (hasTolPlus) {
      // Only upper bound → col <= computed + tol_plus
      const hi = computed + Math.abs(Number(rule.tol_plus));
      conditions.push(`${col} <= $${pi++}`);
      params.push(hi);
    } else {
      // Only lower bound → col >= computed - tol_minus
      const lo = computed - Math.abs(Number(rule.tol_minus));
      conditions.push(`${col} >= $${pi++}`);
      params.push(lo);
    }

    // is_match_dim=false → keep the tolerance WHERE filter above, but exclude
    // this dim from the closest-match ranking (lets admins rank by OD/ID/W
    // part-fit dims only, ignoring constant / SD-lookup dims).
    if (rule.is_match_dim !== false) {
      distanceRules.push({ col: rule.inventory_column, computed, priority: rule.sort_priority ?? 0 });
    }
  }

  for (const rule of withoutTol) {
    const computed = computedDims[rule.output_key];
    if (computed === undefined || !validCols.has(rule.inventory_column)) continue;
    if (rule.is_match_dim !== false) {
      distanceRules.push({ col: rule.inventory_column, computed, priority: rule.sort_priority ?? 0 });
    }
  }

  // Fallback: if every dim was excluded from ranking (all is_match_dim=false),
  // rank by all mapped dims so we still return a deterministic closest match.
  if (distanceRules.length === 0) {
    for (const rule of rules) {
      const computed = computedDims[rule.output_key];
      if (computed === undefined || !validCols.has(rule.inventory_column)) continue;
      distanceRules.push({ col: rule.inventory_column, computed, priority: rule.sort_priority ?? 0 });
    }
  }

  // Sort by priority so ORDER BY terms are hierarchical (primary first)
  distanceRules.sort((a, b) => a.priority - b.priority);

  let sql = `SELECT * FROM "${table}"`;
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;

  if (distanceRules.length > 0) {
    const distTerms = distanceRules.map(({ col, computed }) => {
      params.push(computed);
      return `ABS("${col}"::numeric - $${pi++})`;
    });
    sql += ` ORDER BY (${distTerms.join(' + ')}) ASC`;
  }

  sql += ' LIMIT 2';

  const { rows } = await engPool.query(sql, params);
  return rows;
}

// ── Post-processing: suffix-link SUPPORT BLOCK to LOADING CHUTE ─────────────
//
// SUPPORT BLOCK (4664-03-XXXX) and LOADING CHUTE (4664-02-XXXX) are designed
// as matched pairs sharing the same 4-digit suffix XXXX. Independent
// dimension-based searches can return mismatched suffixes, so after all
// tooling searches complete we pin the SUPPORT BLOCK to the exact item whose
// suffix matches the best LOADING CHUTE result.
//
// Falls back to the dimension-based result when no suffix match exists.
async function _linkSupportBlockToLoadingChute(results, machineByDisplay) {
  // Group results by machine
  const byMachine = {};
  for (const r of results) {
    if (!byMachine[r.machine]) byMachine[r.machine] = {};
    byMachine[r.machine][r.tooling] = r;
  }

  for (const [machineName, toolings] of Object.entries(byMachine)) {
    const lc = toolings['LOADING CHUTE'];
    const sb = toolings['SUPPORT BLOCK'];
    if (!lc?.matches?.[0] || !sb) continue;

    const lcNo = lc.matches[0].tooling_no;
    if (!lcNo || !/^4664-02-/.test(lcNo)) continue;

    const sbNo = lcNo.replace('4664-02-', '4664-03-');
    const table = machineByDisplay[machineName]?.inventory_table;
    if (!table) continue;

    const { rows } = await engPool.query(
      `SELECT * FROM "${table}" WHERE tooling_no = $1 LIMIT 1`,
      [sbNo]
    );
    if (rows.length > 0) {
      sb.matches = rows;
    }
  }
}

// ── CN Normalization ─────────────────────────────────────────────────────────
// tooling_spec_process stores CNs in 6-digit format (e.g. '250190').
// Accept Cxx-0YYYY input and normalize so both formats find the spec.
function normalizeSpecCn(cn) {
  const s = String(cn).trim().toUpperCase();
  if (/^\d{6}$/.test(s)) return s;
  const m = s.match(/^[A-Z](\d{2})-0*(\d{4})$/);
  if (m) return m[1] + m[2];
  return s;
}

// ── Main Search ──────────────────────────────────────────────────────────────

async function search(cn) {
  const specCn = normalizeSpecCn(cn);
  const specRes = await engPool.query(
    `SELECT * FROM ${TSV2_TABLES.SPEC_PROCESS} WHERE cn = $1 LIMIT 1`,
    [specCn]
  );
  if (!specRes.rows.length) {
    return { success: false, error: 'Part spec not found', cn };
  }
  const spec    = specRes.rows[0];
  const specCtx = buildSpecContext(spec);

  const machinesRes = await engPool.query(
    `SELECT * FROM ${TSV2_TABLES.MACHINE} WHERE enabled = true ORDER BY machine_name ASC`
  );

  // Deduplicate grouped machines: for machines sharing the same machine_group,
  // run search once using the first representative and label results with the group name.
  const seenGroups = new Set();
  const searchMachines = machinesRes.rows.reduce((acc, m) => {
    if (!m.machine_group) { acc.push(m); return acc; }
    if (!seenGroups.has(m.machine_group)) {
      seenGroups.add(m.machine_group);
      acc.push({ ...m, _displayName: m.machine_group });
    }
    return acc;
  }, []);

  const results = [];
  const warnings = [];

  await Promise.all(searchMachines.map(async (machine) => {
    const displayName = machine._displayName || machine.machine_name;
    try {
      const limitCheck = await checkMachineLimits(machine.id, specCtx);
      if (!limitCheck.ok) {
        warnings.push({ machine: displayName, reason: limitCheck.reason });
        return;
      }

      const toolingsRes = await engPool.query(
        `SELECT DISTINCT tooling_name FROM ${TSV2_TABLES.FORMULA}
          WHERE machine_id = $1
          ORDER BY tooling_name ASC`,
        [machine.id]
      );

      await Promise.all(toolingsRes.rows.map(async ({ tooling_name }) => {
        try {
          const computedDims = await formulaService.computeDimensions(machine.id, tooling_name, specCtx);

          const rulesRes = await engPool.query(
            `SELECT * FROM ${TSV2_TABLES.SEARCH_RULE}
              WHERE machine_id = $1 AND tooling_name = $2
              ORDER BY sort_priority ASC, id ASC`,
            [machine.id, tooling_name]
          );
          if (!rulesRes.rows.length) return;

          const matches = await searchInventory(machine, rulesRes.rows, computedDims);

          // Map computed key → inventory column (e.g. A → dim_a) for frontend display
          const columnMap = {};
          for (const r of rulesRes.rows) columnMap[r.output_key] = r.inventory_column;

          // Inventory columns whose rule feeds the closest-match ranking
          // (is_match_dim) — used by the UI to highlight those result headers.
          const matchDimCols = rulesRes.rows
            .filter(r => r.is_match_dim !== false)
            .map(r => r.inventory_column);

          results.push({
            machine:      displayName,
            machineLabel: machine._displayName ? null : machine.label,
            tooling:      tooling_name,
            computed:     computedDims,
            columnMap,
            matchDimCols,
            matches,
          });
        } catch (err) {
          warnings.push({ machine: displayName, tooling: tooling_name, reason: err.message });
        }
      }));
    } catch (err) {
      warnings.push({ machine: displayName, reason: err.message });
    }
  }));

  // Build displayName → machine config map for post-processing
  const machineByDisplay = {};
  for (const m of searchMachines) {
    machineByDisplay[m._displayName || m.machine_name] = m;
  }
  await _linkSupportBlockToLoadingChute(results, machineByDisplay);

  results.sort((a, b) =>
    a.machine.localeCompare(b.machine) || a.tooling.localeCompare(b.tooling)
  );

  return { success: true, cn, spec, results, warnings };
}

function _clearCaches() {
  _validatedTables.clear();
  _columnCache.clear();
}

module.exports = { search, _searchInventory: searchInventory, _clearCaches };
