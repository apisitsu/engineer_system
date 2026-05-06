const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

async function migrate() {
    try {
        await engPool.query(`
            ALTER TABLE kb_project
            ADD COLUMN IF NOT EXISTS start_date TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS due_date TIMESTAMP NULL;
        `);
        console.log('Project date migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await engPool.end();
    }
}

migrate();
