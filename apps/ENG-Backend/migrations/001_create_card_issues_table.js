const { engPool } = require('../instance/eng_db');

const createCardIssuesTable = async () => {
    const client = await engPool.connect();
    try {
        console.log('Checking for kb_card_issue table...');
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'kb_card_issue'
            );
        `);

        if (res.rows[0].exists) {
            console.log('Table kb_card_issue already exists.');
            return;
        }

        console.log('Creating kb_card_issue table...');
        await client.query(`
            CREATE TABLE kb_card_issue (
                id SERIAL PRIMARY KEY,
                card_id INTEGER NOT NULL REFERENCES kb_card(id) ON DELETE CASCADE,
                creator_u_code VARCHAR(50),
                problem_detail TEXT,
                solution_detail TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // Add index on card_id for faster lookups
        await client.query('CREATE INDEX idx_card_issue_card_id ON kb_card_issue(card_id);');

        // Create a trigger function to update the updated_at column
        await client.query(`
            CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Apply the trigger to the new table
        await client.query(`
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON kb_card_issue
            FOR EACH ROW
            EXECUTE PROCEDURE set_updated_at_timestamp();
        `);

        console.log('Successfully created kb_card_issue table and trigger.');

    } catch (err) {
        console.error('Error during migration:', err.stack);
    } finally {
        client.release();
    }
};

const runMigration = async () => {
    await createCardIssuesTable();
    // In a real scenario, you might want to migrate old data here
    console.log('Migration script finished.');
    // Force exit if the script hangs
    process.exit();
};

runMigration();
