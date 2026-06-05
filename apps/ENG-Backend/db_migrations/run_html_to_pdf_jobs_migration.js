const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    try {
        console.log('Starting HTML-to-PDF jobs table migration...');
        const sqlPath = path.join(__dirname, 'html_to_pdf_jobs.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await engPool.query(sql);

        console.log('✅ Migration successful: newprod_html_to_pdf_jobs table created.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        engPool.end();
        process.exit();
    }
}

runMigration();
