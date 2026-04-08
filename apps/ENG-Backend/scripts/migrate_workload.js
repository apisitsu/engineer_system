const { engPool } = require('../instance/eng_db');

async function migrate() {
    try {
        console.log('Starting migration...');
        await engPool.query(`
            ALTER TABLE kb_card 
            ADD COLUMN IF NOT EXISTS estimated_hours Numeric(5,2) DEFAULT 0;
        `);
        console.log('✅ Success: Add estimated_hours to kb_card');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
