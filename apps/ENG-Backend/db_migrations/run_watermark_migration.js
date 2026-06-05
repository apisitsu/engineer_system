const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    try {
        console.log('Starting PDF Watermarks DB migration...');
        const sqlPath = path.join(__dirname, 'pdf_watermarks.sql');
        const sqlQuery = fs.readFileSync(sqlPath, 'utf8');

        await engPool.query(sqlQuery);
        console.log('✅ Migration successful: tt_pdf_watermarks and tt_pdf_watermark_shares tables created.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        engPool.end();
        process.exit();
    }
}

runMigration();
