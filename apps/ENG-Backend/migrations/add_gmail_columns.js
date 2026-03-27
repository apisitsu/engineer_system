/**
 * Migration: Add Gmail OAuth columns to m_user_profile
 * Adds gmail_email (VARCHAR 255) and gmail_refresh_token (TEXT)
 * 
 * Run: node migrations/add_gmail_columns.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PG_NEW_HOST,
    port: parseInt(process.env.PG_NEW_PORT),
    database: process.env.PG_NEW_DB,
    user: process.env.PG_NEW_USER,
    password: process.env.PG_NEW_PASS,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting Gmail columns migration...');

        // Add gmail_email column
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'm_user_profile' AND column_name = 'gmail_email'
                ) THEN
                    ALTER TABLE m_user_profile ADD COLUMN gmail_email VARCHAR(255) DEFAULT NULL;
                    RAISE NOTICE 'Column gmail_email added.';
                ELSE
                    RAISE NOTICE 'Column gmail_email already exists.';
                END IF;
            END $$;
        `);
        console.log('✅ gmail_email column ready.');

        // Add gmail_refresh_token column
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'm_user_profile' AND column_name = 'gmail_refresh_token'
                ) THEN
                    ALTER TABLE m_user_profile ADD COLUMN gmail_refresh_token TEXT DEFAULT NULL;
                    RAISE NOTICE 'Column gmail_refresh_token added.';
                ELSE
                    RAISE NOTICE 'Column gmail_refresh_token already exists.';
                END IF;
            END $$;
        `);
        console.log('✅ gmail_refresh_token column ready.');

        // Verify
        const { rows } = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'm_user_profile' 
              AND column_name IN ('gmail_email', 'gmail_refresh_token')
            ORDER BY column_name;
        `);
        console.log('📋 Verified columns:', rows);
        console.log('🎉 Migration complete!');

    } catch (err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
