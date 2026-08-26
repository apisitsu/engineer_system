'use strict';

/**
 * Make `db_migrations` usable as a run log, and backfill what is known to have run.
 * ------------------------------------------------------------------------------
 * The table was created 2026-04-21 with `(id, name, executed_at)` and exactly one writer
 * — `migrate_kanban_performance.js`. 111 migration files later it still held **one row**,
 * so "has this already been applied?" had no answer anywhere.
 *
 * That cost something real on 2026-08-26: `20260821n_sds_machine_tool_append.js` added two
 * X-100 fixture slots, a person deliberately removed them through SDS Admin, and nothing
 * would have stopped the next person re-running the migration and undoing that decision.
 * `lib/migrationLog.js` is the mechanism; this is the schema and the seed data for it.
 *
 * WHAT CHANGES
 *
 *     reverted_at  timestamptz   set when a migration is run with --revert. A row with a
 *                                reverted_at is "not currently applied", which is a third
 *                                state the single timestamp could not express.
 *     run_by       varchar(64)   user@host, best effort, for the audit trail.
 *
 * `name` is already UNIQUE, which is what `ON CONFLICT (name)` in the helper relies on.
 * Nothing is dropped and the existing row is untouched.
 *
 * WHAT IS BACKFILLED, AND WHY ONLY THIS MUCH
 *
 * Only the migrations run in the 2026-08-21 / 08-25 sessions are seeded, because those are
 * the ones whose application was **observed and verified live** in the same sitting. For
 * the other ~100 files there is no evidence of when — or whether — they ran; inventing an
 * `executed_at` would make the table lie in a more convincing way than leaving it empty.
 * They will record themselves the next time anyone runs them.
 *
 * `executed_at` for the backfilled rows is the session date, not now(), so the log does not
 * claim they were applied by this migration.
 *
 * Idempotent; `--revert` drops the two columns and removes only the rows it seeded.
 */

const { engPool } = require('../instance/eng_db');

const TABLE = 'db_migrations';

// Applied and verified live during the sessions named. Nothing else is assumed.
const BACKFILL = [
  ['20260821_retire_stale_tooling_template_b',   '2026-08-21'],
  ['20260821b_ks400b1_second_plug_pair',         '2026-08-21'],
  ['20260821c_ksb80_quill_and_bolt',             '2026-08-21'],
  ['20260821d_ksb22g_widen_id_limit',            '2026-08-21'],
  ['20260821e_ks400b5_tighten_od_limit',         '2026-08-21'],
  ['20260821f_rotary_dresser_shelf',             '2026-08-21'],
  ['20260821g_pilot_pin_assy_suffix',            '2026-08-21'],
  ['20260821l_oc16a_collar_typo',                '2026-08-21'],
  ['20260821m_roller_shoe_cn_map',               '2026-08-21'],
  ['20260821n_sds_machine_tool_append',          '2026-08-25'],
  ['20260821o_sds_tpsw03_process_2412',          '2026-08-25'],
  ['20260821p_sds_machine_tool_template_b_gaps', '2026-08-25'],
  ['20260825_sds_print_log',                     '2026-08-25'],
  ['20260825b_sds_machine_tool_new_machines',    '2026-08-25'],
  ['20260825c_sds_machine_tool_tier_a',          '2026-08-25'],
  ['20260825d_sds_rotary_dresser_last_slot',     '2026-08-25'],
  ['20260825e_sds_machine_tool_tier_a2',         '2026-08-25'],
];

const revert = process.argv.includes('--revert');

async function main() {
  if (revert) {
    await engPool.query(
      `DELETE FROM ${TABLE} WHERE name = ANY($1)`, [BACKFILL.map((r) => r[0])]);
    await engPool.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS reverted_at`);
    await engPool.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS run_by`);
    console.log(`reverted: columns dropped, ${BACKFILL.length} seeded rows removed`);
    return;
  }

  await engPool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ`);
  await engPool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS run_by VARCHAR(64)`);
  await engPool.query(
    `COMMENT ON TABLE ${TABLE} IS $c$Migration run log. Written by db_migrations/lib/migrationLog.js — every migration should call recordRun() on success and recordRevert() on --revert. A row with reverted_at set is NOT currently applied.$c$`);

  let seeded = 0;
  for (const [name, day] of BACKFILL) {
    const r = await engPool.query(
      `INSERT INTO ${TABLE} (name, executed_at, run_by)
       VALUES ($1, $2::date + time '12:00', 'backfill/20260826_migration_log')
       ON CONFLICT (name) DO NOTHING`,
      [name, day]);
    seeded += r.rowCount;
  }

  const { rows: total } = await engPool.query(`SELECT count(*)::int n FROM ${TABLE}`);
  const { rows: cols } = await engPool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [TABLE]);

  console.log(`columns: ${cols.map((c) => c.column_name).join(', ')}`);
  console.log(`backfilled ${seeded} of ${BACKFILL.length} (rest already present)`);
  console.log(`${TABLE} now holds ${total[0].n} rows`);
  console.log(`\nundo with:  node db_migrations/20260826_migration_log.js --revert`);
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
