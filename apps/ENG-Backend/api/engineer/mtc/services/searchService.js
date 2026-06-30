'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { TSV2_TABLES } = require('../tsv2Constants');
const formulaService = require('./FormulaService');
const configCache = require('./tsv2ConfigCache');
const cnFormat = require('../utils/cnFormat');

// Cap on concurrent inventory queries per search (pg pool max is 20).
const SEARCH_CONCURRENCY = 8;

// Combined finished-dim distance weighting: OD and ID count fully, axial width
// (W) counts half — OD/ID dominate whether a fixture fits. Used by every
// similar-part distance computation below (kept as one constant so the SQL and
// the JS cap stay in sync).
const W_DIST_WEIGHT = 0.5;

// Max combined finished-dim distance (mm) before a part stops being "similar".
// 0.2 mm (±0.2) — near-exact dimensional twins only. Applies to ALL similar-part
// paths: the empty-tooling FILL fallback (_applySimilarPartFallback) AND the
// informational "Similar" REFERENCE column (_attachSimilarRefFromPartnoMap /
// _attachSimilarRefFromFactoryPlan). Confirmed 2026-06-29 the 2026-06-28
// tightening from 2.0 → 0.2 is intentional for every path — a similar-part
// suggestion must be a high-confidence twin, not a loose neighbour.
const SIMILAR_DIST_MAX = 0.2;

// Cache: tool DWG family (first dash-segment, e.g. '4030') → the factory
// process_code it predominantly runs under. Lets the SDS page place a
// similar-part suggestion under the matching process row. Effectively constant.
const _famProcessCache = new Map();
async function processCodeForToolFamily(toolDwgNo) {
  const fam = String(toolDwgNo || '').split('-')[0];
  if (!fam) return null;
  if (_famProcessCache.has(fam)) return _famProcessCache.get(fam);
  let pc = null;
  try {
    const r = await maqPool.query(
      `SELECT process_code FROM lpb.eng_r_pi_tool WHERE tool_dwg_no LIKE $1
        GROUP BY process_code ORDER BY count(*) DESC LIMIT 1`,
      [fam + '-%']
    );
    pc = r.rows[0]?.process_code ?? null;
  } catch (_) { pc = null; }
  _famProcessCache.set(fam, pc);
  return pc;
}

