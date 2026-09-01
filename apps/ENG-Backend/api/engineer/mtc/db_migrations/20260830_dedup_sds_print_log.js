'use strict';

/**
 * Remove the duplicate `sds_print_log` rows a deep-link re-fetch left behind.
 * ============================================================================
 * `GET /api/public/sds/pdf` served the PDF inline with `Cache-Control: no-store`,
 * and Chrome's inline PDF viewer fetches such a URL twice — so every public print
 * was logged twice, ~1.5 s apart: identical cn / machine / process / lot / bytes /
 * tooling_snapshot, only `pdf_sha256` differing because each render's bytes carry a
 * fresh timestamp. 20 pairs (one a group of 4) between 2026-08-14 and 2026-08-29;
 * `source = 'app'` rows are unaffected (that path is an XHR, fired once).
 *
 * `services/sdsPrintLog.record()` now drops a repeat of the same
 * (cn, machine_type_name, process_code, source, pdf_bytes) inside a 20 s window,
 * so no new pairs form. This clears the existing ones, keeping the EARLIEST of each
 * near-duplicate run (the first render) — the same row the guard would have kept.
 *
 * Deleted rows are copied to `sds_print_log_dup_backup_20260830` first; `--revert`
 * re-inserts them and drops the backup. Idempotent — a second run finds no pairs.
 *
 * A genuine reprint of one sheet inside 20 s at the same byte length would also be
 * collapsed here; on an evidentiary log that trade is why the backup exists.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260830_dedup_sds_print_log.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260830_dedup_sds_print_log.js
 *   node api/engineer/mtc/db_migrations/20260830_dedup_sds_print_log.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const BACKUP = 'sds_print_log_dup_backup_20260830';

// A row is a duplicate when an EARLIER row (lower id) shares the logical key and
// landed < 20 s before it — exactly what record()'s new guard collapses.
const DUP_PREDICATE = `
  FROM ${'sds_print_log'} a
  WHERE EXISTS (
    SELECT 1 FROM ${'sds_print_log'} b
     WHERE b.id < a.id
       AND b.cn = a.cn
       AND b.machine_type_name = a.machine_type_name
       AND b.process_code IS NOT DISTINCT FROM a.process_code
       AND b.source = a.source
       AND b.pdf_bytes IS NOT DISTINCT FROM a.pdf_bytes
       AND a.printed_at - b.printed_at < interval '20 seconds'
  )`;

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      const has = await client.query(`SELECT to_regclass($1) t`, [BACKUP]);
      if (!has.rows[0].t) {
        console.log(`[dedup-printlog] no ${BACKUP} — nothing to restore`);
      } else {
        const r = await client.query(
          `INSERT INTO sds_print_log
           SELECT * FROM ${BACKUP}
           WHERE id NOT IN (SELECT id FROM sds_print_log)`);
        await client.query(`DROP TABLE ${BACKUP}`);
        console.log(`[dedup-printlog] restored ${r.rowCount} row(s), dropped ${BACKUP}`);
      }
      if (dryRun) { await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      return;
    }

    const dupCount = await client.query(`SELECT count(*)::int n ${DUP_PREDICATE}`);
    const n = dupCount.rows[0].n;
    console.log(`[dedup-printlog] ${n} duplicate row(s) to remove`);
    if (n === 0) {
      if (!dryRun) { await client.query('COMMIT'); await recordRun({ file: __filename }); }
      else await client.query('ROLLBACK');
      return;
    }

    await client.query(`CREATE TABLE ${BACKUP} AS SELECT a.* ${DUP_PREDICATE}`);
    const del = await client.query(`
      DELETE FROM sds_print_log
       WHERE id IN (SELECT a.id ${DUP_PREDICATE})`);
    console.log(`[dedup-printlog] backed up + deleted ${del.rowCount} row(s) → ${BACKUP}`);

    if (dryRun) { console.log('[dedup-printlog] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log('[dedup-printlog] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[dedup-printlog] FAILED:', e.message); process.exit(1); });
