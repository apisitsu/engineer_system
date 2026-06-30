'use strict';

// Regression tripwire for the recurring NULL-unsafe before-grind formula bug.
//
// `buildSpecContext` converts a NULL `od_bf`/`w_bf`/`id_bf` to 0, so a formula
// that references a *before-grind MAX/MIN* variable (`odBf_max`, `wBf_max`, ...)
// without a NULL guard computes ~0 and the search returns the smallest/wrong
// tool. This has been fixed and then silently REVERTED on the live DB at least
// four times (TSG-300, HAMAI 5B, KS-B22G/B80 JAW, KVD CARRIER — see
// .claude/rules/formula-reference.md and the 20260620_* migrations).
//
// The canonical safe form wraps the reference in a self/sibling guard, e.g.
//   if(odBf>0, odBf_max, odAft_max)      // raw before-grind sentinel
//   if(odBf_max>0, odBf_max, odAft_max)  // self guard
// This test fails if any row in `tooling_formula` references a before-grind
// MAX/MIN variable without such a guard, so a re-seed from a stale export can't
// regress unnoticed.
//
// Requires a live `eng_system` connection. When the DB is unreachable (most CI),
// the test SKIPS rather than fails — it is a guard for environments that have DB
// access, not a hard dependency.

const { engPool } = require('../../instance/eng_db');
const { TSV2_TABLES } = require('../../api/engineer/mtc/tsv2Constants');

// Before-grind variable families: { token regex, guard tokens that make it safe }.
// `od_bf`/`w_bf`/`id_bf` are the only spec columns that null→0 and drive selection.
const FAMILIES = [
  { name: 'od', vars: ['odBf_max', 'odBf_min'], guards: ['odBf>0', 'odBf_max>0', 'odBf_min>0'] },
  { name: 'w',  vars: ['wBf_max',  'wBf_min'],  guards: ['wBf>0',  'wBf_max>0',  'wBf_min>0'] },
  { name: 'id', vars: ['idBf_max', 'idBf_min'], guards: ['idBf>0', 'idBf_max>0', 'idBf_min>0'] },
];

// Rows that legitimately use a bare before-grind reference (e.g. a machine whose
// od_bf is always populated, or an averaging dim that tolerates 0). Key format:
// `${machine_id}|${tooling_name}|${output_key}`. Keep this empty unless an SME
// confirms the exemption — every entry is a documented decision, not a silencer.
const ALLOWLIST = new Set([
  // 'KS-XXX|WORK CHUCK|A',
]);

function findViolations(rows) {
  const violations = [];
  for (const r of rows) {
    const expr = (r.formula_expr || '').replace(/\s+/g, ''); // strip whitespace: `odBf > 0` → `odBf>0`
    if (!expr) continue;
    const key = `${r.machine_id}|${r.tooling_name}|${r.output_key}`;
    if (ALLOWLIST.has(key)) continue;

    for (const fam of FAMILIES) {
      const usesVar = fam.vars.some(v => expr.includes(v));
      if (!usesVar) continue;
      const guarded = fam.guards.some(g => expr.includes(g));
      if (!guarded) {
        violations.push(`${key}  →  ${r.formula_expr}`);
        break; // one report line per row is enough
      }
    }
  }
  return violations;
}

let dbRows = null; // null = DB unavailable → skip

beforeAll(async () => {
  try {
    const res = await engPool.query(
      `SELECT machine_id, tooling_name, output_key, formula_expr FROM ${TSV2_TABLES.FORMULA}`
    );
    dbRows = res.rows;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[tooling_formula null-safety] DB unavailable — skipping guard: ${err.message}`);
  }
}, 15000);

afterAll(async () => {
  try { await engPool.end(); } catch { /* pool may already be closed */ }
});

describe('tooling_formula NULL-safety guard (live DB)', () => {
  test('pure detector flags a bare before-grind reference and passes a guarded one', () => {
    const sample = [
      { machine_id: 'T', tooling_name: 'X', output_key: 'A', formula_expr: 'odBf_max + 0.2' },
      { machine_id: 'T', tooling_name: 'X', output_key: 'B', formula_expr: 'if(odBf>0, odBf_max, odAft_max) + 0.2' },
      { machine_id: 'T', tooling_name: 'X', output_key: 'C', formula_expr: 'if(odBf_max>0, odBf_max, odAft_max)' },
      { machine_id: 'T', tooling_name: 'X', output_key: 'D', formula_expr: 'OD + 0.5' },
    ];
    const v = findViolations(sample);
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('T|X|A');          // only the bare-reference row is flagged
    expect(v[0]).toContain('odBf_max + 0.2');
  });

  test('no active tooling_formula uses a NULL-unsafe before-grind MAX/MIN reference', () => {
    if (dbRows === null) {
      // eslint-disable-next-line no-console
      console.warn('[tooling_formula null-safety] skipped (no DB connection)');
      return;
    }
    const violations = findViolations(dbRows);
    if (violations.length) {
      // eslint-disable-next-line no-console
      console.error(
        `\n${violations.length} NULL-unsafe formula(s) in ${TSV2_TABLES.FORMULA} ` +
        `(wrap before-grind refs as if(xBf>0, xBf_max, xAft_max) or add to ALLOWLIST):\n  ` +
        violations.join('\n  ') + '\n'
      );
    }
    expect(violations).toEqual([]);
  });
});
