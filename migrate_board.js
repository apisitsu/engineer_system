const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

async function migrate() {
    try {
        await engPool.query(`
            ALTER TABLE kb_board
            ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM',
            ADD COLUMN IF NOT EXISTS start_date TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS due_date TIMESTAMP NULL;
        `);
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await engPool.end();
    }
}

migrate();