// Run `fn` over `items` with at most `limit` in flight at once.
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

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
  const num = (v) => (v !== null && v !== undefined && v !== '') ? Number(v) : 0;
  const str = (v) => (v ?? '').toString().toUpperCase().trim();
  const flag = (v) => v ? 1 : 0;

  const od = num(spec.od_aft);
  const id = num(spec.id_aft);
  const w = num(spec.w_aft);
  const odBf = num(spec.od_bf);
  const idBf = num(spec.id_bf);
  const wBf = num(spec.w_bf);

  const type = str(spec.type);
  const yball = str(spec.yball);
  const process = str(spec.process ?? '');

  // SD (肩径 / shoulder dia). The legacy Excel TOOLING LISTs compute it geometrically
  // for Normal parts — SD = sqrt(OD² − W²) — and take a manually-entered value for
  // Y-ball / ABR parts (where W > OD makes the geometry invalid → sqrt of a negative).
  // V2 stores `sd`, but ~62% of rows have sd = 0/NULL, which silently zeroes every
  // SD-dependent formula (KS-03A / KS-B22RD FRONT PLATE, KS-400B1 PLUG A/B & WORK DRIVER).
  // Stored value wins (preserves the manual Y-ball/ABR numbers); fall back to the
  // geometric value only when sd is missing AND the geometry is valid (OD > W).
  const sdStored = num(spec.sd ?? 0);
  const sdCalc = (od > 0 && od > w) ? Math.sqrt(od * od - w * w) : 0;
  const sd = sdStored > 0 ? sdStored : sdCalc;

  return {
    // ── After (nominal) ───────────────────────────────────────────────────────
    OD: od, ID: id, W: w, SD: sd, sdCalc,
    odAft: od, idAft: id, wAft: w,

    // After max / min — DB stores tolerance DELTA; nominal + delta = absolute bound
    // e.g. od_aft=22.555, od_aft_max=0, od_aft_min=-0.01 → upper=22.555, lower=22.545
    odAft_max: od + num(spec.od_aft_max), odAft_min: od + num(spec.od_aft_min),
    idAft_max: id + num(spec.id_aft_max), idAft_min: id + num(spec.id_aft_min),
    wAft_max: w + num(spec.w_aft_max), wAft_min: w + num(spec.w_aft_min),

    // ── Before (nominal + max / min) ──────────────────────────────────────────
    odBf, idBf, wBf,
    odBf_max: odBf + num(spec.od_bf_max), odBf_min: odBf + num(spec.od_bf_min),
    idBf_max: idBf + num(spec.id_bf_max), idBf_min: idBf + num(spec.id_bf_min),
    wBf_max: wBf + num(spec.w_bf_max), wBf_min: wBf + num(spec.w_bf_min),

    // Ball-insert groove protrusion width (Excel "Y"; manual). Used by CPX SHOE V.
    Y: num(spec.groove_y),

    // ── Derived boolean flags (1 = true, 0 = false) ───────────────────────────
    isBallInner: flag(type.includes('INNER') || yball === 'Y'),
    isABR: flag(type.includes('ABR')),
    isIDtoOD: flag(process === 'ID->OD'),
    isODtoID: flag(process === 'OD->ID'),

    // ── Raw strings ───────────────────────────────────────────────────────────
    Type: type, YBall: yball, Process: process,

    // CN class prefix = first 2 digits of the CN (e.g. '614033' → 61). Deterministic,
    // never clobbered by a factory sync / Part-Management save. KL-20 derives its
    // grip mode from this (N-chuck classes 23/25/26/41/42/61/63 → 4030-01; ID-chuck
    // classes 62/64/69 → 4030-02) instead of the manually-set `type` column.
    cnPrefix: parseInt(String(spec.cn ?? '').slice(0, 2), 10) || 0,

    // MSB surface-grinder COLLET variant: the 2MSB48-605~607-T races take a THAI-plant
    // COLLET (4547-01-0039-01) while sharing the 0030 base/arbor/collar (per
    // MSB_SURFACE-GRINDING_TOOLING xlsx). It has the SAME bore as the 0030 family, so
    // bore ID can't tell them apart → gate on parts_no. PSG-64/GS-64PFII COLLET formula
    // emits this as output_key B against the tooling_psg64 dim_b discriminator (1 = 0039).
    isThaiMsb48Collet: flag(/^2MSB48-60[567]/.test(str(spec.pn))),
  };
}

// ── Machine Limit Check ──────────────────────────────────────────────────────

async function checkMachineLimits(machineId, ctx) {
  const rows = await configCache.getLimits(machineId);

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

  const conditions = [];
  const params = [];
  let pi = 1;

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

  const withTol = rules.filter(r => r.tol_plus !== null || r.tol_minus !== null);
  const withoutTol = rules.filter(r => r.tol_plus === null && r.tol_minus === null);

  // distanceRules: rules that contribute to ORDER BY, each carrying its sort_priority
  // Sorted by sort_priority → builds hierarchical ORDER BY (col0 ASC, col1 ASC …)
  // so priority=0 is primary sort key, priority=1 is tie-breaker only.
  const distanceRules = [];

  for (const rule of withTol) {
    const computed = computedDims[rule.output_key];
    if (computed === undefined || !validCols.has(rule.inventory_column)) continue;

    const hasTolPlus = rule.tol_plus !== null;
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
    // Fail-open: a DB error linking this machine's SUPPORT BLOCK must skip only this
    // machine, never abort the whole search (runs on every search). The core formula
    // matches are already in `results`; the link is a refinement.
    try {
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
    } catch (err) {
      console.warn(`[tselect] support-block link skipped for ${machineName}: ${err.message}`);
      continue;
    }
  }
}

