'use strict';

/**
 * 20260814_conform_tooling_select_to_re330_standards.js
 *
 * Brings Tooling Select V2 into line with the five machine tooling-design standards
 * held in `api/engineer/mtc/doc/`:
 *
 *   RE33032 B  KN-312B (和泉金属)      — ARBOR / NUT
 *   RE33037 D  KS-400B1–B4             — WORK DRIVER, CHUTE, SUPPORT BLOCK, PLUG A/B, STOCKER CHUTE
 *   RE33038 F  BRYANT "B" / KS-22RD    — the 10 ID-grind tooling
 *   RE33041 B  KS-B80                  — JAW / BACK PLATE
 *   RE33042 A  KS-B22G                 — JAW / BACK PLATE
 *
 * Three groups of change, all idempotent:
 *
 *   1. TYPE branch formulas on KN-312A/B. Both read the wrong variable, so 35–63 % of
 *      parts were assigned a tooling TYPE the standard does not give them. The TYPE
 *      does not feed any search rule, so this changes the *design dimensions reported*
 *      (arbor F/G/H/D4/L1/L3, nut F) — not which tool is matched off the shelf.
 *   2. Work-size limits. Several were looser than the standard, one machine had none
 *      at all on two axes, and KS-B22G's stored bounds disagreed with their own
 *      description as well as the standard. **These DO change eligibility** — see the
 *      impact report the script prints.
 *   3. Missing `inventory_tooling_filter` on search rules whose inventory table holds
 *      several tooling types. Without it the closest-match ranking runs across every
 *      type in the table and can return the wrong kind of tool entirely.
 *
 * Deliberately NOT changed, and why:
 *   • KS-03A `ID < 12` / KS-B22RD `ID >= 12` is the routing split between the pair, not
 *     an outer limit. RE33038 F caps the pair at ID ≤ 19; that cap is added to B22RD.
 *   • KN-312 `ID max = 48` and KS-B80 `OD min = 15` are stricter than the standards,
 *     which state no such bound. Conforming does not mean loosening a limit somebody
 *     added on purpose — both are kept and their descriptions now say they are local.
 *   • Tooling the standards list but the system has no inventory or formulas for
 *     (KS-400B STOCKER CHUTE, KS-B80 QUILL/QUILL BOLT/WHEEL, the 4664-21/22 plug pair).
 *     Those need dimensions nobody has entered — a data-entry job, not a migration.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260814_conform_tooling_select_to_re330_standards.js --dry
 *   node db_migrations/20260814_conform_tooling_select_to_re330_standards.js
 *
 * `--dry` does the whole thing inside a transaction and ROLLs BACK, printing the same
 * report. Run it first. The live config cache (`tsv2ConfigCache`, 60 s TTL) picks the
 * change up on its own — no restart needed.
 */

const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');

// Snapshot table. Tightening a limit removes a machine from parts it is offered for
// today — KS-B22G loses 86 % of its eligibility to RE33042 A's W ≥ 14 alone — so the
// pre-change state is kept verbatim and `--revert` puts it back in one command.
// Written once, on the first real run; never overwritten, or a second run would
// snapshot the already-migrated state and destroy the way back.
const BACKUP = 'tooling_config_backup_re330_20260814';

// ── 1. TYPE branch formulas ──────────────────────────────────────────────────
// RE33032 B §8-1 ARBOR: TYPE1 φ4<ID≤φ9 · TYPE2 φ9<ID≤φ25 · TYPE3 ID>φ25 and (SD-0.5)≤45
//                       TYPE4 ID>φ25 and 45<(SD-0.5).
// `ID` and `D2` are both in scope: ID is a spec-context variable, D2 = SD-0.5 is
// computed at sort_order 0, well before the TYPE row at 4.
// The standard's TYPE1 lower edge is exclusive (φ4<ID) while its work-size range is
// inclusive (φ4 以上), which leaves ID exactly 4 unassigned. `ID <= 9` closes that
// gap rather than emitting an undefined type for a part the standard admits.
const ARBOR_T = 'if(ID <= 9, 1, if(ID <= 25, 2, if(D2 <= 45, 3, 4)))';

