const { Pool } = require('pg');
const { sendUpdateAlert } = require('../api/system/emailService');

const pool = new Pool({
    host: 'plbmp130',
    port: 6543,
    database: 'eng_system',
    user: 'eng_admin',
    password: 'eng_secret_2026'
});

async function logUpdate() {
    const actionType = process.argv[2] || 'UNKNOWN';
    const description = process.argv[3] || '';
    const localHash = process.argv[4] || '';
    const remoteHash = process.argv[5] || '';

    try {
        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_update_logs (
                id SERIAL PRIMARY KEY,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                action_type VARCHAR(50),
                description TEXT,
                local_hash VARCHAR(50),
                remote_hash VARCHAR(50)
            );
        `);

        // Add new columns if they don't exist
        await pool.query('ALTER TABLE system_update_logs ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50);');
        await pool.query('ALTER TABLE system_update_logs ADD COLUMN IF NOT EXISTS commit_message TEXT;');
        await pool.query('ALTER TABLE system_update_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;');

        // Insert log
        await pool.query(
            'INSERT INTO system_update_logs (action_type, description, local_hash, remote_hash) VALUES ($1, $2, $3, $4)',
            [actionType, description, localHash, remoteHash]
        );

        console.log(`[LOG_UPDATE] Success: ${actionType} - ${description}`);

        // Trigger Email Alert on Failure States
        if (['ERROR', 'CRITICAL', 'ROLLBACK_SUCCESS'].includes(actionType)) {
            console.log(`[LOG_UPDATE] Triggering email alert for ${actionType}`);
            await sendUpdateAlert(actionType, {
                previousHash: localHash,
                attemptedHash: remoteHash,
                errorMsg: description,
                body: `System entered state: ${actionType}\nDescription: ${description}`
            });
        }
    } catch (err) {
        console.error('[LOG_UPDATE] Error logging update:', err);
    } finally {
        await pool.end();
    }
}

logUpdate();
