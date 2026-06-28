'use strict';

/**
 * Tooling-Select accuracy eval harness — ALL machines, one run.
 * ---------------------------------------------------------------------------
 * Turns the per-machine top-1/top-2 audits we did by hand (recorded across the
 * machine memories) into a single repeatable report, and detects accuracy
 * regressions against a saved baseline.
 *
 * WHAT IT MEASURES
 *   For every part spec that the factory actually produced, it runs the live
 *   T-Select `search(cn)` and compares the predicted tool against the factory
 *   ground truth in maqdb `lpb.eng_r_pi_tool` (the real tool each CN used).
 *
 *   Alignment is by DWG FAMILY (first two dash-segments, e.g. `4027-01`) —
 *   the same key `searchService._attachSimilarRefFactory` uses. A (machine,
 *   tooling) is scored on a CN only when the factory used a tool of that
 *   tooling's family for that CN (auto-scoping: no per-machine process_code
 *   table needed). Within scope:
 *     • top-1 hit  = predicted #1 tool_dwg_no == a factory tool of that family
 *     • top-2 hit  = predicted #1 OR #2 matches
 *     • none       = in scope but search returned no tool (a real miss)
 *
 * USAGE (run on a box that can reach eng_system + maqdb — NOT this dev box)
 *   node scripts/eval_tooling_accuracy.js [options]
 *     --limit N        sample first N spec CNs (default 1000; 0 = all)
 *     --offset N       skip first N spec CNs (default 0)
 *     --machine NAME   only report this display machine (still searches all)
 *     --by-tooling     break the report down per (machine, tooling)
 *     --save-baseline  write results to the baseline file for future diffs
 *     --json           print machine-level results as JSON (for CI/dashboards)
 *
 * EXIT CODES
 *   0  ran (or skipped because no DB) — and, with a baseline present, no machine
 *      regressed beyond --tolerance (default 3 percentage points on top-1).
 *   2  a machine's top-1 dropped > tolerance vs baseline  → regression.
 *
 * LIMITATIONS (read before trusting a number)
 *   • Family granularity: if one machine has two toolings sharing a DWG family
 *     the alignment for those is ambiguous (rare). Such keys are flagged.
 *   • Ground-truth noise: revision dupes in eng_r_pi_tool inflate the family
 *     set; we treat the family's factory tools as a SET, so any-revision match
 *     counts as a hit (matches how the manual audits scored).
 *   • Part-number-pinned toolings (rotary dresser, KS-H70 grindstone) match by
 *     exact tool_dwg_no via the override and score normally; non-XXXX-XX dwgs
 *     (e.g. DD#### form) have no family and are skipped.
 */

const path = require('path');
const fs = require('fs');
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { TSV2_TABLES } = require('../api/engineer/mtc/tsv2Constants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');
const configCache = require('../api/engineer/mtc/services/tsv2ConfigCache');
const { search } = require('../api/engineer/mtc/services/searchService');

const BASELINE_PATH = path.join(__dirname, 'eval_tooling_accuracy.baseline.json');

// ── args ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { limit: 1000, offset: 0, machine: null, byTooling: false,
              saveBaseline: false, json: false, tolerance: 3, pmReport: null };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--limit') a.limit = parseInt(argv[++i], 10);
    else if (t === '--offset') a.offset = parseInt(argv[++i], 10);
    else if (t === '--machine') a.machine = argv[++i];
    else if (t === '--tolerance') a.tolerance = parseFloat(argv[++i]);
    else if (t === '--by-tooling') a.byTooling = true;
    else if (t === '--save-baseline') a.saveBaseline = true;
    else if (t === '--json') a.json = true;
    // --pm-report [path]: write an executive RAG portfolio markdown from the LIVE
    // numbers. Optional path; defaults to docs/mtc_tooling_portfolio_live.md.
    else if (t === '--pm-report') {
      const next = argv[i + 1];
      a.pmReport = (next && !next.startsWith('--')) ? argv[++i]
        : path.join(__dirname, '..', '..', '..', 'docs', 'mtc_tooling_portfolio_live.md');
    }
  }
  return a;
}