// RE33032 B §8-2 NUT: TYPE1 (SD-0.5)+8 ≤ φ20 · TYPE2 φ20 < (SD-0.5)+8.
// `A` is already exactly (SD-0.5)+8 — it is computed as SD + 7.5 at sort_order 1.
const NUT_T = 'if(A <= 20, 1, 2)';

const FORMULA_FIXES = [
  { machine: 'KN-312A', tooling: 'ARBOR', key: 'T', expr: ARBOR_T, std: 'RE33032 B §8-1' },
  { machine: 'KN-312B', tooling: 'ARBOR', key: 'T', expr: ARBOR_T, std: 'RE33032 B §8-1' },
  { machine: 'KN-312A', tooling: 'NUT',   key: 'T', expr: NUT_T,   std: 'RE33032 B §8-2' },
  { machine: 'KN-312B', tooling: 'NUT',   key: 'T', expr: NUT_T,   std: 'RE33032 B §8-2' },
];

// ── 2. Work-size limits ──────────────────────────────────────────────────────
// `null` means "leave this bound absent". Every row states its source so the next
// person can tell a standard's number from a local one without opening the PDF.
const LIMITS = [
  // KS-B22G — RE33042 A §7: ID φ4.8～φ16, OD ≤φ38, W ≥14
  { machine: 'KS-B22G', v: 'ID', min: 4.8, minIn: true, max: 16, maxIn: true,
    desc: 'RE33042 A §7: ID φ4.8–φ16' },
  { machine: 'KS-B22G', v: 'OD', min: null, minIn: true, max: 38, maxIn: true,
    desc: 'RE33042 A §7: OD ≤ φ38' },
  { machine: 'KS-B22G', v: 'W', min: 14, minIn: true, max: null, maxIn: true,
    desc: 'RE33042 A §7: W ≥ 14' },

  // KS-03A / KS-B22RD — RE33038 F §7: OD ≤φ33, ID ≤φ19, W ≤29.
  // The ID 12 boundary between the two machines is the routing split, kept as-is.
  { machine: 'KS-03A', v: 'OD', min: null, minIn: true, max: 33, maxIn: true,
    desc: 'RE33038 F §7: OD ≤ φ33' },
  { machine: 'KS-03A', v: 'ID', min: null, minIn: true, max: 12, maxIn: false,
    desc: 'Routing split: KS-03A takes ID < 12, KS-B22RD takes ID ≥ 12. RE33038 F §7 caps the pair at ID ≤ 19.' },
  { machine: 'KS-03A', v: 'W', min: null, minIn: true, max: 29, maxIn: true,
    desc: 'RE33038 F §7: W ≤ 29' },
  { machine: 'KS-B22RD', v: 'OD', min: null, minIn: true, max: 33, maxIn: true,
    desc: 'RE33038 F §7: OD ≤ φ33' },
  { machine: 'KS-B22RD', v: 'ID', min: 12, minIn: true, max: 19, maxIn: true,
    desc: 'Routing split: KS-B22RD takes ID ≥ 12 (same formulas as KS-03A). RE33038 F §7: ID ≤ φ19.' },
  { machine: 'KS-B22RD', v: 'W', min: null, minIn: true, max: 29, maxIn: true,
    desc: 'RE33038 F §7: W ≤ 29' },

  // KN-312A / KN-312B — RE33032 B §7: ID ≥φ4, OD ≤φ66.7, W ≤68.
  // ID max 48 is NOT in the standard; kept because it is tighter, and labelled so.
  { machine: 'KN-312A', v: 'ID', min: 4, minIn: true, max: 48, maxIn: true,
    desc: 'RE33032 B §7: ID ≥ φ4. Max 48 is a local limit — RE33032 B states none.' },
  { machine: 'KN-312A', v: 'OD', min: null, minIn: true, max: 66.7, maxIn: true,
    desc: 'RE33032 B §7: OD ≤ φ66.7' },
  { machine: 'KN-312A', v: 'W', min: null, minIn: true, max: 68, maxIn: true,
    desc: 'RE33032 B §7: W ≤ 68' },
  { machine: 'KN-312B', v: 'ID', min: 4, minIn: true, max: 48, maxIn: true,
    desc: 'RE33032 B §7: ID ≥ φ4. Max 48 is a local limit — RE33032 B states none.' },
  { machine: 'KN-312B', v: 'OD', min: null, minIn: true, max: 66.7, maxIn: true,
    desc: 'RE33032 B §7: OD ≤ φ66.7' },
  { machine: 'KN-312B', v: 'W', min: null, minIn: true, max: 68, maxIn: true,
    desc: 'RE33032 B §7: W ≤ 68' },

  // KS-B80 — RE33041 B §7: ID ≥φ7.9, OD ≤φ70, W ≥14.
  // OD min 15 is NOT in the standard; kept because it is tighter, and labelled so.
  { machine: 'KS-B80', v: 'ID', min: 7.9, minIn: true, max: null, maxIn: true,
    desc: 'RE33041 B §7: ID ≥ φ7.9' },
  { machine: 'KS-B80', v: 'OD', min: 15, minIn: true, max: 70, maxIn: true,
    desc: 'RE33041 B §7: OD ≤ φ70. Min 15 is a local limit — RE33041 B states none.' },
  { machine: 'KS-B80', v: 'W', min: 14, minIn: true, max: null, maxIn: true,
    desc: 'RE33041 B §7: W ≥ 14' },

  // KS-400B1 — RE33037 D §7: W ≤30, OD ≤φ32. Already correct; restated for provenance.
  { machine: 'KS-400B1', v: 'OD', min: null, minIn: true, max: 32, maxIn: true,
    desc: 'RE33037 D §7: OD ≤ φ32' },
  { machine: 'KS-400B1', v: 'W', min: null, minIn: true, max: 30, maxIn: true,
    desc: 'RE33037 D §7: W ≤ 30' },
];

