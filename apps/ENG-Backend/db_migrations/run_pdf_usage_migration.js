const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    try {
        console.log('Starting PDF Usage Log DB migration...');
        const sqlPath = path.join(__dirname, 'pdf_usage_logs.sql');
        const sqlQuery = fs.readFileSync(sqlPath, 'utf8');

        await engPool.query(sqlQuery);
        console.log('✅ Migration successful: tt_pdf_usage_logs table created.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        engPool.end();
        process.exit();
    }
}

runMigration();
