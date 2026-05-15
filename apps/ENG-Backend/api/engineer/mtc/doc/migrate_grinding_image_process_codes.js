'use strict';

/**
 * migrate_grinding_image_process_codes.js
 *
 * Migrates sds_v2_grinding_image:
 *   process_code TEXT  →  process_codes TEXT[]
 *
 * Existing single values are preserved: "IDG001" → ["IDG001"].
 * Rows with process_code IS NULL get process_codes = '{}'.
 *
 * Idempotent — safe to re-run.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/doc/migrate_grinding_image_process_codes.js
 */

const { engPool } = require('../../../../instance/eng_db');

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add new column if missing
    await client.query(`
      ALTER TABLE sds_v2_grinding_image
        ADD COLUMN IF NOT EXISTS process_codes TEXT[] DEFAULT '{}'
    `);
    console.log('Column process_codes ensured');

    // 2. Migrate existing single values
    const upd = await client.query(`
      UPDATE sds_v2_grinding_image
         SET process_codes = ARRAY[process_code]
       WHERE process_code IS NOT NULL
         AND (process_codes IS NULL OR process_codes = '{}')
    `);
    console.log(`Migrated ${upd.rowCount} rows with single process_code`);

    // 3. Drop old column
    await client.query(`
      ALTER TABLE sds_v2_grinding_image
        DROP COLUMN IF EXISTS process_code
    `);
    console.log('Dropped column process_code');

    // 4. GIN index for fast ANY() lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sds_grinding_process_codes
        ON sds_v2_grinding_image USING GIN(process_codes)
    `);
    console.log('GIN index created');

    await client.query('COMMIT');
    console.log('Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
