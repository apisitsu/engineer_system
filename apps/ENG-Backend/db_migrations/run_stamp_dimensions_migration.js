/**
 * PDF Hub — Stamp Dimensions Migration Runner
 * Adds physical width/height (mm) columns to tt_user_stamps.
 *
 * Usage: node db_migrations/run_stamp_dimensions_migration.js
 */
const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    const sqlPath = path.join(__dirname, 'add_stamp_dimensions_migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = await engPool.connect();
    try {
        console.log('🚀 Starting Stamp Dimensions migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Stamp Dimensions migration completed successfully!');
        console.log('   Columns added to tt_user_stamps:');
        console.log('   - stamp_width_mm  (NUMERIC 6,2, default 40.00)');
        console.log('   - stamp_height_mm (NUMERIC 6,2, default 40.00)');
        console.log('   - sig_width_mm    (NUMERIC 6,2, default 50.00)');
        console.log('   - sig_height_mm   (NUMERIC 6,2, default 20.00)');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        console.error(err.stack);
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration();