// ── 3. Missing tooling filters on shared inventory tables ────────────────────
// searchService takes the filter from `rules.find(r => r.inventory_tooling_filter)`,
// so one rule carrying it covers the tooling — but where NO rule carries it the
// ranking runs across every tooling type in the table.
// `KVD-300CRII · CARRIER` is deliberately absent: `tooling_kvd300cr2` holds CARRIER
// and nothing else, so there is no other type for the ranking to stray into.
const FILTERS = [
  { machine: 'KS-03A',      tooling: 'LOADER' },
  { machine: 'KS-B22RD',    tooling: 'LOADER' },         // 2 of 4 rules carried it
  { machine: 'KS-400B1',    tooling: 'LOADING CHUTE' },
  { machine: 'KS-400B1',    tooling: 'SUPPORT BLOCK' },
  { machine: 'KS-400B1',    tooling: 'PILOT PIN' },      // A had it, B did not
  { machine: 'TSG-300W',    tooling: 'CARRIER' },        // table also holds CHUTE COVER
];

const n = (v) => (v === null || v === undefined ? null : String(v));

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${BACKUP} (
        kind        TEXT NOT NULL,          -- 'limit' | 'formula' | 'search_rule'
        row_id      INTEGER NOT NULL,
        payload     JSONB NOT NULL,
        taken_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, row_id)
      )`);

    if (REVERT) {
      const r = await restore(client);
      log.push(`\n── REVERT ──────────────────────────────────────────────────────`);
      log.push(`   limits restored       : ${r.limits}`);
      log.push(`   limits deleted (added by this migration): ${r.deleted}`);
      log.push(`   formulas restored     : ${r.formulas}`);
      log.push(`   search rules restored : ${r.rules}`);
      const back = await eligibility(client);
      log.push('\n   eligibility now: ' + Object.entries(back).map(([k, v]) => `${k}=${v}`).join('  '));
      if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — rolled back. ***'); }
      else { await client.query('COMMIT'); log.push('\n*** REVERTED and committed. ***'); }
      console.log(log.join('\n'));
      return;
    }

    // ---- impact BEFORE ------------------------------------------------------
    const before = await eligibility(client);
    await snapshot(client, log);

    // ---- 1. formulas --------------------------------------------------------
    log.push('\n── TYPE formulas ───────────────────────────────────────────────');
    for (const f of FORMULA_FIXES) {
      const r = await client.query(
        `UPDATE tooling_formula fo SET formula_expr = $1, updated_at = now()
           FROM tooling_machine m
          WHERE m.id = fo.machine_id AND m.machine_name = $2
            AND fo.tooling_name = $3 AND fo.output_key = $4
            AND fo.formula_expr IS DISTINCT FROM $1
        RETURNING fo.id`,
        [f.expr, f.machine, f.tooling, f.key]
      );
      log.push(`   ${r.rowCount ? 'updated' : 'already correct'}  ${f.machine} ${f.tooling}.${f.key}  (${f.std})`);
    }

    // ---- 2. limits ----------------------------------------------------------
    log.push('\n── Work-size limits ────────────────────────────────────────────');
    for (const L of LIMITS) {
      const mid = await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [L.machine]);
      if (!mid.rows[0]) { log.push(`   SKIP    ${L.machine} — no such machine`); continue; }
      const machineId = mid.rows[0].id;

      const cur = await client.query(
        `SELECT id, min_value, max_value FROM tooling_machine_limit
          WHERE machine_id = $1 AND input_var = $2`, [machineId, L.v]);

      if (cur.rows[0]) {
        const r = await client.query(
          `UPDATE tooling_machine_limit
              SET min_value = $1, max_value = $2, min_inclusive = $3, max_inclusive = $4, description = $5
            WHERE id = $6
              AND (min_value IS DISTINCT FROM $1 OR max_value IS DISTINCT FROM $2
                OR min_inclusive IS DISTINCT FROM $3 OR max_inclusive IS DISTINCT FROM $4
                OR description IS DISTINCT FROM $5)
          RETURNING id`,
          [n(L.min), n(L.max), L.minIn, L.maxIn, L.desc, cur.rows[0].id]);
        const was = `was min=${cur.rows[0].min_value ?? '-'} max=${cur.rows[0].max_value ?? '-'}`;
        log.push(`   ${r.rowCount ? 'updated' : 'already correct'}  ${L.machine.padEnd(9)} ${L.v.padEnd(2)}  min=${L.min ?? '-'} max=${L.max ?? '-'}   ${r.rowCount ? was : ''}`);
      } else {
        await client.query(
          `INSERT INTO tooling_machine_limit
             (machine_id, input_var, min_value, max_value, min_inclusive, max_inclusive, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [machineId, L.v, n(L.min), n(L.max), L.minIn, L.maxIn, L.desc]);
        log.push(`   INSERTED ${L.machine.padEnd(9)} ${L.v.padEnd(2)}  min=${L.min ?? '-'} max=${L.max ?? '-'}   (had no bound at all)`);
      }
    }

    // ---- 3. filters ---------------------------------------------------------
    log.push('\n── Inventory tooling filters ───────────────────────────────────');
    for (const F of FILTERS) {
      const r = await client.query(
        `UPDATE tooling_search_rule s SET inventory_tooling_filter = $3
           FROM tooling_machine m
          WHERE m.id = s.machine_id AND m.machine_name = $1 AND s.tooling_name = $2
            AND s.inventory_tooling_filter IS DISTINCT FROM $3
        RETURNING s.id`,
        [F.machine, F.tooling, F.tooling]);
      log.push(`   ${r.rowCount ? `set on ${r.rowCount} rule(s)` : 'already correct'}  ${F.machine} · ${F.tooling}`);
    }

    // ---- impact AFTER -------------------------------------------------------
    const after = await eligibility(client);

    log.push('\n── Eligibility impact (parts the machine is offered for) ───────');
    log.push('   machine        before    after    change');
    for (const k of Object.keys(before)) {
      const d = after[k] - before[k];
      log.push(`   ${k.padEnd(13)} ${String(before[k]).padStart(6)}   ${String(after[k]).padStart(6)}   ${d === 0 ? '        —' : (d > 0 ? '+' : '') + d}`);
    }

    // Which single bound does the cutting, for the machines that lost the most.
    // A total alone invites "the standard is wrong"; naming the bound lets the floor
    // argue with the right number.
    log.push('\n── What does the cutting ───────────────────────────────────────');
    for (const name of ['KS-B22G', 'KS-B22RD', 'KN-312A']) {
      const each = await excludedByEachBound(client, name);
      log.push(`   ${name}: ` + each.map((e) => `${e.bound} → ${e.n}`).join(' · '));
    }

    if (DRY) {
      await client.query('ROLLBACK');
      log.push('\n*** DRY RUN — everything above was ROLLED BACK. Nothing was written. ***');
    } else {
      await client.query('COMMIT');
      log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s — no restart needed. ***');
    }
    console.log(log.join('\n'));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