// ── helpers ──────────────────────────────────────────────────────────────────

// DWG family = first two dash-segments, e.g. "4027-01-0123" → "4027-01".
function familyOf(dwg) {
  const m = String(dwg || '').match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

// Predicted tool number from an inventory match row: prefer the `tooling_no`
// column; fall back to the first DWG-shaped string value (mirrors
// searchService._familyFromMatch) for tables that key on a different column.
function predToolNo(row) {
  if (!row) return null;
  if (row.tooling_no) return String(row.tooling_no);
  for (const v of Object.values(row)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d/.test(v)) return v;
  }
  return null;
}

function pct(hit, n) { return n ? (100 * hit / n) : 0; }
function fmtPct(hit, n) { return n ? `${pct(hit, n).toFixed(1)}%` : '  —  '; }

// Resolve each (machine,tooling) key's canonical DWG family = the family it
// predicts most often. Also flag machines where two toolings resolve to the
// SAME family (alignment between them is ambiguous). Pure → unit-tested.
function resolveToolingFamilies(familyVotes) {
  const toolingFamily = new Map();
  for (const [key, votes] of familyVotes) {
    let best = null, bestN = -1;
    for (const [fam, n] of votes) if (n > bestN) { best = fam; bestN = n; }
    toolingFamily.set(key, best);
  }
  const ambiguous = new Map();        // machine -> Set(family)
  const famByMachine = new Map();
  for (const [key, fam] of toolingFamily) {
    const machine = key.split('||')[0];
    if (!famByMachine.has(machine)) famByMachine.set(machine, new Map());
    const m = famByMachine.get(machine);
    m.set(fam, (m.get(fam) || 0) + 1);
  }
  for (const [machine, fams] of famByMachine) {
    for (const [fam, count] of fams) if (count > 1) {
      if (!ambiguous.has(machine)) ambiguous.set(machine, new Set());
      ambiguous.get(machine).add(fam);
    }
  }
  return { toolingFamily, ambiguous };
}

// Score records into per-key {n,hit1,hit2,none}. A record is in scope only when
// the factory used the tooling's canonical family for that CN. Pure → unit-tested.
//   record = { key, pred0, pred1, gtByFam: Map(family -> Set(tool_dwg_no)) }
function scoreRecords(records, toolingFamily) {
  const byKey = new Map();
  for (const rec of records) {
    const fam = toolingFamily.get(rec.key);
    if (!fam) continue;                        // tooling never predicted anything → unscoped
    const gtFam = rec.gtByFam.get(fam);
    if (!gtFam) continue;                       // factory didn't use this family for this CN → out of scope
    if (!byKey.has(rec.key)) byKey.set(rec.key, { n: 0, hit1: 0, hit2: 0, none: 0 });
    const s = byKey.get(rec.key);
    s.n++;
    if (rec.pred0 && gtFam.has(rec.pred0)) { s.hit1++; s.hit2++; }
    else if (rec.pred1 && gtFam.has(rec.pred1)) { s.hit2++; }
    else if (!rec.pred0) s.none++;
  }
  return byKey;
}

// Ground-truth factory tools for a control-no, grouped by DWG family.
async function gtFamiliesFor(controlNo) {
  const { rows } = await maqPool.query(
    `SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_plan_no = $1`,
    [controlNo]
  );
  const byFam = new Map(); // family -> Set(tool_dwg_no)
  for (const r of rows) {
    const fam = familyOf(r.tool_dwg_no);
    if (!fam) continue;
    if (!byFam.has(fam)) byFam.set(fam, new Set());
    byFam.get(fam).add(String(r.tool_dwg_no));
  }
  return byFam;
}

// ── PM portfolio report (RAG) ────────────────────────────────────────────────

// RAG bucket from top-1 accuracy. Mirrors the senior-pm skill's scope-delivery
// thresholds adapted to T-Select: 🟢 ≥85% · 🟡 60–85% · 🔴 <60%.
function pmRag(top1) {
  if (top1 >= 85) return '🟢';
  if (top1 >= 60) return '🟡';
  return '🔴';
}

