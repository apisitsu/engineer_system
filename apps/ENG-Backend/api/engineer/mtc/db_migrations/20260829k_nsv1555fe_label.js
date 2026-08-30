'use strict';

/**
 * Follow-up to 20260829j_ — one tooling_machine.label row was missed in that pass:
 * NSV-1555FE still carried '治具' (jig). Same rules apply: label is pure display, no
 * join keys change. Idempotent (WHERE label = old literal); --revert swaps back.
 *
 *   node api/engineer/mtc/db_migrations/20260829k_nsv1555fe_label.js [--dry-run|--revert]
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const JP = 'NSV-1555FE (SUGINO tap 治具)';
const EN = 'NSV-1555FE (SUGINO tap jig)';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const from = revert ? EN : JP;
    const to = revert ? JP : EN;
    const r = await client.query(
      `UPDATE tooling_machine SET label = $1 WHERE machine_name = 'NSV-1555FE' AND label = $2`,
      [to, from]);
    console.log(`[lbl2] NSV-1555FE: ${r.rowCount ? `→ ${to}` : '(no match — skip)'}`);
    if (dryRun) { console.log('[lbl2] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[lbl2] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[lbl2] FAILED:', e.message); process.exit(1); });
