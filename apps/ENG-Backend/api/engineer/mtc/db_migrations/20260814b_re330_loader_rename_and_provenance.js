'use strict';

/**
 * 20260814b_re330_loader_rename_and_provenance.js
 *
 * The second half of the RE330xx conformance work (see 20260814_conform_...js).
 * Two things the first migration deliberately left, both now settled by evidence
 * rather than by guess.
 *
 * ── 1. LOADER points at the family withdrawn in 2015 ─────────────────────────
 * `tooling_ks03a` stores:
 *     LOADER        → 4559-06 · 154 rows
 *     NYLON LOADER  → 4559-41 · 104 rows
 *
 * Every source says that is backwards:
 *   • RE33038 F §6-10 / §8-10 — "LOADER 図番：4559-41-XXXX" — the loader IS 4559-41.
 *   • RE33038 rev C (2015.03.20) — 「ローダー4559-41-XXXX を追加。ローダー4559-06-XXXX を
 *     参照のみに変更」 — 4559-41 added, 4559-06 demoted to reference-only.
 *   • TEMPLATE_B.xlsx calls BOTH rows "LOADER", marking 4559-06
 *     「2017/04/03より選定/設計しないこと」 (do not select or design) and 4559-41
 *     "Standard" / 新設計.
 *   • The word NYLON appears nowhere in TEMPLATE_B, in any of the five standards, or
 *     in any drawing number. It is a local label with no external basis.
 *
 * So an engineer picking LOADER today is handed a family retired in 2017. The rename
 * makes 4559-41 the LOADER and keeps 4559-06 visible under a name that states what it
 * is — the worksheet lists it too, marked do-not-select, so hiding it entirely would
 * depart from the worksheet in the other direction.
 *
 * ── 2. Provenance that the first migration got wrong or left blank ───────────
 * The first migration stamped "RE33032 B §7" on KN-312**A**'s limits. RE33032 B is
 * written for KN-312**B** (和泉金属製 KN-312B); TEMPLATE_B notes KN-312A is the manual
 * machine. The bounds are still the best available, but the description should not
 * claim a standard governs a machine it does not name. Same for KS-400B5 / KS-400B6,
 * whose OD limits (40 and 35) exceed RE33037 D's 32 — because that standard's scope is
 * KS-400B1–B4 and neither machine is in it. Saying so is the conformance action; there
 * is no standard to conform them to.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260814b_re330_loader_rename_and_provenance.js --dry
 *   node api/engineer/mtc/db_migrations/20260814b_re330_loader_rename_and_provenance.js
 *   node api/engineer/mtc/db_migrations/20260814b_re330_loader_rename_and_provenance.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');
const BACKUP = 'tooling_config_backup_re330b_20260814';

const OLD_LOADER = 'LOADER';
const REF_LOADER = 'LOADER (4559-06 REF)';   // withdrawn 2015, do-not-select since 2017
const NEW_LOADER = 'NYLON LOADER';           // actually 4559-41 — becomes LOADER

// Every place a tooling name is written. `inventory_tooling_filter` matters as much as
// `tooling_name`: it is the string the search compares against the inventory, so a
// rename that misses it silently returns nothing.
const RENAME_TARGETS = [
  { table: 'tooling_ks03a',       col: 'tooling_name' },
  { table: 'tooling_formula',     col: 'tooling_name' },
  { table: 'tooling_search_rule', col: 'tooling_name' },
  { table: 'tooling_search_rule', col: 'inventory_tooling_filter' },
];

// Descriptions that should not claim a standard governs a machine it does not name.
const PROVENANCE = [
  { machine: 'KN-312A', v: 'ID',
    desc: 'ID ≥ φ4 from RE33032 B §7, which is written for KN-312B — TEMPLATE_B notes KN-312A is the manual machine and no standard names it. Max 48 is a local limit.' },
  { machine: 'KN-312A', v: 'OD',
    desc: 'OD ≤ φ66.7 from RE33032 B §7 (written for KN-312B; applied to KN-312A as the same family — no standard names KN-312A).' },
  { machine: 'KN-312A', v: 'W',
    desc: 'W ≤ 68 from RE33032 B §7 (written for KN-312B; applied to KN-312A as the same family — no standard names KN-312A).' },
  { machine: 'KS-400B5', v: 'OD',
    desc: 'No design standard covers KS-400B5 — RE33037 D scope is KS-400B1–B4. OD ≤ 40 is a local limit and deliberately exceeds that standard.' },
  { machine: 'KS-400B6', v: 'OD',
    desc: 'No design standard covers KS-400B6 — RE33037 D scope is KS-400B1–B4. OD ≤ 35 is a local limit and deliberately exceeds that standard.' },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${BACKUP} (
        kind TEXT NOT NULL, row_id INTEGER NOT NULL, payload JSONB NOT NULL,
        taken_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (kind, row_id))`);

    if (REVERT) {
      const r = await restore(client);
      log.push(`── REVERT ──\n   inventory ${r.inv} · formulas ${r.fo} · search rules ${r.sr} · limits ${r.lim}`);
      await finish(client, log);
      return;
    }

    // snapshot, once
    const had = (await client.query(`SELECT count(*)::int n FROM ${BACKUP}`)).rows[0].n;
    const snap = (kind, sql) => client.query(
      `INSERT INTO ${BACKUP} (kind,row_id,payload) SELECT $1, t.id, to_jsonb(t) FROM (${sql}) t
       ON CONFLICT (kind,row_id) DO NOTHING`, [kind]);
    await snap('inv', `SELECT * FROM tooling_ks03a WHERE tooling_name IN ('${OLD_LOADER}','${NEW_LOADER}','${REF_LOADER}')`);
    await snap('formula', `SELECT * FROM tooling_formula WHERE tooling_name IN ('${OLD_LOADER}','${NEW_LOADER}','${REF_LOADER}')`);
    await snap('rule', `SELECT * FROM tooling_search_rule WHERE tooling_name IN ('${OLD_LOADER}','${NEW_LOADER}','${REF_LOADER}') OR inventory_tooling_filter IN ('${OLD_LOADER}','${NEW_LOADER}','${REF_LOADER}')`);
    await snap('limit', `SELECT l.* FROM tooling_machine_limit l JOIN tooling_machine m ON m.id=l.machine_id WHERE m.machine_name IN ('KN-312A','KS-400B5','KS-400B6')`);
    log.push(`── Snapshot ──\n   ${had === 0 ? `saved to ${BACKUP}` : `${BACKUP} already holds ${had} pre-migration rows; left untouched`}`);

    // ── rename, in two steps so the two names never collide ──────────────────
    log.push('\n── LOADER rename ──');
    const already = (await client.query(
      `SELECT count(*)::int n FROM tooling_ks03a WHERE tooling_name = $1`, [NEW_LOADER])).rows[0].n;
    if (already === 0) {
      log.push('   already renamed — nothing to do');
    } else {
      for (const [from, to] of [[OLD_LOADER, REF_LOADER], [NEW_LOADER, OLD_LOADER]]) {
        for (const t of RENAME_TARGETS) {
          const r = await client.query(
            `UPDATE ${t.table} SET ${t.col} = $2 WHERE ${t.col} = $1 RETURNING 1`, [from, to]);
          if (r.rowCount) log.push(`   ${String(t.table + '.' + t.col).padEnd(42)} "${from}" → "${to}"  ${r.rowCount} row(s)`);
        }
      }
    }

    // ── provenance ───────────────────────────────────────────────────────────
    log.push('\n── Provenance ──');
    for (const p of PROVENANCE) {
      const r = await client.query(
        `UPDATE tooling_machine_limit l SET description = $3
           FROM tooling_machine m
          WHERE m.id = l.machine_id AND m.machine_name = $1 AND l.input_var = $2
            AND l.description IS DISTINCT FROM $3
        RETURNING l.id`, [p.machine, p.v, p.desc]);
      log.push(`   ${r.rowCount ? 'updated' : 'already correct'}  ${p.machine} ${p.v}`);
    }

    // ── verify the rename left nothing dangling ──────────────────────────────
    log.push('\n── Verify ──');
    for (const name of [OLD_LOADER, REF_LOADER]) {
      const inv = (await client.query(
        `SELECT substring(tooling_no from '^[0-9]+-[0-9]+') fam, count(*)::int n
           FROM tooling_ks03a WHERE tooling_name=$1 GROUP BY 1`, [name])).rows;
      const rules = (await client.query(
        `SELECT m.machine_name, count(*)::int n,
                count(*) FILTER (WHERE s.inventory_tooling_filter = $1)::int filt
           FROM tooling_search_rule s JOIN tooling_machine m ON m.id=s.machine_id
          WHERE s.tooling_name=$1 GROUP BY 1 ORDER BY 1`, [name])).rows;
      log.push(`   "${name}" → inventory ${inv.map(x => `${x.fam}:${x.n}`).join(' ') || 'none'}` +
               ` · rules ${rules.map(r => `${r.machine_name} ${r.filt}/${r.n} filtered`).join(', ') || 'none'}`);
    }
    const orphan = (await client.query(
      `SELECT count(*)::int n FROM tooling_search_rule WHERE inventory_tooling_filter = $1`, [NEW_LOADER])).rows[0].n;
    log.push(`   filters still pointing at "${NEW_LOADER}": ${orphan}${orphan ? '  <-- PROBLEM' : ''}`);

    await finish(client, log);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

async function finish(client, log) {
  if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
  else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
  console.log(log.join('\n'));
}

async function restore(client) {
  const put = async (kind, table, cols) => {
    const rows = (await client.query(`SELECT row_id, payload FROM ${BACKUP} WHERE kind=$1`, [kind])).rows;
    for (const r of rows) {
      const set = cols.map((c, i) => `${c}=$${i + 1}`).join(', ');
      await client.query(`UPDATE ${table} SET ${set} WHERE id=$${cols.length + 1}`,
        [...cols.map((c) => r.payload[c]), r.row_id]);
    }
    return rows.length;
  };
  return {
    inv: await put('inv', 'tooling_ks03a', ['tooling_name']),
    fo:  await put('formula', 'tooling_formula', ['tooling_name']),
    sr:  await put('rule', 'tooling_search_rule', ['tooling_name', 'inventory_tooling_filter']),
    lim: await put('limit', 'tooling_machine_limit', ['description']),
  };
}

run();