// Build an executive RAG portfolio markdown from LIVE per-machine scores.
// Pure (string in/out) → unit-tested. `byMachine` = Map(machine -> {n,hit1,hit2,none}).
function buildPmReport(byMachine, byKey, { generatedAt = new Date().toISOString(), sampleN = 0 } = {}) {
  const rows = [...byMachine.entries()]
    .map(([machine, s]) => ({ machine, top1: pct(s.hit1, s.n), top2: pct(s.hit2, s.n), n: s.n, none: s.none }))
    .sort((a, b) => a.top1 - b.top1); // worst first

  const tally = { '🟢': 0, '🟡': 0, '🔴': 0 };
  for (const r of rows) tally[pmRag(r.top1)]++;
  const overall = tally['🔴'] > 0 ? '🔴 RED' : (tally['🟡'] > 0 ? '🟡 AMBER' : '🟢 GREEN');

  const L = [];
  L.push('# MTC Tooling Portfolio — Live Accuracy Dashboard');
  L.push('');
  L.push(`**Generated:** ${generatedAt} · **Source:** \`scripts/eval_tooling_accuracy.js\` (factory ground truth \`lpb.eng_r_pi_tool\`)`);
  L.push(`**Sample:** ${sampleN} CNs scanned · **Machines scored:** ${rows.length}`);
  L.push('');
  L.push('> Auto-generated from live data — do NOT hand-edit; re-run the harness to refresh.');
  L.push('');
  L.push('## Portfolio Health at a Glance');
  L.push('');
  L.push(`- **Overall:** ${overall}`);
  L.push(`- **🟢 On-track:** ${tally['🟢']} · **🟡 At-risk:** ${tally['🟡']} · **🔴 Critical:** ${tally['🔴']}`);
  L.push('- **RAG (top-1 accuracy):** 🟢 ≥85% · 🟡 60–85% · 🔴 <60%');
  L.push('');
  L.push('## Per-Machine RAG (worst → best)');
  L.push('');
  L.push('| Machine | RAG | top-1 | top-2 | n | none |');
  L.push('|---|:--:|--:|--:|--:|--:|');
  for (const r of rows) {
    L.push(`| ${r.machine} | ${pmRag(r.top1)} | ${r.top1.toFixed(1)}% | ${r.top2.toFixed(1)}% | ${r.n} | ${r.none} |`);
  }
  L.push('');
  // Critical worklist: per-tooling lines that are 🔴, sorted worst-first.
  const crit = [...byKey.entries()]
    .map(([k, s]) => ({ machine: k.split('||')[0], tooling: k.split('||')[1], top1: pct(s.hit1, s.n), n: s.n }))
    .filter(r => r.n > 0 && r.top1 < 60)
    .sort((a, b) => a.top1 - b.top1);
  if (crit.length) {
    L.push('## 🔴 Critical worklist (tooling lines <60% top-1)');
    L.push('');
    L.push('| Machine | Tooling | top-1 | n |');
    L.push('|---|---|--:|--:|');
    for (const r of crit) L.push(`| ${r.machine} | ${r.tooling} | ${r.top1.toFixed(1)}% | ${r.n} |`);
    L.push('');
  }
  return L.join('\n') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  // Probe both pools; skip cleanly (exit 0) when DB is unreachable — mirrors the
  // null-safety guard test so a DB-less CI run is a no-op, not a failure.
  try {
    await engPool.query('SELECT 1');
    await maqPool.query('SELECT 1');
  } catch (err) {
    console.warn(`[eval] DB unavailable — skipping: ${err.message}`);
    await closePools();
    process.exit(0);
  }

  // Spec CNs to test (the parts T-Select is meant to handle).
  const limitSql = args.limit > 0 ? `LIMIT ${args.limit} OFFSET ${args.offset}` : `OFFSET ${args.offset}`;
  const { rows: specRows } = await engPool.query(
    `SELECT cn FROM ${TSV2_TABLES.SPEC_PROCESS} WHERE cn IS NOT NULL ORDER BY cn ${limitSql}`
  );
  console.log(`[eval] candidate spec CNs: ${specRows.length}` +
    (args.limit > 0 ? ` (limit ${args.limit}, offset ${args.offset})` : ' (all)'));

  // Single pass: collect (machine,tooling) records + family votes. We resolve
  // each tooling's canonical family AFTER the loop, then score — so a CN where a
  // tooling returns nothing still counts as an in-scope miss if the factory used
  // that tooling's family.
  const records = [];                 // { machine, tooling, pred0, pred1, gtByFam }
  const familyVotes = new Map();      // "machine||tooling" -> Map(family -> count)
  let scanned = 0, withPlan = 0, noSpec = 0;

  for (const { cn } of specRows) {
    const controlNo = cnFormat.itemNoToControlNo(String(cn));
    if (!controlNo) continue;

    // Cheap indexed GT lookup first — only pay for the (expensive) search when
    // the factory actually produced this CN.
    const gtByFam = await gtFamiliesFor(controlNo);
    scanned++;
    if (gtByFam.size === 0) continue;
    withPlan++;

    let res;
    try { res = await search(String(cn)); }
    catch (err) { console.warn(`[eval] search(${cn}) failed: ${err.message}`); continue; }
    if (!res?.success) { noSpec++; continue; }

    for (const r of res.results) {
      const key = `${r.machine}||${r.tooling}`;
      const pred0 = predToolNo(r.matches?.[0]);
      const pred1 = predToolNo(r.matches?.[1]);
      if (pred0) {
        const fam = familyOf(pred0);
        if (fam) {
          if (!familyVotes.has(key)) familyVotes.set(key, new Map());
          const v = familyVotes.get(key);
          v.set(fam, (v.get(fam) || 0) + 1);
        }
      }
      records.push({ machine: r.machine, tooling: r.tooling, key, pred0, pred1, gtByFam });
    }

    if (withPlan % 100 === 0) process.stdout.write(`\r[eval] searched ${withPlan} CNs…`);
  }
  process.stdout.write('\r');
  console.log(`[eval] scanned ${scanned} CNs · ${withPlan} had a factory plan · ${noSpec} missing spec`);

  // Resolve canonical family per (machine,tooling), flag ambiguity, then score.
  const { toolingFamily, ambiguous } = resolveToolingFamilies(familyVotes);
  const byKey = scoreRecords(records, toolingFamily);

  // Roll up per machine.
  const byMachine = new Map();        // machine -> {n,hit1,hit2,none, toolings:Set}
  for (const [key, s] of byKey) {
    const machine = key.split('||')[0];
    if (!byMachine.has(machine)) byMachine.set(machine, { n: 0, hit1: 0, hit2: 0, none: 0, toolings: new Set() });
    const m = byMachine.get(machine);
    m.n += s.n; m.hit1 += s.hit1; m.hit2 += s.hit2; m.none += s.none;
    m.toolings.add(key.split('||')[1]);
  }

  report(args, byMachine, byKey, ambiguous);

  if (args.pmReport) {
    const md = buildPmReport(byMachine, byKey, { sampleN: withPlan });
    fs.mkdirSync(path.dirname(args.pmReport), { recursive: true });
    fs.writeFileSync(args.pmReport, md);
    console.log(`\n[eval] PM portfolio report written → ${args.pmReport}`);
  }

  // Machine roster: list configured machines that got 0 scored CNs.
  const machines = await configCache.getMachines();
  const roster = new Set();
  for (const m of machines) roster.add(m.machine_group || m.machine_name);
  const untested = [...roster].filter(name => !byMachine.has(name));
  if (untested.length) console.log(`\n[eval] machines with no scored CNs (no factory-family overlap in sample): ${untested.join(', ')}`);

  const exitCode = handleBaseline(args, byMachine);
  await closePools();
  process.exit(exitCode);
}

