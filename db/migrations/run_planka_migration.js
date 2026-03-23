/**
 * Run migration script to apply all Planka feature tables/columns
 * Usage: node db/migrations/run_planka_migration.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.PG_NEW_HOST || 'localhost',
    port: parseInt(process.env.PG_NEW_PORT || '6543'),
    database: process.env.PG_NEW_DB || 'eng_system',
    user: process.env.PG_NEW_USER || 'eng_admin',
    password: process.env.PG_NEW_PASS || 'eng_secret_2026',
});

async function main() {
    const sqlFile = path.join(__dirname, 'planka_features_migration.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('🔄 Running Planka features migration...');
    try {
        const res = await pool.query(sql);
        console.log('✅ Migration completed successfully!');
        // Show result
        if (Array.isArray(res)) {
            const last = res[res.length - 1];
            if (last?.rows?.length) console.log(last.rows[0]);
        } else if (res?.rows?.length) {
            console.log(res.rows[0]);
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error('Detail:', err.detail || '');
        console.error('Position:', err.position || '');
    } finally {
        await pool.end();
    }
}

main();