// ── Part-number override (hybrid lookup) ─────────────────────────────────────
//
// Some tooling is NOT selected by a dimensional formula — it is pinned by the
// workpiece **part number** (品番 / parts_no). Examples: the KS-400B5/B6 ROTARY
// DRESSER, and the KS-H70 grinding holder/base/grindstone (the grindstone SIZE
// the factory actually uses deviates ~40% from any single-dim formula). Those
// mappings live in `tooling_partno_map (machine_name, tooling_name, parts_no,
// tool_dwg_no)`. After the formula-driven search runs (it supplies a sensible
// DEFAULT for parts with no map entry), we overwrite the match with the pinned
// inventory row whenever the part has a non-forbidden mapping.
//
// One indexed query per search, guarded: parts with no map row (every machine
// that doesn't use the table) get zero rows back → no-op, no behaviour change.
async function _applyPartnoOverrides(results, machineByDisplay, partsNo) {
  if (!partsNo) return;
  // Fail-open: this runs on every search. A DB error must leave the formula-driven
  // matches intact (a sensible default) rather than 500 the whole search — the pinned
  // override resumes once a transient error clears.
  try {
    const { rows } = await engPool.query(
      `SELECT machine_name, tooling_name, tool_dwg_no
         FROM ${TSV2_TABLES.PARTNO_MAP}
        WHERE parts_no = $1 AND is_forbidden = false`,
      [partsNo]
    );
    if (!rows.length) return;

    const override = {};
    for (const r of rows) override[`${r.machine_name}||${r.tooling_name}`] = r.tool_dwg_no;

    for (const res of results) {
      const mcfg = machineByDisplay[res.machine];
      const machineName = mcfg?.machine_name || res.machine;
      const dwg = override[`${machineName}||${res.tooling}`];
      if (!dwg) continue;
      const table = mcfg?.inventory_table;
      if (!table) continue;
      const { rows: inv } = await engPool.query(
        `SELECT * FROM "${table}" WHERE tooling_no = $1 LIMIT 1`,
        [dwg]
      );
      if (inv.length) { res.matches = inv; res.overrideBy = 'parts_no'; }
    }
  } catch (err) {
    console.warn(`[tselect] parts_no override skipped for ${partsNo}: ${err.message}`);
  }
}

