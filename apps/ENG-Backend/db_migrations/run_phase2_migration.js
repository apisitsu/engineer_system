const { engPool } = require('../instance/eng_db');

async function runMigration() {
  console.log('Running Phase 2 migration: extending mtc_selection_rules...');
  try {
    await engPool.query(`
      ALTER TABLE mtc_selection_rules
        ADD COLUMN IF NOT EXISTS calc_context         TEXT,
        ADD COLUMN IF NOT EXISTS dims                 JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS result_fields        JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS machine_ok_condition TEXT
    `);
    console.log('✅ Columns added successfully.');

    const r = await engPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'mtc_selection_rules'
      ORDER BY ordinal_position
    `);
    console.table(r.rows);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
