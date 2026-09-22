'use strict';
/**
 * Add tr_request.factory — General DWG Request now spans two plants (Fac 4, Fac 11),
 * confirmed live against rodpc.m_workcenter.factory_number (the factory floor's own
 * work-center master — see doc/tooling_select or the 2026-09-22 investigation): 67
 * work centers under factory_number '4', 11 under '11', no code shared between them.
 *
 * Stores the same string rodpc uses ('4' / '11'), not a display label like "Fac 4" -
 * the UI formats that; the raw value is what joins back to rodpc.m_workcenter if that
 * is ever needed, and what a future factory_number ('12', ...) would show up as with
 * no code change.
 *
 * tr_request's existing 30 rows predate this column and cannot be backfilled from
 * anything we hold (work_center on those rows was typed free-text before this system
 * had a real WC picker, e.g. "WC-96" - not a real rodpc code) - they are left NULL
 * rather than guessed.
 *
 * Idempotent (IF NOT EXISTS / IF EXISTS). --revert drops the column.
 * Run: node api/engineer/mtc/db_migrations/20260922b_tr_request_add_factory.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { TABLES } = require('../mtcConstants');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    if (dryRun) { console.log(`[dry-run] would ALTER TABLE ${TABLES.TR_REQUEST} DROP COLUMN IF EXISTS factory`); return; }
    await engPool.query(`ALTER TABLE ${TABLES.TR_REQUEST} DROP COLUMN IF EXISTS factory`);
    console.log('dropped tr_request.factory');
    await recordRevert({ file: __filename });
    return;
  }

  if (dryRun) { console.log(`[dry-run] would ALTER TABLE ${TABLES.TR_REQUEST} ADD COLUMN IF NOT EXISTS factory varchar(10)`); return; }

  await engPool.query(`ALTER TABLE ${TABLES.TR_REQUEST} ADD COLUMN IF NOT EXISTS factory varchar(10)`);
  console.log('added tr_request.factory');
  await recordRun({ file: __filename });
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ failed:', e.message); process.exit(1); });