// ── Similar-part fallback (suggestion only) ──────────────────────────────────
//
// When a tooling produces NO match (formula gated to the -999 sentinel, or the
// part has no part-number map entry) we can still help the engineer by offering
// the choice the factory made for the most dimensionally-similar part it HAS
// tooled on this machine. The reference set is `tooling_partno_map` (the
// factory-confirmed parts_no → tool_dwg_no mappings) joined to the spec dims of
// those parts.
//
// Guards keep this conservative — it can only ever FILL an empty result, never
// replace a real match:
//   • same CN class prefix (first 2 digits) — keeps it within the part family /
//     grip mode (KL-20 OD-chuck vs ID-chuck collets share an inventory table but
//     differ by class), so we don't suggest a wrong-family fixture;
//   • SIMILAR_DIST_MAX cap on combined finished-dim distance;
//   • ONE suggestion per machine — the globally-nearest reference across all the
//     machine's empty toolings. For grip-exclusive machines (one fixture per
//     part) this picks the true dimensional twin (dist≈0) and avoids offering a
//     second, wrong-grip fixture whose class merely overlaps.
//
// Marked `overrideBy='similar_part'` + `similarPart={ref_cn, parts_no, distance}`
// so the UI can label it a suggestion (not a factory-confirmed selection).
async function _applySimilarPartFallback(results, machineByDisplay, spec, specCtx) {
  const cls = String(spec.cn ?? '').slice(0, 2);
  if (!/^\d{2}$/.test(cls)) return;

  const od = Number(specCtx.OD) || 0;
  const id = Number(specCtx.ID) || 0;
  const w = Number(specCtx.W) || 0;
  // Guard: a searched spec with NO usable dims would score distance 0 against any
  // other dim-less row (COALESCE(NULL,0) on both sides) → a spurious "exact" twin.
  // Require at least one real dim before offering a dimension-based suggestion.
  if (!od && !id && !w) return;

  // Group empty, non-overridden results by display machine.
  const byMachine = {};
  for (const res of results) {
    if (res.matches?.length || res.overrideBy) continue;
    (byMachine[res.machine] ??= []).push(res);
  }

  for (const [displayName, emptyResults] of Object.entries(byMachine)) {
    const mcfg = machineByDisplay[displayName];
    const machineName = mcfg?.machine_name || displayName;
    const table = mcfg?.inventory_table;
    if (!table) continue;
    const toolingNames = emptyResults.map(r => r.tooling);

    // Fail-open: this runs on EVERY search (incl. the high-volume coverage-report /
    // SDS-overlay batch). A DB error here must skip THIS machine's suggestion, never
    // abort the whole search — mirrors the catch-and-skip of the similar-ref attachers.
    try {
      // Globally-nearest reference part across this machine's empty toolings.
      const { rows } = await engPool.query(
        `SELECT m.tooling_name, m.tool_dwg_no, s.cn AS ref_cn, s.pn AS parts_no,
                (ABS(COALESCE(s.od_aft,0) - $1)
               + ABS(COALESCE(s.id_aft,0) - $2)
               + $8 * ABS(COALESCE(s.w_aft,0) - $3)) AS dist
           FROM ${TSV2_TABLES.PARTNO_MAP} m
           JOIN ${TSV2_TABLES.SPEC_PROCESS} s ON s.pn = m.parts_no
          WHERE m.machine_name = $4
            AND m.tooling_name = ANY($5)
            AND m.is_forbidden = false
            AND left(s.cn, 2) = $6
            AND s.cn <> $7
          ORDER BY dist ASC
          LIMIT 1`,
        [od, id, w, machineName, toolingNames, cls, String(spec.cn), W_DIST_WEIGHT]
      );
      if (!rows.length) continue;

      const best = rows[0];
      if (Number(best.dist) > SIMILAR_DIST_MAX) continue;

      const target = emptyResults.find(r => r.tooling === best.tooling_name);
      if (!target) continue;

      const { rows: inv } = await engPool.query(
        `SELECT * FROM "${table}" WHERE tooling_no = $1 LIMIT 1`,
        [best.tool_dwg_no]
      );
      if (inv.length) {
        target.matches = inv;
        target.overrideBy = 'similar_part';
        target.similarPart = {
          ref_cn: best.ref_cn,
          parts_no: best.parts_no,
          distance: Number(best.dist),
          // The factory process_code this tool family runs under — lets the SDS
          // page place the suggestion under the matching process row (e.g. KL-20
          // collet 4030 → 2561 "Trim") instead of a separate part-level list.
          process_code: await processCodeForToolFamily(best.tool_dwg_no),
        };
      }
    } catch (err) {
      console.warn(`[tselect] similar-part fallback skipped for ${displayName}: ${err.message}`);
      continue;
    }
  }
}

