const { engPool } = require('../../instance/eng_db');

async function runMigration() {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('Adding parent_id to kb_card...');
        await client.query(`
            ALTER TABLE kb_card 
            ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES kb_card(id) ON DELETE SET NULL;
        `);

        console.log('Adding is_suspended and suspended_reason to kb_card...');
        await client.query(`
            ALTER TABLE kb_card 
            ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
        `);

        await client.query('COMMIT');
        console.log('Migration successful.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration();
