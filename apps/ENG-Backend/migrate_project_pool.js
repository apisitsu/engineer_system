const { Pool } = require('pg');

const pool = new Pool({
    host: 'plbmp130',
    port: 6543,
    database: 'eng_system',
    user: 'eng_admin',
    password: 'eng_secret_2026'
});

async function runMigration() {
    try {
        console.log('Connecting to db...');
        // Add priority column
        await pool.query(`
            ALTER TABLE kb_project 
            ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
        `);
        console.log('Added priority column');

        // Add status column
        await pool.query(`
            ALTER TABLE kb_project 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
        `);
        console.log('Added status column');

        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