// ── Similar-part REFERENCE column (informational, runs alongside any match) ──
//
// Independent of the empty-fill fallback above: for EVERY tooling that has a
// factory parts_no map, find the tool the most dimensionally-similar produced
// part used and attach it as `similarRef` — WITHOUT touching `matches`. The UI
// renders it as a leading "Similar" column so the engineer sees the real-world
// reference next to the algorithmic T-Select match. Especially useful for a new
// model that has no production history of its own.
//
// One DISTINCT ON query per machine returns the nearest reference per tooling.
async function _attachSimilarRefFromPartnoMap(results, machineByDisplay, spec, specCtx) {
  const cls = String(spec.cn ?? '').slice(0, 2);
  if (!/^\d{2}$/.test(cls)) return;

  const od = Number(specCtx.OD) || 0;
  const id = Number(specCtx.ID) || 0;
  const w  = Number(specCtx.W)  || 0;
  // Guard against the NULL→0 distance-0 trap (see _applySimilarPartFallback): a
  // dim-less searched part must not match every dim-less reference at distance 0.
  if (!od && !id && !w) return;

  // Group ALL results by display machine (matched or not).
  const byMachine = {};
  for (const res of results) (byMachine[res.machine] ??= []).push(res);

  await Promise.all(Object.entries(byMachine).map(async ([displayName, machineResults]) => {
    const mcfg = machineByDisplay[displayName];
    const machineName = mcfg?.machine_name || displayName;
    const toolingNames = [...new Set(machineResults.map(r => r.tooling))];
    if (!toolingNames.length) return;

    // Nearest reference part PER tooling_name (DISTINCT ON picks the min-distance
    // row once the set is ordered by tooling_name, dist).
    let rows;
    try {
      ({ rows } = await engPool.query(
        `SELECT DISTINCT ON (m.tooling_name)
                m.tooling_name, m.tool_dwg_no, s.cn AS ref_cn, s.pn AS parts_no,
                (ABS(COALESCE(s.od_aft,0) - $1)
               + ABS(COALESCE(s.id_aft,0) - $2)
               + $8 * ABS(COALESCE(s.w_aft,0) - $3)) AS dist
           FROM ${TSV2_TABLES.PARTNO_MAP} m
           JOIN ${TSV2_TABLES.SPEC_PROCESS} s ON s.pn = m.parts_no
          WHERE m.machine_name = $4
            AND m.tooling_name = ANY($5)
            AND m.is_forbidden = false
            AND left(s.cn, 2) = $6
            AND s.cn <> $7
          ORDER BY m.tooling_name, dist ASC`,
        [od, id, w, machineName, toolingNames, cls, String(spec.cn), W_DIST_WEIGHT]
      ));
    } catch (_) { return; }   // machine has no partno_map / query issue → no column

    const refByTooling = {};
    for (const r of rows) {
      if (Number(r.dist) > SIMILAR_DIST_MAX) continue;
      refByTooling[r.tooling_name] = r;
    }
    for (const res of machineResults) {
      const ref = refByTooling[res.tooling];
      if (!ref) continue;
      res.similarRef = {
        ref_cn: ref.ref_cn,
        parts_no: ref.parts_no,
        tool_dwg_no: ref.tool_dwg_no,
        distance: Number(ref.dist),
        source: 'partno_map',   // curated factory mapping (highest confidence)
      };
    }
  }));
}