/**
 * Per-bound exclusion count for one machine, against the whole spec population.
 * Counts are independent, not a partition — one part can fail two bounds — so they
 * do not sum to the eligibility drop. They answer "which bound is doing this?".
 */
async function excludedByEachBound(client, name) {
  const specs = await client.query(
    `SELECT od_aft, id_aft, w_aft FROM tooling_spec_process
      WHERE od_aft IS NOT NULL AND id_aft IS NOT NULL`);
  const lim = await client.query(
    `SELECT l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive
       FROM tooling_machine_limit l JOIN tooling_machine m ON m.id = l.machine_id
      WHERE m.machine_name = $1 ORDER BY l.input_var`, [name]);
  const out = [];
  for (const L of lim.rows) {
    for (const side of ['min', 'max']) {
      const bound = L[`${side}_value`];
      if (bound === null) continue;
      const incl = L[`${side}_inclusive`];
      const n = specs.rows.filter((s) => {
        const v = Number(s[`${L.input_var.toLowerCase()}_aft`]) || 0;
        return side === 'min' ? !(incl ? v >= +bound : v > +bound)
                              : !(incl ? v <= +bound : v < +bound);
      }).length;
      out.push({ bound: `${L.input_var} ${side === 'min' ? '≥' : '≤'} ${bound}`, n });
    }
  }
  return out.sort((a, b) => b.n - a.n);
}

