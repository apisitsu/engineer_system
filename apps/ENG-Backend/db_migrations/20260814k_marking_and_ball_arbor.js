'use strict';

/**
 * 20260814k_marking_and_ball_arbor.js
 *
 * The last two machines from the TEMPLATE_B sheet audit.
 *
 * ── 1. MARKING — PALLET 4918-02, 37 rows (process 3491) ──────────────────────
 * The rule is written in prose at the top of the sibling sheet in the same workbook
 * (`4918-03-xxxx-01`), and governs the family:
 *
 *     W ： ワーク最大巾 + GAP        GAP : 0.05 〜 0.35
 *
 * So the pallet slot is the part's **maximum** width plus a small clearance. The shelf
 * is a clean 0.5 mm ladder from 5.0 to 16.0 with a handful of odd sizes below and a few
 * 専用 (dedicated) entries, so a target of `wAft_max + 0.2` with ±0.15 admits exactly
 * the stated 0.05–0.35 band and the ladder guarantees a hit inside it.
 *
 * ── 2. LB-15 — ball-turning ARBOR 4649-05 + NUT 4649-06 + COLLAR 4649-07 ─────
 * `20201019_球削アーバー(4649-05).xlsx` is a flat list with **no calculation block**,
 * so the rule here is inferred, and that is stated plainly rather than dressed up:
 *
 *   • Two of its 適用型式 resolve to real spec rows, and on both the arbor diameter
 *     D3 sits just under the ball bore:
 *         4649-05-0051  D3 10.89  part ID 11.13   (−0.24)
 *         4649-05-0059  D3 37.75  part ID 38.10   (−0.35)
 *   • That is the same shape as X-100's ARBOR rule, which *is* written down:
 *     `A = ROUNDDOWN(BALL ID(MIN) − 0.01, 2)` — an arbor enters the bore, so it is the
 *     bore minus a clearance.
 *
 * **Two validated pairs is not a rule, and the tolerance reflects that.** The target is
 * `ID − 0.3` with ±1.0, wide enough that the ranking does the work and narrow enough to
 * cut a 60-row shelf down to a few candidates. It is a shortlist, not an answer. If the
 * 球削 drawing ever surfaces, replace this formula — do not tune the tolerance around it.
 *
 * NUT and COLLAR are **paired to the arbor on its own row**, not selected independently,
 * so they carry the arbor's D3 as their key and will always return alongside it.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260814k_marking_and_ball_arbor.js --dry
 *   node db_migrations/20260814k_marking_and_ball_arbor.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');

const JOBS = [
  {
    machine: 'MARKING', inv: 'tooling_marking', file: 'marking_pallets_4918.json',
    flat: 'PALLET',
    formulas: {
      PALLET: [{ key: 'A', expr: 'wAft_max + 0.2', sort: 0,
        desc: 'Laser-marking jig workbook, 4918-03 sheet header: W = ワーク最大巾 + GAP, GAP 0.05〜0.35. Target is the mid-band.' }],
    },
    rules: {
      PALLET: [{ key: 'A', col: 'dim_a', plus: '0.15', minus: '0.15', match: true, prio: 0,
        label: 'Pallet slot (W_max + gap)' }],
    },
  },
  {
    machine: 'LB-15', inv: 'tooling_lb15', file: 'ball_arbor_4649.json',
    formulas: {
      ARBOR: [
        { key: 'A', expr: 'ID - 0.3', sort: 0,
          desc: 'INFERRED, not from a drawing: the 球削 list has no calculation block. Two 適用型式 that resolve to spec rows put D3 at ID −0.24 and −0.35; X-100 ARBOR (which is documented) is likewise the ball bore minus a clearance. Treat results as a shortlist.' },
        { key: 'B', expr: 'OD', sort: 1, desc: 'Shoulder dia 肩径 — ranking only, no rule on the sheet.' },
      ],
      NUT:    [{ key: 'A', expr: 'ID - 0.3', sort: 0, desc: 'Paired to the arbor on its sheet row; keyed on the arbor diameter.' }],
      COLLAR: [{ key: 'A', expr: 'ID - 0.3', sort: 0, desc: 'Paired to the arbor on its sheet row; keyed on the arbor diameter.' }],
    },
    rules: {
      ARBOR: [
        { key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true,  prio: 0, label: 'Arbor dia (ball bore − clearance)' },
        { key: 'B', col: 'dim_b', plus: null,  minus: null,  match: false, prio: 1, label: 'Shoulder dia' },
      ],
      NUT:    [{ key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true, prio: 0, label: 'Mating arbor dia' }],
      COLLAR: [{ key: 'A', col: 'dim_a', plus: '1.0', minus: '1.0', match: true, prio: 0, label: 'Mating arbor dia' }],
    },
  },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    for (const job of JOBS) {
      log.push(`\n══ ${job.machine} ══`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${job.inv} (
          id            SERIAL PRIMARY KEY,
          tooling_name  TEXT NOT NULL,
          tooling_no    TEXT NOT NULL,
          machine       TEXT,
          note          TEXT,
          dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC, dim_e NUMERIC
        )`);

      const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', job.file), 'utf8'));
      const data = job.flat ? { [job.flat]: raw } : raw;

      for (const [tooling, rows] of Object.entries(data)) {
        const have = (await client.query(
          `SELECT count(*)::int n FROM ${job.inv} WHERE tooling_name = $1`, [tooling])).rows[0].n;
        if (have > 0) {
          log.push(`   ${tooling}: already ${have} rows — left alone`);
        } else {
          // Column order below must match the values array exactly — a mismatch does not raise.
          const COLS = 9;
          const ph = rows.map((_, i) =>
            `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
          const vals = rows.flatMap((r) => [
            tooling, r.tooling_no, job.machine, r.note ?? null,
            r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null, r.dim_d ?? null, r.dim_e ?? null,
          ]);
          await client.query(
            `INSERT INTO ${job.inv} (tooling_name, tooling_no, machine, note, dim_a, dim_b, dim_c, dim_d, dim_e)
             VALUES ${ph}`, vals);
          log.push(`   ${tooling}: inserted ${rows.length} rows ` +
                   `(A ${Math.min(...rows.map((r) => r.dim_a))}–${Math.max(...rows.map((r) => r.dim_a))})`);
        }
      }

      let m = (await client.query(
        `SELECT id FROM tooling_machine WHERE machine_name = $1`, [job.machine])).rows[0];
      if (!m) {
        m = (await client.query(
          `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
           VALUES ($1,$1,$2,true) RETURNING id`, [job.machine, job.inv])).rows[0];
        log.push(`   machine created (id ${m.id}) → ${job.inv}`);
      } else {
        log.push(`   machine already exists (id ${m.id})`);
      }
      const mid = m.id;

      for (const [tooling, fs_] of Object.entries(job.formulas)) {
        for (const f of fs_) {
          const r = await client.query(
            `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
             SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
              WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                                 WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
             RETURNING id`, [mid, tooling, f.key, f.expr, f.sort, f.desc]);
          log.push(`   formula ${r.rowCount ? 'added ' : 'exists'}  ${tooling}.${f.key} = ${f.expr}`);
        }
      }
      for (const [tooling, rs] of Object.entries(job.rules)) {
        for (const q of rs) {
          const r = await client.query(
            `INSERT INTO tooling_search_rule
               (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
                sort_priority, label, inventory_tooling_filter, is_match_dim)
             SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,$10::boolean
              WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                                 WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
             RETURNING id`,
            [mid, tooling, q.key, q.col, q.plus, q.minus, q.prio, q.label, tooling, q.match]);
          log.push(`   rule    ${r.rowCount ? 'added ' : 'exists'}  ${tooling}.${q.key} -> ${q.col}  ` +
                   `${q.plus ? `±${q.plus}` : 'rank-only'}`);
        }
      }
    }

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
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

run();