// ── Generic similar-part REFERENCE from the factory process plan (ALL machines) ──
//
// `tooling_partno_map` only covers a handful of curated machines. To extend the
// "Similar" reference column to EVERY machine, fall back to the factory ground
// truth in maqdb: `lpb.eng_r_pi_tool` (the real tool each produced CN used).
//
// We tie a factory tool to a T-Select tooling via its DWG FAMILY (the first two
// dash-segments, e.g. 4866-10) — taken from the machine's own #1 inventory match.
// The same family uniquely identifies the tooling/fixture, so a CN whose process
// plan used that family was tooled with the same fixture. Among those, we pick the
// dimensionally-nearest part (≤ SIMILAR_DIST_MAX) to the searched CN and surface
// the exact tool it used. Cross-pool but fully fail-safe: any miss → no column.
//
// Dim source per class (maqdb). Each entry's `join` is a JOIN clause that exposes the
// dim columns under alias `d`, so the shared SELECT/dist expression below is identical
// across classes. ball/race/sleeve are single-table; spherical chains two tables.
// (body still has no dim source → skipped.)
const _CLASS_DIM = {
  ball:   { join: 'JOIN lpb.eng_ball d   ON d.control_no = t.process_plan_no', od: 'ball_dia', id: 'in_dia', w: 'width' },
  race:   { join: 'JOIN lpb.eng_race d   ON d.control_no = t.process_plan_no', od: 'od',       id: 'id',     w: 'width' },
  sleeve: { join: 'JOIN lpb.eng_sleeve d ON d.control_no = t.process_plan_no', od: 'od',       id: 'id',     w: 'full_length' },
  // Spherical (A4x) dims live in a 2-table chain: eng_sph (control_no → sph_design_no,
  // no dim cols) → eng_sph_design (sph_od / dall_id / sph_width, keyed sph_design_cn).
  // A4x spec od_aft/id_aft/w_aft are themselves synced from these same cols, so the
  // distance comparison stays apples-to-apples.
  spherical: {
    join: 'JOIN lpb.eng_sph sph        ON sph.control_no = t.process_plan_no '
        + 'JOIN lpb.eng_sph_design d   ON d.sph_design_cn = sph.sph_design_no',
    od: 'sph_od', id: 'dall_id', w: 'sph_width',
  },
};
function _classDimFor(cn) {
  const n = parseInt(String(cn).slice(0, 2), 10);
  if (n >= 31 && n <= 39) return _CLASS_DIM.ball;
  if (n >= 21 && n <= 29) return _CLASS_DIM.race;
  if ((n >= 61 && n <= 64) || n === 69) return _CLASS_DIM.sleeve;
  if ((n >= 41 && n <= 44) || n === 48 || n === 49) return _CLASS_DIM.spherical;
  return null; // body / unknown → no factory reference
}
// First tool-DWG-shaped value (XXXX-XX-NNNN…) in an inventory row → its family.
function _familyFromMatch(row) {
  for (const v of Object.values(row || {})) {
    if (typeof v !== 'string') continue;
    const m = v.match(/^(\d{4}-\d{2})-\d/);
    if (m) return m[1];
  }
  return null;
}
async function _attachSimilarRefFromFactoryPlan(results, spec, specCtx) {
  const dim = _classDimFor(spec.cn);
  if (!dim) return;
  const targetCn = cnFormat.itemNoToControlNo(String(spec.cn)); // 6-digit → Cxx-0YYYY
  if (!targetCn) return;

  const od = Number(specCtx.OD) || 0;
  const id = Number(specCtx.ID) || 0;
  const w  = Number(specCtx.W)  || 0;
  // Guard against the NULL→0 distance-0 trap: a dim-less searched part must not
  // match every dim-less factory part at distance 0 (see _applySimilarPartFallback).
  if (!od && !id && !w) return;
  // Same CN PREFIX (e.g. "C31"), not just the broad class table (any 3x ball).
  // Mirrors the partno_map paths' left(cn,2) filter so the factory reference never
  // crosses sub-classes — e.g. a C35 yball is not suggested for a C31 ball.
  const cnPrefix = targetCn.slice(0, 3);

  // Candidates = matched toolings that have NO curated/fill reference yet.
  const famByResult = new Map(); // result → family
  const families = new Set();
  for (const res of results) {
    if (res.similarRef || res.overrideBy || !res.matches?.length) continue;
    const fam = _familyFromMatch(res.matches[0]);
    if (!fam) continue;
    famByResult.set(res, fam);
    families.add(fam);
  }
  if (!families.size) return;

  // One query: nearest same-CN-prefix produced part per tool family (DISTINCT ON).
  let rows;
  try {
    const famExpr = `split_part(t.tool_dwg_no,'-',1)||'-'||split_part(t.tool_dwg_no,'-',2)`;
    ({ rows } = await maqPool.query(
      `SELECT DISTINCT ON (fam) ${famExpr} AS fam,
              t.process_plan_no AS ref_cn, t.tool_dwg_no,
              (ABS(COALESCE(d.${dim.od},0) - $1)
             + ABS(COALESCE(d.${dim.id},0) - $2)
             + $7 * ABS(COALESCE(d.${dim.w},0) - $3)) AS dist
         FROM lpb.eng_r_pi_tool t
         ${dim.join}
        WHERE ${famExpr} = ANY($4)
          AND left(t.process_plan_no, 3) = $6
          AND t.process_plan_no <> $5
        ORDER BY fam, dist ASC`,
      [od, id, w, [...families], targetCn, cnPrefix, W_DIST_WEIGHT]
    ));
  } catch (_) { return; }   // maqdb unavailable / class table issue → no column

  const refByFam = {};
  for (const r of rows) {
    if (Number(r.dist) > SIMILAR_DIST_MAX) continue;
    refByFam[r.fam] = r;
  }
  for (const [res, fam] of famByResult) {
    const ref = refByFam[fam];
    if (!ref) continue;
    res.similarRef = {
      ref_cn: ref.ref_cn,
      tool_dwg_no: ref.tool_dwg_no,
      distance: Number(ref.dist),
      source: 'factory',   // derived from lpb.eng_r_pi_tool production plan
    };
  }
}

