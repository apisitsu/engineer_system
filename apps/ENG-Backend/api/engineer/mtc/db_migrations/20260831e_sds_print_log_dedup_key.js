'use strict';

/**
 * sds_print_log de-dup, round 2 — a race the 20260830_ time-window guard could not win.
 * ============================================================================
 * `20260830_dedup_sds_print_log.js` cleaned the historical pairs and added a guard
 * to `services/sdsPrintLog.record()`: drop a repeat of the same
 * (cn, machine_type_name, process_code, source, pdf_bytes) inside a 20 s window.
 *
 * NEW pairs kept forming anyway (13 more between 2026-08-27 and 2026-08-31, all
 * `source = 'public'`, 1-2 s apart, identical bytes). The guard is a check-then-act
 * SELECT that ran AFTER ~1-3 s of maqPool + reverse-DNS work inside record(); the
 * deep link's second fetch reached its own SELECT before the first fetch's INSERT
 * had committed, so both passed and both inserted.
 *
 * record() now (a) runs the time-window check FIRST, before the slow lookups, and
 * (b) writes a bucketed `dedup_key` with a PARTIAL UNIQUE index and `ON CONFLICT
 * DO NOTHING` — an atomic backstop the race cannot beat. This migration:
 *   1. removes the pairs the widened (45 s) window now recognises — backed up to
 *      `sds_print_log_dup_backup_20260831` first;
 *   2. adds the `dedup_key` column + `uq_sds_print_log_dedup` partial unique index
 *      (record() self-heals this too, but prod should not depend on lazy DDL).
 *
 * The index is PARTIAL (`WHERE dedup_key IS NOT NULL`) so it builds cleanly while
 * every historical row still has a NULL key.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831e_sds_print_log_dedup_key.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831e_sds_print_log_dedup_key.js
 *   node api/engineer/mtc/db_migrations/20260831e_sds_print_log_dedup_key.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const TABLE = 'sds_print_log';
const BACKUP = 'sds_print_log_dup_backup_20260831';
const WINDOW_S = 45;

// A row is a duplicate when an EARLIER row (lower id) shares the logical key and
// landed < WINDOW_S before it — exactly what record()'s guard now collapses.
const DUP_PREDICATE = `
  FROM ${TABLE} a
  WHERE EXISTS (
    SELECT 1 FROM ${TABLE} b
     WHERE b.id < a.id
       AND b.cn = a.cn
       AND b.machine_type_name = a.machine_type_name
       AND b.process_code IS NOT DISTINCT FROM a.process_code
       AND b.source = a.source
       AND b.pdf_bytes IS NOT DISTINCT FROM a.pdf_bytes
       AND a.printed_at - b.printed_at < interval '${WINDOW_S} seconds'
  )`;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      // Drop the index/column, then restore the rows.
      await client.query(`DROP INDEX IF EXISTS uq_${TABLE}_dedup`);
      await client.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS dedup_key`);
      const has = await client.query(`SELECT to_regclass($1) t`, [BACKUP]);
      if (!has.rows[0].t) {
        console.log(`[dedup-printlog-2] no ${BACKUP} — nothing to restore`);
      } else {
        const r = await client.query(
          `INSERT INTO ${TABLE}
           SELECT * FROM ${BACKUP} WHERE id NOT IN (SELECT id FROM ${TABLE})`);
        await client.query(`DROP TABLE ${BACKUP}`);
        console.log(`[dedup-printlog-2] restored ${r.rowCount} row(s), dropped ${BACKUP}`);
      }
      if (dryRun) { await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      return;
    }

    // 1 — clean the new pairs
    const n = (await client.query(`SELECT count(*)::int n ${DUP_PREDICATE}`)).rows[0].n;
    console.log(`[dedup-printlog-2] ${n} duplicate row(s) to remove (window ${WINDOW_S}s)`);
    if (n > 0) {
      await client.query(`CREATE TABLE IF NOT EXISTS ${BACKUP} AS SELECT a.* ${DUP_PREDICATE} LIMIT 0`);
      await client.query(`INSERT INTO ${BACKUP} SELECT a.* ${DUP_PREDICATE}`);
      const del = await client.query(`DELETE FROM ${TABLE} WHERE id IN (SELECT a.id ${DUP_PREDICATE})`);
      console.log(`[dedup-printlog-2] backed up + deleted ${del.rowCount} row(s) → ${BACKUP}`);
    }

    // 2 — add the atomic backstop
    await client.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS dedup_key TEXT`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_${TABLE}_dedup ON ${TABLE} (dedup_key) WHERE dedup_key IS NOT NULL`);
    console.log('[dedup-printlog-2] dedup_key column + partial unique index in place');

    if (dryRun) { console.log('[dedup-printlog-2] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log('[dedup-printlog-2] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[dedup-printlog-2] FAILED:', e.message); process.exit(1); });
