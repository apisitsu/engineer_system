/**
 * Template Tool - Database Migration Runner
 * Executes template_tool_tables.sql against eng_system database.
 * 
 * Usage: node db_migrations/run_template_tool_migration.js
 */
const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    const sqlPath = path.join(__dirname, 'template_tool_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = await engPool.connect();
    try {
        console.log('🚀 Starting Template Tool migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Template Tool migration completed successfully!');
        console.log('   Tables created:');
        console.log('   - tt_form_headers');
        console.log('   - tt_control_plan_rows');
        console.log('   - tt_pfd_rows');
        console.log('   - tt_pfmea_rows');
        console.log('   - tt_pdr_rows');
        console.log('   - tt_pid_form_data');
        console.log('   - tt_form_audit_trail');
        console.log('   - tt_user_stamps');
        console.log('   - tt_calc_usage_log');
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
