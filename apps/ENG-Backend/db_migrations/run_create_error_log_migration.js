const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    try {
        console.log('Starting MTC Formula Error Log DB migration...');
        const sqlPath = path.join(__dirname, '20260613_create_mtc_formula_error_log.sql');
        const sqlQuery = fs.readFileSync(sqlPath, 'utf8');

        await engPool.query(sqlQuery);
        console.log('✅ Migration successful: mtc_formula_error_log table created.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        engPool.end();
        process.exit();
    }
}

runMigration();
