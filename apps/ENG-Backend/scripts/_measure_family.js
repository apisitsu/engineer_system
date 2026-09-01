'use strict';

/**
 * Targeted per-(machine,tooling,family) accuracy measurement — the fast path.
 * ---------------------------------------------------------------------------
 * eval_tooling_accuracy.js runs the FULL search() per CN across all 36 machines
 * and has no per-search timeout, so a single pathological CN hangs the whole run
 * (observed twice on this box). This script sidesteps that: it takes ONE family,
 * pulls the CNs the factory planned it on, and runs only that family's
 * formula + searchInventory — mirroring search()'s inner loop exactly.
 *
 *   node scripts/_measure_family.js --machine "KS-400B1" --tooling "PLUG(A)" --family 4664-06
 *     [--limit N]        cap planned CNs measured (default 400)
 *     [--offsets]        also print planned_dim - computed per key (median, %within)
 *     [--try-tol A:+0.5/-0.2,B:none]  re-rank with overridden tolerances (dry, no DB write)
 *
 * Ground truth: lpb.eng_r_pi_tool (tool_dwg_no LIKE '<family>%').
 * Scoring: top-1 = predicted #1 dwg-family == planned family; top-2 = #1 or #2.
 */

require('dotenv').config({ quiet: true });
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { TSV2_TABLES } = require('../api/engineer/mtc/tsv2Constants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');
const configCache = require('../api/engineer/mtc/services/tsv2ConfigCache');
const formulaService = require('../api/engineer/mtc/services/formulaService');
const ss = require('../api/engineer/mtc/services/searchService');
const buildSpecContext = ss._buildSpecContext;
const searchInventory = ss._searchInventory;

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const MACHINE = arg('--machine');
const TOOLING = arg('--tooling');
const FAMILY = arg('--family');
const LIMIT = parseInt(arg('--limit', '400'), 10);
const OFFSETS = process.argv.includes('--offsets');
const TRYTOL = arg('--try-tol');
const TRYFORMULA = arg('--try-formula'); // "A:floor05(SD-0.5),C:OD-0.3"
const TRYMATCH = arg('--try-match'); // "B:true,C:false" — override is_match_dim
const ADDRULE = arg('--add-rule'); // "C:dim_c,D:dim_d" — add a rank-only search rule for a key that has none

if (!MACHINE || !TOOLING || !FAMILY) {
  console.error('need --machine --tooling --family');
  process.exit(1);
}

const famOf = (d) => (String(d || '').match(/^(\d{4}-\d{2})/) || [])[1] || null;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// parse --try-tol "A:+0.5/-0.2,B:none,C:+0/-0"
function parseTryTol(str) {
  if (!str) return null;
  const out = {};
  for (const part of str.split(',')) {
    const [k, spec] = part.split(':');
    if (spec === 'none') { out[k] = { tol_plus: null, tol_minus: null }; continue; }
    const p = (spec.match(/\+(-?[\d.]+)/) || [])[1];
    const m = (spec.match(/\/-(-?[\d.]+)/) || spec.match(/-(-?[\d.]+)/) || [])[1];
    out[k] = { tol_plus: p !== undefined ? +p : null, tol_minus: m !== undefined ? +m : null };
  }
  return out;
}

