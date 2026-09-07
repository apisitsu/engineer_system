'use strict';

/**
 * `sds_parameter` — fix TSG-300ZNC GRIND CONDITION row 18 label.
 * ------------------------------------------------------------------------------
 * Reported from the floor: a TSG-300 SDS PDF printed the GRIND CONDITION block as
 *   CARRIER AUTO SPEED      1710    rpm
 *   RIGHT G.W. GRIND SPEED  1710    rpm
 *   CARRIER AUTO SPEED      0.5-1.5 rpm
 * — "CARRIER AUTO SPEED" twice, and no "LEFT G.W. GRIND SPEED".
 *
 * Root cause is data, not rendering. The group `TSG-300W/TSG-300ZNC` keeps a SEPARATE
 * `sds_parameter` set per member (deliberately — merging them once destroyed 1,299
 * rows). TSG-300W is correct:
 *   row_18_A = LEFT G.W. GRIND SPEED   row_19_A = RIGHT G.W. GRIND SPEED   row_20_A = CARRIER AUTO SPEED
 * TSG-300ZNC's `row_18_A` was set to `CARRIER AUTO SPEED` — a duplicate of row_20 — so
 * its LEFT G.W. line is missing. The PDF that showed the fault was rendered under
 * `machine_type_name = TSG-300ZNC` (buildValueMap loads params by exact machine name,
 * only the tool whitelist is group-shared); the sheet header still reads "TSG-300W"
 * because B3 maps the group/display name.
 *
 * Confirmed by the system owner: TSG-300ZNC row 18 should be `LEFT G.W. GRIND SPEED`
 * @ 1710 rpm, same as TSG-300W. row_18_H (1710) and row_18_I (rpm) are already right —
 * only the A label changes. TSG-300W's own label carries a stray double space
 * ("LEFT G.W.  GRIND SPEED"); normalised here so both members read identically.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260828b_tsg300znc_grind_row18_label.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260828b_tsg300znc_grind_row18_label.js
 *   node api/engineer/mtc/db_migrations/20260828b_tsg300znc_grind_row18_label.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_parameter';
const BACKUP = 'sds_parameter_backup_20260828b';
const WANT = 'LEFT G.W. GRIND SPEED';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// (machine_type_name, current value) → the rows this migration touches
const TARGETS = [
  { machine: 'TSG-300ZNC', from: 'CARRIER AUTO SPEED' },
  { machine: 'TSG-300W',   from: 'LEFT G.W.  GRIND SPEED' },
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const { rows } = await client.query(`SELECT to_regclass($1) AS t`, [BACKUP]);
      if (!rows[0].t) { console.log(`[revert] no ${BACKUP} — nothing to restore`); await recordRevert({ file: __filename }); return; }
      await client.query('BEGIN');
      await client.query(
        `UPDATE ${TABLE} t SET param_value = b.param_value
           FROM ${BACKUP} b WHERE b.id = t.id AND b.param_value IS DISTINCT FROM t.param_value`);
      await client.query(`DROP TABLE ${BACKUP}`);
      await client.query('COMMIT');
      console.log('[revert] param_value restored from backup; backup dropped');
      await recordRevert({ file: __filename });
      return;
    }

    const { rows: before } = await client.query(
      `SELECT id, machine_type_name, param_key, param_value FROM ${TABLE}
        WHERE param_key = 'row_18_A' AND cn IS NULL
          AND machine_type_name IN ('TSG-300W', 'TSG-300ZNC')
        ORDER BY machine_type_name`);
    console.log('[fix] current row_18_A (cn IS NULL):');
    for (const r of before) console.log(`  ${r.machine_type_name.padEnd(12)} "${r.param_value}"`);

    const toChange = before.filter((r) => r.param_value !== WANT);
    if (!toChange.length) { console.log('[fix] already correct — nothing to do'); await recordRun({ file: __filename }); return; }

    console.log('\n[fix] will set:');
    for (const r of toChange) console.log(`  ${r.machine_type_name.padEnd(12)} "${r.param_value}"  ->  "${WANT}"`);
    if (dryRun) { console.log('\n[fix] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS ${BACKUP}`);
    await client.query(
      `CREATE TABLE ${BACKUP} AS SELECT *, now() AS _backed_up_at FROM ${TABLE}
        WHERE param_key = 'row_18_A' AND cn IS NULL
          AND machine_type_name IN ('TSG-300W', 'TSG-300ZNC')`);
    const { rowCount } = await client.query(
      `UPDATE ${TABLE} SET param_value = $1, updated_at = NOW()
        WHERE param_key = 'row_18_A' AND cn IS NULL
          AND machine_type_name IN ('TSG-300W', 'TSG-300ZNC')
          AND param_value <> $1`, [WANT]);

    const { rows: after } = await client.query(
      `SELECT machine_type_name, param_value FROM ${TABLE}
        WHERE param_key = 'row_18_A' AND cn IS NULL
          AND machine_type_name IN ('TSG-300W', 'TSG-300ZNC') ORDER BY machine_type_name`);
    if (after.some((r) => r.param_value !== WANT)) {
      await client.query('ROLLBACK');
      throw new Error('post-check failed — rolled back');
    }
    await client.query('COMMIT');
    console.log(`\n[fix] ${rowCount} row(s) updated · backup → ${BACKUP}`);
    for (const r of after) console.log(`  ${r.machine_type_name.padEnd(12)} "${r.param_value}"`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[fix] FAILED:', e.message); process.exit(1); });
