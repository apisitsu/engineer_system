const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/ENG-Backend/.env') });
const { Pool } = require('pg');
const fs = require('fs');

const engPool = new Pool({
    host: process.env.PG_NEW_HOST,
    port: parseInt(process.env.PG_NEW_PORT),
    database: process.env.PG_NEW_DB,
    user: process.env.PG_NEW_USER,
    password: process.env.PG_NEW_PASS,
});

const runMigration = async () => {
    // List of migration files to run in order
    const files = [
        'mtc_new_features.sql',
        'tool_request_workflow.sql'
    ];

    try {
        console.log('--- DB Config ---');
        console.log('Host:', process.env.PG_NEW_HOST);
        console.log('Port:', process.env.PG_NEW_PORT);
        console.log('DB:', process.env.PG_NEW_DB);
        
        console.log('\nTesting Connection...');
        await engPool.query('SELECT 1');
        console.log('Connection OK!');

        for (const file of files) {
            console.log(`\nRunning Migration: ${file}...`);
            const sqlPath = path.join(__dirname, 'migrations', file);
            if (!fs.existsSync(sqlPath)) {
                console.warn(`⚠️ Warning: File ${file} not found, skipping.`);
                continue;
            }
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await engPool.query(sql);
            console.log(`✅ ${file} completed successfully!`);
        }

        console.log('\n✨ All migrations completed successfully!');
    } catch (err) {
        console.error('\n❌ CRITICAL ERROR DURING MIGRATION:');
        console.error(err.message);
    } finally {
        await engPool.end();
    }
};

runMigration();