/** Machines whose config this migration touches. */
const TOUCHED = ['KS-B22G', 'KS-03A', 'KS-B22RD', 'KN-312A', 'KN-312B', 'KS-B80', 'KS-400B1', 'TSG-300W'];

/**
 * Copy every row this migration can change into the backup table, once.
 * `ON CONFLICT DO NOTHING` is what makes it once: a re-run finds the keys already
 * there and leaves the original pre-migration values alone.
 */
async function snapshot(client, log) {
  const existing = await client.query(`SELECT count(*)::int n FROM ${BACKUP}`);
  const q = (kind, sql) => client.query(
    `INSERT INTO ${BACKUP} (kind, row_id, payload)
     SELECT $1, t.id, to_jsonb(t) FROM (${sql}) t
     ON CONFLICT (kind, row_id) DO NOTHING`, [kind]);

  const list = TOUCHED.map((m) => `'${m}'`).join(',');
  await q('limit', `SELECT l.* FROM tooling_machine_limit l JOIN tooling_machine m ON m.id=l.machine_id WHERE m.machine_name IN (${list})`);
  await q('formula', `SELECT f.* FROM tooling_formula f JOIN tooling_machine m ON m.id=f.machine_id WHERE m.machine_name LIKE 'KN-312%' AND f.output_key='T'`);
  await q('search_rule', `SELECT s.* FROM tooling_search_rule s JOIN tooling_machine m ON m.id=s.machine_id WHERE m.machine_name IN (${list})`);

  const after = await client.query(`SELECT count(*)::int n FROM ${BACKUP}`);
  log.push(`\n── Snapshot ────────────────────────────────────────────────────`);
  log.push(existing.rows[0].n === 0
    ? `   ${after.rows[0].n} rows saved to ${BACKUP} — revert with --revert`
    : `   ${BACKUP} already holds ${existing.rows[0].n} pre-migration rows; left untouched`);
}

