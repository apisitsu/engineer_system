const { Pool } = require('pg');

const pool = new Pool({
    host: 'plbmp130',
    port: 6543,
    database: 'eng_system',
    user: 'eng_admin',
    password: 'eng_secret_2026'
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Connecting to db for performance migration...');
        await client.query('BEGIN');

        // Create db_migrations table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS db_migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const migrationName = '20260421_kanban_performance_indexes';
        const { rows } = await client.query('SELECT id FROM db_migrations WHERE name = $1', [migrationName]);
        
        if (rows.length > 0) {
            console.log(`Migration ${migrationName} already executed. Skipping.`);
            await client.query('COMMIT');
            return;
        }

        console.log(`Executing migration: ${migrationName}`);

        // Add indexes for Kanban Team Workload performance
        console.log('Creating index on kb_card(due_date)...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_card_due_date ON kb_card (due_date);`);

        console.log('Creating index on kb_card_membership(u_code)...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_card_membership_u_code ON kb_card_membership (u_code);`);

        console.log('Creating index on kb_project(is_private)...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_kb_project_is_private ON kb_project (is_private);`);

        // Insert migration record
        await client.query('INSERT INTO db_migrations (name) VALUES ($1)', [migrationName]);

        await client.query('COMMIT');
        console.log('Migration completed successfully');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
