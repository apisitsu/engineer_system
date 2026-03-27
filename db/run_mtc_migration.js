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
    const sqlPath = path.join(__dirname, 'migrations', 'mtc_dynamic_engine.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        console.log('--- DB Config ---');
        console.log('Host:', process.env.PG_NEW_HOST);
        console.log('Port:', process.env.PG_NEW_PORT);
        console.log('DB:', process.env.PG_NEW_DB);
        console.log('User:', process.env.PG_NEW_USER);
        
        console.log('Testing Connection...');
        await engPool.query('SELECT 1');
        console.log('Connection OK!');

        console.log('Running MTC Dynamic Engine Migration...');
        await engPool.query(sql);
        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ CRITICAL ERROR:');
        console.error(err);
    } finally {
        await engPool.end();
    }
};

runMigration();
