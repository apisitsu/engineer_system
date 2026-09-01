'use strict';

/**
 * Phase 1 — create + seed `cn_kubun`, the RE21000H §4-3(2) work-type decode.
 * ============================================================================
 * READ-ONLY reference. Nothing's behaviour changes when this runs: the table is
 * for report JOINs and documentation. The live decode used on the search path is
 * the in-memory copy in `api/engineer/mtc/utils/cnKubun.js` (no I/O); this
 * migration seeds the SAME rows from that module so there is one source of truth,
 * and `tests/mtc/cnKubun.test.js` pins the table to it.
 *
 * Idempotent — DELETE + re-INSERT every row. `--revert` drops the table.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260830b_create_cn_kubun.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260830b_create_cn_kubun.js
 *   node api/engineer/mtc/db_migrations/20260830b_create_cn_kubun.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { KUBUN } = require('../utils/cnKubun');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      await client.query(`DROP TABLE IF EXISTS cn_kubun`);
      console.log('[cn_kubun] dropped');
      if (dryRun) { await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS cn_kubun (
        kubun           char(2) PRIMARY KEY,
        part_family     text NOT NULL,
        material_class  text,
        lube_type       text,
        unit_system     text,
        thread_side     text,
        assembly        text,
        shape           text,
        needs_grind_sds boolean NOT NULL,
        description     text,
        source          text NOT NULL DEFAULT 'RE21000H rev H §4-3(2)'
      )`);
    await client.query(
      `COMMENT ON TABLE cn_kubun IS 'RE21000H §4-3(2) CONTROL NUMBER 区分一覧 — work-type decode. Mirrors api/engineer/mtc/utils/cnKubun.js (the live copy). Read-only reference.'`);

    const codes = Object.keys(KUBUN).sort();
    await client.query(`DELETE FROM cn_kubun WHERE kubun = ANY($1::char(2)[])`, [codes]);

    const norm = (v) => (v === '-' || v === undefined ? null : v);
    for (const code of codes) {
      const k = KUBUN[code];
      await client.query(
        `INSERT INTO cn_kubun
           (kubun, part_family, material_class, lube_type, unit_system, thread_side, assembly, shape, needs_grind_sds, description)
         VALUES ($1::char(2),$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [code, k.family, norm(k.material), norm(k.lube), norm(k.unit), norm(k.thread), norm(k.assembly), norm(k.shape), k.needsGrindSds, k.desc]);
    }
    console.log(`[cn_kubun] seeded ${codes.length} rows (${codes.filter((c) => !KUBUN[c].needsGrindSds).length} non-grind)`);

    if (dryRun) { console.log('[cn_kubun] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log('[cn_kubun] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[cn_kubun] FAILED:', e.message); process.exit(1); });
