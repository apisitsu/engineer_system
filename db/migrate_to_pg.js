/**
 * migrate_to_pg.js
 * ย้ายข้อมูลจาก SQLite (todo.db + test.db) → PostgreSQL eng_system
 * รัน: node db/migrate_to_pg.js
 */
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../apps/ENG-Backend/instance');

const pg = new Pool({
    host: process.env.PG_NEW_HOST || 'localhost',
    port: parseInt(process.env.PG_NEW_PORT || '6543'),
    database: process.env.PG_NEW_DB || 'eng_system',
    user: process.env.PG_NEW_USER || 'eng_admin',
    password: process.env.PG_NEW_PASS || 'eng_secret_2026',
});

const todoDB = new sqlite3.Database(path.join(BACKEND_DIR, 'todo.db'));
const profileDB = new sqlite3.Database(path.join(BACKEND_DIR, 'test.db'));

// Helper: read all rows from SQLite
const sqliteAll = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

async function migrate() {
    await pg.connect();
    console.log('🔗 Connected to PostgreSQL eng_system\n');

    // ─── 1. users_profile → m_user_profile ──────────────────────────
    console.log('📦 Migrating users_profile...');
    const profiles = await sqliteAll(profileDB, 'SELECT * FROM users_profile');
    for (const p of profiles) {
        await pg.query(`
            INSERT INTO m_user_profile
                (u_code, u_nickname, element, theme, profile_img_b64, description, atk, def, hp, mp)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (u_code) DO UPDATE SET
                u_nickname      = EXCLUDED.u_nickname,
                element         = EXCLUDED.element,
                theme           = EXCLUDED.theme,
                profile_img_b64 = EXCLUDED.profile_img_b64,
                description     = EXCLUDED.description,
                atk = EXCLUDED.atk, def = EXCLUDED.def,
                hp  = EXCLUDED.hp,  mp  = EXCLUDED.mp,
                updated_at = NOW()
        `, [
            p.u_code, p.u_nickname, p.element,
            p.theme || 'lavenderRose', p.profile_img_base64 || null,
            p.description || null,
            p.atk || 0, p.def || 0, p.hp || 0, p.mp || 0
        ]);
    }
    console.log(`   ✅ ${profiles.length} user profiles migrated`);

    // ─── 2. projects → pm_project ────────────────────────────────────
    console.log('📦 Migrating projects...');
    const projects = await sqliteAll(todoDB, 'SELECT * FROM projects');
    // Reset serial to avoid PK conflicts
    if (projects.length > 0) {
        await pg.query(`SELECT setval('pm_project_id_seq', (SELECT COALESCE(MAX(id),0) FROM pm_project) + 1, false)`);
    }
    for (const p of projects) {
        await pg.query(`
            INSERT INTO pm_project
                (id, parent_id, owner_u_code, name, p_type, status, priority,
                 project_group, is_private, due_date, start_date, checked_date,
                 finished_date, create_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (id) DO NOTHING
        `, [
            p.id, p.parent_id || null, p.owner_id, p.name,
            p.p_type || 0, p.status || 1, p.priority || 2,
            p.project_group || null, p.is_private ? true : false,
            p.due_date || null, p.start_date || null,
            p.checked_date || null, p.finished_date || null,
            p.create_date || new Date().toISOString()
        ]);
    }
    // Update sequence after insert by ID
    await pg.query(`SELECT setval('pm_project_id_seq', COALESCE((SELECT MAX(id) FROM pm_project), 1))`);
    console.log(`   ✅ ${projects.length} projects migrated`);

    // ─── 3. project_members → pm_project_member ──────────────────────
    console.log('📦 Migrating project_members...');
    const members = await sqliteAll(todoDB, 'SELECT * FROM project_members');
    for (const m of members) {
        await pg.query(`
            INSERT INTO pm_project_member (project_id, u_code, role, added_date)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (project_id, u_code) DO NOTHING
        `, [m.project_id, m.user_id, m.role || 'member', m.added_date || new Date().toISOString()]);
    }
    console.log(`   ✅ ${members.length} project members migrated`);

    // ─── 4. tasks → pm_task ──────────────────────────────────────────
    console.log('📦 Migrating tasks...');
    const tasks = await sqliteAll(todoDB, 'SELECT * FROM tasks');
    for (const t of tasks) {
        await pg.query(`
            INSERT INTO pm_task
                (id, project_id, assignee_u_code, wait_for_task_id,
                 name, description, memo, problem, solution,
                 task_type, status, priority, position,
                 wait_status_required, due_date, start_date,
                 checked_date, finished_date, create_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
            ON CONFLICT (id) DO NOTHING
        `, [
            t.id, t.project_id, t.assignee_id || null,
            t.wait_for_task_id || null,
            t.name, t.description || null, t.memo || null,
            t.problem || null, t.solution || null,
            t.task_type || 0, t.status || 1, t.priority || 2,
            t.position || 65536, t.wait_status_required || null,
            t.due_date || null, t.start_date || null,
            t.checked_date || null, t.finished_date || null,
            t.create_date || new Date().toISOString()
        ]);
    }
    await pg.query(`SELECT setval('pm_task_id_seq', COALESCE((SELECT MAX(id) FROM pm_task), 1))`);
    console.log(`   ✅ ${tasks.length} tasks migrated`);

    // ─── 5. task_templates → pm_template ────────────────────────────
    console.log('📦 Migrating templates...');
    let templates = [], templateItems = [];
    try {
        templates = await sqliteAll(todoDB, 'SELECT * FROM task_templates');
        for (const t of templates) {
            await pg.query(`
                INSERT INTO pm_template (id, created_by_code, name, description, project_group, created_at)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (id) DO NOTHING
            `, [t.id, t.created_by || null, t.name, t.description || null, t.project_group || null, t.created_at || new Date().toISOString()]);
        }
        await pg.query(`SELECT setval('pm_template_id_seq', COALESCE((SELECT MAX(id) FROM pm_template), 1))`);

        templateItems = await sqliteAll(todoDB, 'SELECT * FROM template_items');
        for (const i of templateItems) {
            await pg.query(`
                INSERT INTO pm_template_item (id, template_id, wait_for_item_id, name, description, position, priority)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                ON CONFLICT (id) DO NOTHING
            `, [i.id, i.template_id, i.wait_for_item_id || null, i.name, i.description || null, i.position || 65536, i.priority || 2]);
        }
        await pg.query(`SELECT setval('pm_template_item_id_seq', COALESCE((SELECT MAX(id) FROM pm_template_item), 1))`);
    } catch (e) {
        console.warn('   ⚠️  Templates table not found in SQLite, skipping:', e.message);
    }
    console.log(`   ✅ ${templates.length} templates, ${templateItems.length} template items migrated`);

    // Done
    await pg.end();
    todoDB.close();
    profileDB.close();
    console.log('\n🎉 Migration Complete! All SQLite data moved to PostgreSQL eng_system\n');
}

migrate().catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
});
