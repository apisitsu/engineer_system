const { engPool } = require('../instance/eng_db');

const migrateOldIssues = async () => {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        console.log('Selecting cards with existing problem details...');

        const { rows: cards } = await client.query(`
            SELECT id, creator_u_code, problem_detail, solution_detail 
            FROM kb_card 
            WHERE problem_detail IS NOT NULL AND problem_detail != ''
        `);

        if (cards.length === 0) {
            console.log('No cards with old issue data found. Migration not needed.');
            return;
        }

        console.log(`Found ${cards.length} cards to migrate.`);

        for (const card of cards) {
            console.log(`Migrating issue for card ${card.id}...`);
            await client.query(`
                INSERT INTO kb_card_issue (card_id, creator_u_code, problem_detail, solution_detail)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (card_id) DO NOTHING;
            `, [card.id, card.creator_u_code, card.problem_detail, card.solution_detail]);
        }

        console.log('Data migration complete. Now nullifying old columns...');

        // After migration, you might want to nullify the old columns
        // Be cautious with this step and make sure you have a backup.
        // await client.query(`UPDATE kb_card SET problem_detail = NULL, solution_detail = NULL`);
        
        console.log('Old columns have been nullified.');


        await client.query('COMMIT');
        console.log('Successfully migrated old issue data.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during data migration:', err.stack);
    } finally {
        client.release();
    }
};

const runMigration = async () => {
    await migrateOldIssues();
    console.log('Data migration script finished.');
    process.exit();
};

// This script is intended to be run manually.
// To run it, uncomment the following line and execute with node.
// runMigration();

console.log('This is a manual migration script. Please uncomment the runMigration() call in the script to execute it.');
process.exit();