// ── report ───────────────────────────────────────────────────────────────────
function report(args, byMachine, byKey, ambiguous) {
  const rows = [...byMachine.entries()]
    .filter(([machine]) => !args.machine || machine === args.machine)
    .sort((a, b) => pct(a[1].hit1, a[1].n) - pct(b[1].hit1, b[1].n)); // worst first

  if (args.json) {
    const out = {};
    for (const [machine, s] of rows) out[machine] = { n: s.n, top1: +pct(s.hit1, s.n).toFixed(1), top2: +pct(s.hit2, s.n).toFixed(1), none: s.none };
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log('\n  Tooling-Select accuracy (worst → best, by factory ground truth)\n');
  console.log('  Machine                         top-1    top-2     n    none');
  console.log('  ' + '─'.repeat(62));
  for (const [machine, s] of rows) {
    const flag = ambiguous.has(machine) ? ' ⚠' : '';
    console.log(
      `  ${machine.padEnd(30)} ${fmtPct(s.hit1, s.n).padStart(6)}  ${fmtPct(s.hit2, s.n).padStart(6)} ` +
      `${String(s.n).padStart(5)}  ${String(s.none).padStart(5)}${flag}`
    );
    if (args.byTooling) {
      const tkeys = [...byKey.entries()].filter(([k]) => k.startsWith(machine + '||'))
        .sort((a, b) => pct(a[1].hit1, a[1].n) - pct(b[1].hit1, b[1].n));
      for (const [k, ts] of tkeys) {
        console.log(`      ${k.split('||')[1].padEnd(26)} ${fmtPct(ts.hit1, ts.n).padStart(6)}  ${fmtPct(ts.hit2, ts.n).padStart(6)} ${String(ts.n).padStart(5)}  ${String(ts.none).padStart(5)}`);
      }
    }
  }
  if (ambiguous.size) console.log('\n  ⚠ = two toolings share a DWG family on this machine; their alignment may be ambiguous.');
}

// ── baseline / regression ────────────────────────────────────────────────────
function handleBaseline(args, byMachine) {
  const current = {};
  for (const [machine, s] of byMachine) current[machine] = { n: s.n, top1: +pct(s.hit1, s.n).toFixed(1), top2: +pct(s.hit2, s.n).toFixed(1) };

  if (args.saveBaseline) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ savedAt: new Date().toISOString(), machines: current }, null, 2));
    console.log(`\n[eval] baseline saved → ${BASELINE_PATH}`);
    return 0;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.log('\n[eval] no baseline yet — run with --save-baseline to record one for regression checks.');
    return 0;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).machines || {};
  const regressions = [];
  console.log('\n  vs baseline (top-1 Δ):');
  for (const [machine, cur] of Object.entries(current)) {
    const base = baseline[machine];
    if (!base) { console.log(`    ${machine.padEnd(30)} new`); continue; }
    const d = cur.top1 - base.top1;
    const mark = d <= -args.tolerance ? ' ◀ REGRESSION' : (d >= args.tolerance ? ' ▲' : '');
    if (Math.abs(d) >= 0.1) console.log(`    ${machine.padEnd(30)} ${d > 0 ? '+' : ''}${d.toFixed(1)}pp${mark}`);
    if (d <= -args.tolerance) regressions.push(`${machine}: ${base.top1}% → ${cur.top1}%`);
  }
  if (regressions.length) {
    console.error(`\n[eval] ${regressions.length} regression(s) beyond ${args.tolerance}pp:\n  - ` + regressions.join('\n  - '));
    return 2;
  }
  console.log('  (no regression beyond tolerance)');
  return 0;
}

async function closePools() {
  try { await engPool.end(); } catch { /* already closed */ }
  try { await maqPool.end(); } catch { /* already closed */ }
}

// Only auto-run when invoked as a script — not when required by the unit test.
if (require.main === module) {
  main().catch(async (err) => {
    console.error('[eval] fatal:', err);
    await closePools();
    process.exit(1);
  });
}

module.exports = { familyOf, predToolNo, pct, resolveToolingFamilies, scoreRecords, pmRag, buildPmReport };