/** Put the snapshotted rows back, and drop limits that did not exist before. */
async function restore(client) {
  const lim = await client.query(`SELECT row_id, payload FROM ${BACKUP} WHERE kind='limit'`);
  for (const r of lim.rows) {
    const p = r.payload;
    await client.query(
      `UPDATE tooling_machine_limit SET min_value=$1, max_value=$2, min_inclusive=$3,
              max_inclusive=$4, description=$5 WHERE id=$6`,
      [p.min_value, p.max_value, p.min_inclusive, p.max_inclusive, p.description, r.row_id]);
  }
  const keep = lim.rows.map((r) => r.row_id);
  const list = TOUCHED.map((m) => `'${m}'`).join(',');
  const del = await client.query(
    `DELETE FROM tooling_machine_limit l USING tooling_machine m
      WHERE m.id = l.machine_id AND m.machine_name IN (${list})
        AND NOT (l.id = ANY($1::int[])) RETURNING l.id`, [keep]);

  const fo = await client.query(`SELECT row_id, payload FROM ${BACKUP} WHERE kind='formula'`);
  for (const r of fo.rows) {
    await client.query(`UPDATE tooling_formula SET formula_expr=$1 WHERE id=$2`, [r.payload.formula_expr, r.row_id]);
  }
  const sr = await client.query(`SELECT row_id, payload FROM ${BACKUP} WHERE kind='search_rule'`);
  for (const r of sr.rows) {
    await client.query(`UPDATE tooling_search_rule SET inventory_tooling_filter=$1 WHERE id=$2`,
      [r.payload.inventory_tooling_filter, r.row_id]);
  }
  return { limits: lim.rowCount, deleted: del.rowCount, formulas: fo.rowCount, rules: sr.rowCount };
}

/**
 * How many part specs each machine's limits admit, evaluated the same way
 * `searchService.checkMachineLimits` does — every bound must pass, a missing bound
 * passes, and inclusivity is honoured. Run before and after so the report says what
 * the tightening actually costs rather than leaving it to be discovered on the floor.
 */
async function eligibility(client) {
  const machines = ['KS-B22G', 'KS-03A', 'KS-B22RD', 'KN-312A', 'KN-312B', 'KS-B80', 'KS-400B1'];
  const out = {};
  const specs = await client.query(
    `SELECT od_aft, id_aft, w_aft FROM tooling_spec_process
      WHERE od_aft IS NOT NULL AND id_aft IS NOT NULL`);
  for (const name of machines) {
    const lim = await client.query(
      `SELECT l.input_var, l.min_value, l.max_value, l.min_inclusive, l.max_inclusive
         FROM tooling_machine_limit l JOIN tooling_machine m ON m.id = l.machine_id
        WHERE m.machine_name = $1`, [name]);
    out[name] = specs.rows.filter((s) => {
      const ctx = { OD: Number(s.od_aft) || 0, ID: Number(s.id_aft) || 0, W: Number(s.w_aft) || 0 };
      return lim.rows.every((L) => {
        const v = ctx[L.input_var];
        if (v === undefined) return true;
        if (L.min_value !== null && !(L.min_inclusive ? v >= +L.min_value : v > +L.min_value)) return false;
        if (L.max_value !== null && !(L.max_inclusive ? v <= +L.max_value : v < +L.max_value)) return false;
        return true;
      });
    }).length;
  }
  return out;
}

run();