async function main() {
  const machines = await configCache.getMachines();
  const machine = machines.find(m => (m.machine_group || m.machine_name) === MACHINE || m.machine_name === MACHINE);
  if (!machine) { console.error(`machine ${MACHINE} not found`); process.exit(1); }

  let rules = await configCache.getSearchRules(machine.id, TOOLING);
  if (!rules.length) { console.error(`no search rules for ${MACHINE} / ${TOOLING}`); process.exit(1); }

  const tryFormula = TRYFORMULA
    ? Object.fromEntries(TRYFORMULA.split(/,(?![^(]*\))/).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }))
    : null;
  if (tryFormula) console.log('OVERRIDE formulas:', JSON.stringify(tryFormula));

  const tryTol = parseTryTol(TRYTOL);
  if (tryTol) {
    rules = rules.map(r => tryTol[r.output_key]
      ? { ...r, tol_plus: tryTol[r.output_key].tol_plus, tol_minus: tryTol[r.output_key].tol_minus }
      : r);
    console.log('OVERRIDE tolerances:', JSON.stringify(tryTol));
  }
  if (ADDRULE) {
    const proto = rules[0] || {};
    for (const part of ADDRULE.split(',')) {
      const [k, col] = part.split(':');
      if (!rules.some(r => r.output_key === k)) {
        rules.push({ ...proto, output_key: k, inventory_column: col, tol_plus: null, tol_minus: null, is_match_dim: true });
      }
    }
    console.log('ADDED rank-only rules:', ADDRULE);
  }
  if (TRYMATCH) {
    const mm = Object.fromEntries(TRYMATCH.split(',').map(s => { const [k, v] = s.split(':'); return [k, v === 'true']; }));
    rules = rules.map(r => (r.output_key in mm) ? { ...r, is_match_dim: mm[r.output_key] } : r);
    console.log('OVERRIDE is_match_dim:', JSON.stringify(mm));
  }

  // planned CNs for this family, with a spec row
  const gt = await maqPool.query(
    `SELECT DISTINCT process_plan_no, tool_dwg_no FROM lpb.eng_r_pi_tool
     WHERE tool_dwg_no LIKE $1`, [FAMILY + '%']);
  const plannedByCtrl = new Map();
  for (const r of gt.rows) {
    if (!plannedByCtrl.has(r.process_plan_no)) plannedByCtrl.set(r.process_plan_no, new Set());
    plannedByCtrl.get(r.process_plan_no).add(r.tool_dwg_no.trim());
  }

  const specCns = [];
  for (const ctrl of plannedByCtrl.keys()) {
    const cn = cnFormat.toSpecCn ? cnFormat.toSpecCn(ctrl) : null;
    if (cn) specCns.push({ ctrl, cn });
  }
  const uniqCns = [...new Map(specCns.map(x => [x.cn, x])).values()].slice(0, LIMIT);
  const specRes = await engPool.query(
    `SELECT * FROM ${TSV2_TABLES.SPEC_PROCESS} WHERE cn = ANY($1)`, [uniqCns.map(x => x.cn)]);
  const specByCn = new Map(specRes.rows.map(r => [String(r.cn), r]));

  let n = 0, hit1 = 0, hit2 = 0, none = 0, noSpec = 0;
  const offs = {}; // key -> [planned_dim - computed]
  const invCache = new Map();

  for (const { ctrl, cn } of uniqCns) {
    const spec = specByCn.get(String(cn));
    if (!spec) { noSpec++; continue; }
    const ctx = buildSpecContext(spec);
    let computedDims;
    try {
      let frows = await configCache.getFormulas(machine.id, TOOLING);
      if (tryFormula) {
        frows = frows.map(f => tryFormula[f.output_key]
          ? { ...f, formula_expr: tryFormula[f.output_key], condition_expr: null } : f);
        // add any brand-new keys
        for (const [k, expr] of Object.entries(tryFormula)) {
          if (!frows.some(f => f.output_key === k)) frows.push({ output_key: k, formula_expr: expr, condition_expr: null, sort_order: 999 });
        }
      }
      computedDims = await formulaService.computeDimensions(machine.id, TOOLING, ctx, { cn, formulaRows: frows });
    } catch (e) { none++; n++; continue; }

    const matches = await searchInventory(machine, rules, computedDims);
    n++;
    // score against the EXACT planned drawing(s), not just the family — a family
    // filter makes family-level scoring trivially ~100%.
    const dwgOf = (row) => row?.tooling_no || Object.values(row || {}).find(v => typeof v === 'string' && /^\d{4}-\d{2}-\d/.test(v)) || null;
    const p0 = dwgOf(matches[0]);
    const p1 = dwgOf(matches[1]);
    const planned = plannedByCtrl.get(ctrl) || new Set();
    if (p0 && planned.has(p0)) { hit1++; hit2++; }
    else if (p1 && planned.has(p1)) hit2++;
    else if (!matches.length) none++;

    if (OFFSETS && matches.length) {
      // planned tool row dims vs computed
      const plannedDwgs = plannedByCtrl.get(ctrl);
      const pd = [...plannedDwgs][0];
      if (!invCache.has(pd)) {
        const ir = await engPool.query(
          `SELECT * FROM ${machine.inventory_table} WHERE tooling_no = $1 LIMIT 1`, [pd]).catch(() => ({ rows: [] }));
        invCache.set(pd, ir.rows[0] || null);
      }
      const irow = invCache.get(pd);
      if (irow) for (const r of rules) {
        const c = computedDims[r.output_key];
        const planned = parseFloat(irow[r.inventory_column]);
        if (Number.isFinite(c) && Number.isFinite(planned)) {
          (offs[r.output_key] = offs[r.output_key] || []).push(planned - c);
        }
      }
    }
  }

  const pct = (x) => n ? (100 * x / n).toFixed(1) + '%' : '—';
  console.log(`\n${MACHINE} / ${TOOLING}  (family ${FAMILY})`);
  console.log(`  planned CNs: ${uniqCns.length}  scored: ${n}  no-spec: ${noSpec}`);
  console.log(`  top-1: ${pct(hit1)}   top-2: ${pct(hit2)}   none: ${none} (${pct(none)})`);
  if (OFFSETS) {
    console.log('\n  planned_dim - computed (per key):');
    for (const [k, arr] of Object.entries(offs)) {
      const md = median(arr);
      const within = (t) => (100 * arr.filter(x => Math.abs(x) <= t).length / arr.length).toFixed(0);
      console.log(`    ${k}: n=${arr.length}  median=${md.toFixed(3)}  |Δ|≤0.1: ${within(0.1)}%  ≤0.5: ${within(0.5)}%  ≤1.0: ${within(1.0)}%  min=${Math.min(...arr).toFixed(2)} max=${Math.max(...arr).toFixed(2)}`);
    }
  }
  await engPool.end(); await maqPool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
