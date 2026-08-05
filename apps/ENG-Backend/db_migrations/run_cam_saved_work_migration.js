const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    try {
        console.log('Starting CAD/CAM shared library DB migration...');
        const sqlPath = path.join(__dirname, 'cam_saved_work.sql');
        const sqlQuery = fs.readFileSync(sqlPath, 'utf8');

        await engPool.query(sqlQuery);
        console.log('✅ Migration successful: cam_saved_work table created.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        engPool.end();
        process.exit();
    }
}

runMigration();
