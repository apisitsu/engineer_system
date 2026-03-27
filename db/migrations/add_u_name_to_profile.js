/**
 * add_u_name_to_profile.js
 * - Adds u_name column to m_user_profile in PostgreSQL
 * - Syncs users_profile from SQLite (test.db) to PostgreSQL m_user_profile
 * Run: node db/migrations/add_u_name_to_profile.js
 */
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const pg = new Pool({
    host: 'localhost',
    port: 6543,
    database: 'eng_system',
    user: 'eng_admin',
    password: 'eng_secret_2026',
});

const profileDB = new sqlite3.Database(
    path.join(__dirname, '../../apps/ENG-Backend/instance/test.db')
);

const sqliteAll = (db, sql, params = []) =>
    new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

async function run() {
    console.log('🔗 Connecting to PostgreSQL...');
    await pg.connect();

    // Step 1: Add u_name column (idempotent)
    console.log('📦 Adding u_name column to m_user_profile...');
    await pg.query('ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_name VARCHAR(200)');
    console.log('   ✅ u_name column ready');

    // Step 2: Migrate all users from SQLite -> PostgreSQL
    console.log('📦 Syncing users from test.db...');
    const profiles = await sqliteAll(profileDB, 'SELECT * FROM users_profile');
    let count = 0;
    for (const p of profiles) {
        await pg.query(
            `INSERT INTO m_user_profile
                (u_code, u_name, u_nickname, element, theme, profile_img_b64, description, atk, def, hp, mp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (u_code) DO UPDATE SET
                u_name          = EXCLUDED.u_name,
                u_nickname      = EXCLUDED.u_nickname,
                element         = EXCLUDED.element,
                theme           = EXCLUDED.theme,
                profile_img_b64 = EXCLUDED.profile_img_b64,
                description     = EXCLUDED.description,
                atk = EXCLUDED.atk, def = EXCLUDED.def,
                hp  = EXCLUDED.hp,  mp  = EXCLUDED.mp,
                updated_at = NOW()`,
            [
                p.u_code,
                p.u_name || null,
                p.u_nickname || null,
                p.element || null,
                p.theme || 'lavenderRose',
                p.profile_img_base64 || null,
                p.description || null,
                p.atk || 0,
                p.def || 0,
                p.hp || 0,
                p.mp || 0,
            ]
        );
        count++;
    }
    console.log('   ✅ ' + count + ' user profiles synced');

    // Step 3: Verify
    const { rows } = await pg.query(
        'SELECT u_code, u_name, u_nickname, (profile_img_b64 IS NOT NULL) AS has_img FROM m_user_profile ORDER BY u_code LIMIT 8'
    );
    console.log('\n📋 Sample rows from PostgreSQL m_user_profile:');
    rows.forEach(r =>
        console.log('  ', r.u_code, '|', r.u_name, '|', r.u_nickname, '| img:', r.has_img)
    );

    await pg.end();
    profileDB.close();
    console.log('\n🎉 Migration complete!');
}

run().catch((err) => {
    console.error('💥 Migration failed:', err.message);
    process.exit(1);
});