// ── CN Normalization ─────────────────────────────────────────────────────────
// tooling_spec_process stores CNs in 6-digit format (e.g. '250190').
// Accept Cxx-0YYYY input and normalize so both formats find the spec.
// Delegates to cnFormat (SSOT); falls back to the raw upper string when the
// input is an unrecognized shape so the "spec not found" path is preserved.
function normalizeSpecCn(cn) {
  return cnFormat.toSpecCn(cn) || String(cn).trim().toUpperCase();
}

// ── Main Search ──────────────────────────────────────────────────────────────

async function search(cn, opts = {}) {
  const specCn = normalizeSpecCn(cn);
  const specRes = await engPool.query(
    `SELECT * FROM ${TSV2_TABLES.SPEC_PROCESS} WHERE cn = $1 LIMIT 1`,
    [specCn]
  );
  if (!specRes.rows.length) {
    return { success: false, error: 'Part spec not found', cn };
  }
  const spec = specRes.rows[0];
  const specCtx = buildSpecContext(spec);

  const machines = await configCache.getMachines();

  // Deduplicate grouped machines: for machines sharing the same machine_group,
  // run search once using the first representative and label results with the group name.
  const seenGroups = new Set();
  const searchMachines = machines.reduce((acc, m) => {
    if (!m.machine_group) { acc.push(m); return acc; }
    if (!seenGroups.has(m.machine_group)) {
      seenGroups.add(m.machine_group);
      acc.push({ ...m, _displayName: m.machine_group });
    }
    return acc;
  }, []);

  const results = [];
  const warnings = [];

  // Phase 1 — eligibility check (limits/tooling names come from the in-memory
  // config cache, so this is cheap) → flatten to (machine, tooling) tasks.
  const tasks = [];
  await Promise.all(searchMachines.map(async (machine) => {
    const displayName = machine._displayName || machine.machine_name;
    try {
      const limitCheck = await checkMachineLimits(machine.id, specCtx);
      if (!limitCheck.ok) {
        warnings.push({ machine: displayName, reason: limitCheck.reason });
        return;
      }
      const toolingNames = await configCache.getToolingNames(machine.id);
      for (const tooling_name of toolingNames) tasks.push({ machine, displayName, tooling_name });
    } catch (err) {
      warnings.push({ machine: displayName, reason: err.message });
    }
  }));

  // Phase 2 — run the inventory searches with bounded concurrency so a single
  // request can't fire 100+ simultaneous queries and starve the pg pool (max 20).
  await mapLimit(tasks, SEARCH_CONCURRENCY, async ({ machine, displayName, tooling_name }) => {
    try {
      const formulaRows  = await configCache.getFormulas(machine.id, tooling_name);
      const computedDims = await formulaService.computeDimensions(machine.id, tooling_name, specCtx, { cn: specCn, formulaRows, user_empno: opts.user_empno ?? null });

      // Surface formula evaluation failures (previously swallowed silently) so
      // a broken/inapplicable formula is visible instead of just a missing tool.
      if (computedDims._warnings?.length) {
        for (const w of computedDims._warnings) {
          warnings.push({ machine: displayName, tooling: tooling_name, reason: `formula ${w.output_key} (${w.phase}) failed: ${w.error}` });
        }
      }

      const rules = await configCache.getSearchRules(machine.id, tooling_name);
      if (!rules.length) return;

      const matches = await searchInventory(machine, rules, computedDims);

      // Map computed key → inventory column (e.g. A → dim_a) for frontend display
      const columnMap = {};
      for (const r of rules) columnMap[r.output_key] = r.inventory_column;

      // Inventory columns whose rule feeds the closest-match ranking
      // (is_match_dim) — used by the UI to highlight those result headers.
      const matchDimCols = rules
        .filter(r => r.is_match_dim !== false)
        .map(r => r.inventory_column);

      results.push({
        machine: displayName,
        machineLabel: machine._displayName ? null : machine.label,
        tooling: tooling_name,
        computed: computedDims,
        columnMap,
        matchDimCols,
        matches,
      });
    } catch (err) {
      warnings.push({ machine: displayName, tooling: tooling_name, reason: err.message });
    }
  });

  // Build displayName → machine config map for post-processing
  const machineByDisplay = {};
  for (const m of searchMachines) {
    machineByDisplay[m._displayName || m.machine_name] = m;
  }
  await _linkSupportBlockToLoadingChute(results, machineByDisplay);
  await _applyPartnoOverrides(results, machineByDisplay, spec.pn);
  // Last resort — fill any still-empty tooling with the factory's pick for the
  // most dimensionally-similar part (suggestion only; flagged similar_part).
  await _applySimilarPartFallback(results, machineByDisplay, spec, specCtx);
  // Attach the nearest-similar-part REFERENCE tool to EVERY tooling (matched or
  // not) for the UI's "Similar" reference column — does not alter matches.
  // Gated behind opts.withSimilarRef: these add per-machine + cross-pool queries
  // PER search, so only the user-facing controller turns them on. The coverage
  // report / SDS overlay call search() via tselectFallback WITHOUT the flag, so
  // their hundreds of per-CN searches don't pay for a column they never render.
  if (opts.withSimilarRef) {
    // (1) curated partno_map (4 machines, ties tool→tooling_name);
    await _attachSimilarRefFromPartnoMap(results, machineByDisplay, spec, specCtx);
    // (2) generic factory fallback (ALL machines) for matched toolings still
    //     without a reference — derived from lpb.eng_r_pi_tool via tool family.
    await _attachSimilarRefFromFactoryPlan(results, spec, specCtx);
  }

  results.sort((a, b) =>
    a.machine.localeCompare(b.machine) || a.tooling.localeCompare(b.tooling)
  );

  return { success: true, cn, spec, results, warnings };
}

function _clearCaches() {
  _validatedTables.clear();
  _columnCache.clear();
  configCache.flush();
}

module.exports = { search, _searchInventory: searchInventory, _clearCaches, _buildSpecContext: buildSpecContext };
// Exported for unit testing the NULL-safety guard + distance cap of the
// informational "Similar" reference column (tests/mtc/searchSimilarRef.test.js).
module.exports._attachSimilarRefFromPartnoMap = _attachSimilarRefFromPartnoMap;
module.exports._attachSimilarRefFromFactoryPlan = _attachSimilarRefFromFactoryPlan;
