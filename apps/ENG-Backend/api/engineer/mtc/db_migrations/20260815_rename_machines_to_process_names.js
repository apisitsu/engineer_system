'use strict';

/**
 * 20260815_rename_machines_to_process_names.js
 *
 * Replaces three machine names I invented with the strings the source documents
 * actually use. None of the three is a machine — each is a *process*, which is why no
 * machine name was findable for them.
 *
 *     ROLLING  →  THREAD ROLL     MARKING  →  L/MARKING     LB-15  →  TURNING
 *
 * ── Where each name comes from ───────────────────────────────────────────────
 * **TEMPLATE_B.xlsx** lists tooling per part family with the columns
 * `C/N (process code) | process | … | tooling | drawing family`:
 *
 *     M-BODY / ROLLER BODY / ABR BODY row  →  1841 · THREAD ROLL · THREAD DICE · 4800-57
 *     SLEEVE row                           →  3491 · L/MARKING   · PALLET      · 4918-02
 *
 * **`20260202_Tooling_Excel_List.xlsm`** — the index of every tooling list, with a
 * literal `マシン(Machine)` column:
 *
 *     row 46   20201019_球削アーバー(4649-05)   工程 松井田(MTD)   マシン **TURNING**
 *     row 85   20250217_TOOLING LIST_4853-XX   工程 研磨(GRIND)   マシン IZUMI
 *     row 121  QUILL&BOLT LIST2                工程 研磨(GRIND)   マシン KS-B80
 *
 * So `LB-15` was wrong outright — the index's Machine column for the 球削 arbor list
 * says TURNING. The other two rows are shown because they are the reason KN-113A keeps
 * its name: that column names a real machine (IZUMI / KS-B80) when one exists, and this
 * migration only renames the three entries where it does not.
 *
 * ── One correction this surfaces ─────────────────────────────────────────────
 * The audit recorded the thread-rolling process as 2511 / 2501. TEMPLATE_B says **1841**
 * on all three body sheets. 3491 for L/MARKING matches. The process codes are recorded
 * on the machine label here so the next reader does not have to re-derive them.
 *
 * Renaming a *machine* is safe in a way renaming a tooling is not: `tooling_name` and
 * `inventory_tooling_filter` carry tooling names, never machine names, and formulas and
 * search rules join on `machine_id`. Only `tooling_machine` and the `machine` column
 * stamped on the inventory rows need to change.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815_rename_machines_to_process_names.js --dry
 *   node api/engineer/mtc/db_migrations/20260815_rename_machines_to_process_names.js
 *   node api/engineer/mtc/db_migrations/20260815_rename_machines_to_process_names.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');

const RENAMES = [
  { from: 'ROLLING', to: 'THREAD ROLL', inv: 'tooling_rolling',
    label: 'THREAD ROLL (転造 · process 1841)',
    note: 'TEMPLATE_B M-BODY / ROLLER BODY / ABR BODY: 1841 · THREAD ROLL · THREAD DICE · 4800-57.' },
  { from: 'MARKING', to: 'L/MARKING', inv: 'tooling_marking',
    label: 'L/MARKING (レーザマーキング · process 3491)',
    note: 'TEMPLATE_B SLEEVE: 3491 · L/MARKING · PALLET · 4918-02.' },
  { from: 'LB-15', to: 'TURNING', inv: 'tooling_lb15',
    label: 'TURNING (球削 · 松井田 MTD)',
    note: '20260202_Tooling_Excel_List.xlsm row 46, マシン(Machine) column = TURNING.' },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    for (const r of RENAMES) {
      const [from, to] = REVERT ? [r.to, r.from] : [r.from, r.to];
      const exists = (await client.query(
        `SELECT id FROM tooling_machine WHERE machine_name = $1`, [from])).rows[0];
      if (!exists) {
        log.push(`   ${from.padEnd(12)} not present — already ${to}`);
        continue;
      }
      // `tooling_machine` has no description column — the provenance lives in this file's
      // header, and `label` carries the process code, which is the part an operator needs.
      await client.query(
        `UPDATE tooling_machine SET machine_name = $2, label = $3 WHERE machine_name = $1`,
        [from, to, REVERT ? from : r.label]);
      // The inventory rows carry a `machine` text stamp for display; keep it in step.
      const inv = await client.query(
        `UPDATE ${r.inv} SET machine = $2 WHERE machine = $1 RETURNING 1`, [from, to]);
      log.push(`   ${from.padEnd(12)} → ${to.padEnd(12)}  (machine row + ${inv.rowCount} inventory stamps)`);
    }

    // Nothing else should ever hold a machine name as text — prove it rather than assume.
    log.push('\n── Verify no machine name is stored as text anywhere else ──');
    for (const t of ['tooling_formula', 'tooling_search_rule']) {
      const names = RENAMES.flatMap((r) => [r.from, r.to]);
      const q = await client.query(
        `SELECT count(*)::int n FROM ${t} WHERE tooling_name = ANY($1)`, [names]);
      log.push(`   ${t.padEnd(22)} rows whose tooling_name is a machine name: ${q.rows[0].n}`);
    }
    const machines = (await client.query(
      `SELECT machine_name FROM tooling_machine
        WHERE machine_name = ANY($1) ORDER BY 1`,
      [RENAMES.map((r) => (REVERT ? r.from : r.to))])).rows.map((x) => x.machine_name);
    log.push(`   tooling_machine now has: ${machines.join(', ') || 'none'}`);

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
    console.log(`── ${REVERT ? 'REVERT' : 'Rename'} ──\n${log.join('\n')}`);
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
