const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/ENG-Backend/.env') });

// PostgreSQL Connection
const pgPool = new Pool({
    user: process.env.PG_NEW_USER || 'eng_admin',
    host: process.env.PG_NEW_HOST || '127.0.0.1',
    database: process.env.PG_NEW_DB || 'eng_system',
    password: process.env.PG_NEW_PASS || 'eng_secret_2026',
    port: process.env.PG_NEW_PORT || 6543,
});

// Helper: Run pg query
const pgQuery = (text, params) => pgPool.query(text, params);

// SQLite Connections
const testDbPath = path.join(__dirname, '../apps/ENG-Backend/instance/test.db');
const todoDbPath = path.join(__dirname, '../apps/ENG-Backend/instance/todo.db');
const toolReqDbPath = path.join(__dirname, '../apps/ENG-Backend/instance/tool_req.db');

const openSqlite = (dbPath) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
};

const getSqliteData = (db, query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const migrateTable = async (sqliteDb, query, pgQueryText, mapRowFunc, tableName) => {
    console.log(`Starting migration for ${tableName}...`);
    try {
        const rows = await getSqliteData(sqliteDb, query);
        console.log(`Found ${rows.length} rows in SQLite for ${tableName}`);

        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
            try {
                const params = mapRowFunc(row);
                await pgQuery(pgQueryText, params);
                successCount++;
            } catch (err) {
                // Ignore unique constraint violations (already migrated)
                if (err.code !== '23505') {
                    console.error(`Error migrating row in ${tableName}:`, err.message, row);
                    errorCount++;
                }
            }
        }
        console.log(`Finished ${tableName}: ${successCount} successfully migrated, ${errorCount} errors.\n`);
    } catch (err) {
        console.error(`Failed to migrate table ${tableName}:`, err.message);
    }
};

async function runMigration() {
    let testDb, todoDb, toolReqDb;

    try {
        console.log('Opening SQLite databases...');
        testDb = await openSqlite(testDbPath);
        todoDb = await openSqlite(todoDbPath);
        toolReqDb = await openSqlite(toolReqDbPath);
        console.log('All SQLite databases opened successfully.\n');

        // ---------------------------------------------------------
        // 1. M_USER_PROFILE (from test.db users_profile)
        // ---------------------------------------------------------
        await migrateTable(
            testDb,
            'SELECT * FROM users_profile',
            `INSERT INTO m_user_profile (id, u_code, u_nickname, u_name, u_pass, u_department, user_group, role, u_status, u_authority, section, position, element, theme, profile_img_b64, description, atk, def, hp, mp, create_d, update_d)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
             ON CONFLICT (u_code) DO UPDATE SET 
               id = EXCLUDED.id, u_nickname = EXCLUDED.u_nickname, u_name = EXCLUDED.u_name, 
               u_pass = EXCLUDED.u_pass, u_department = EXCLUDED.u_department,
               user_group = EXCLUDED.user_group, role = EXCLUDED.role,
               u_status = EXCLUDED.u_status, u_authority = EXCLUDED.u_authority,
               section = EXCLUDED.section, position = EXCLUDED.position,
               element = EXCLUDED.element, theme = EXCLUDED.theme, 
               profile_img_b64 = EXCLUDED.profile_img_b64, description = EXCLUDED.description,
               atk = EXCLUDED.atk, def = EXCLUDED.def, hp = EXCLUDED.hp, mp = EXCLUDED.mp,
               create_d = EXCLUDED.create_d, update_d = EXCLUDED.update_d`,
            (row) => [
                row.id, row.u_code, row.u_nickname, row.u_name, row.u_pass, row.u_department, row.user_group || row.u_group, row.role || row.u_role,
                row.u_status || 1, row.u_authority || 4, row.section, row.position,
                row.element, row.theme || 'lavenderRose', row.profile_img_base64 || row.profile_img_b64,
                row.description, row.atk || 0, row.def || 0, row.hp || 0, row.mp || 0,
                row.create_d || new Date(), row.update_d || new Date()
            ],
            'm_user_profile'
        );

        // ---------------------------------------------------------
        // 2. PM_PROJECT (from todo.db projects)
        // We handle project tree: parent_id may reference other projects
        // ---------------------------------------------------------
        await migrateTable(
            todoDb,
            'SELECT * FROM projects ORDER BY parent_id NULLS FIRST',
            `INSERT INTO pm_project (id, parent_id, owner_u_code, name, p_type, status, priority, project_group, is_private, due_date, start_date, checked_date, finished_date, create_date, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO UPDATE SET
               parent_id = EXCLUDED.parent_id, name = EXCLUDED.name, p_type = EXCLUDED.p_type,
               status = EXCLUDED.status, priority = EXCLUDED.priority, project_group = EXCLUDED.project_group,
               is_private = EXCLUDED.is_private, due_date = EXCLUDED.due_date, start_date = EXCLUDED.start_date,
               checked_date = EXCLUDED.checked_date, finished_date = EXCLUDED.finished_date, updated_at = EXCLUDED.updated_at`,
            (row) => [
                row.id, row.parent_id, row.owner_id, row.name, row.type || 0, row.status || 1,
                row.priority || 2, row.project_group, row.is_private ? true : false,
                row.due_date, row.start_date, row.checked_date, row.finished_date,
                row.create_date, row.updated_at || row.create_date
            ],
            'pm_project'
        );
        // Sync sequence
        await pgQuery(`SELECT setval('pm_project_id_seq', COALESCE((SELECT MAX(id) FROM pm_project), 1))`);

        // ---------------------------------------------------------
        // 3. PM_PROJECT_MEMBER (from todo.db project_members)
        // ---------------------------------------------------------
        await migrateTable(
            todoDb,
            'SELECT * FROM project_members',
            `INSERT INTO pm_project_member (project_id, u_code, role, added_date)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (project_id, u_code) DO NOTHING`,
            (row) => [row.project_id, row.u_code || row.user_id, row.role || 'member', row.added_date],
            'pm_project_member'
        );

        // ---------------------------------------------------------
        // 4. PM_TASK (from todo.db tasks)
        // ---------------------------------------------------------
        await migrateTable(
            todoDb,
            'SELECT * FROM tasks',
            `INSERT INTO pm_task (id, project_id, assignee_u_code, wait_for_task_id, name, description, memo, problem, solution, task_type, status, priority, wait_status_required, due_date, start_date, checked_date, finished_date, create_date, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (id) DO UPDATE SET
               assignee_u_code = EXCLUDED.assignee_u_code, wait_for_task_id = EXCLUDED.wait_for_task_id,
               name = EXCLUDED.name, description = EXCLUDED.description, memo = EXCLUDED.memo,
               problem = EXCLUDED.problem, solution = EXCLUDED.solution, task_type = EXCLUDED.task_type,
               status = EXCLUDED.status, priority = EXCLUDED.priority, wait_status_required = EXCLUDED.wait_status_required,
               due_date = EXCLUDED.due_date, start_date = EXCLUDED.start_date, checked_date = EXCLUDED.checked_date,
               finished_date = EXCLUDED.finished_date, updated_at = EXCLUDED.updated_at`,
            (row) => [
                row.id, row.project_id, row.assignee_id, row.wait_for_task_id, row.name, row.description,
                row.memo, row.problem, row.solution, row.type || 0, row.status || 1, row.priority || 2,
                row.wait_status_required, row.due_date, row.start_date, row.checked_date,
                row.finished_date, row.create_date, row.updated_at || row.create_date
            ],
            'pm_task'
        );
        await pgQuery(`SELECT setval('pm_task_id_seq', COALESCE((SELECT MAX(id) FROM pm_task), 1))`);


        // ---------------------------------------------------------
        // 5. PM_TEMPLATE & PM_TEMPLATE_ITEM (from todo.db task_templates, template_items)
        // ---------------------------------------------------------
        await migrateTable(
            todoDb,
            'SELECT * FROM task_templates',
            `INSERT INTO pm_template (id, created_by_code, name, description, project_group, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, description = EXCLUDED.description, project_group = EXCLUDED.project_group`,
            (row) => [row.id, row.created_by, row.name, row.description, row.project_group, row.created_at],
            'pm_template'
        );
        await pgQuery(`SELECT setval('pm_template_id_seq', COALESCE((SELECT MAX(id) FROM pm_template), 1))`);

        // Check if template_items table exists
        const hasTemplateItems = await getSqliteData(todoDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='template_items'");
        if (hasTemplateItems.length > 0) {
            await migrateTable(
                todoDb,
                'SELECT * FROM template_items',
                `INSERT INTO pm_template_item (id, template_id, wait_for_item_id, name, description, priority)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET
                   wait_for_item_id = EXCLUDED.wait_for_item_id, name = EXCLUDED.name, 
                   description = EXCLUDED.description, priority = EXCLUDED.priority`,
                (row) => [row.id, row.template_id, row.wait_for_item_id, row.name, row.description, row.priority || 2],
                'pm_template_item'
            );
            await pgQuery(`SELECT setval('pm_template_item_id_seq', COALESCE((SELECT MAX(id) FROM pm_template_item), 1))`);
        }

        // ---------------------------------------------------------
        //   REST OF MIGRATIONS
        // ---------------------------------------------------------

        // 6. ecr_requests
        const hasEcr = await getSqliteData(testDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='ecr_requests'");
        if (hasEcr.length > 0) {
            await migrateTable(
                testDb, 'SELECT * FROM ecr_requests',
                `INSERT INTO ecr_request (id, ecr_no, request_date, req_by, department, detail, reason, effect_to, part_no, part_name, model, file_path, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
                (row) => [row.id, row.ecr_no, row.req_date, row.req_by, row.department, row.detail, row.reason, row.effect_to, row.part_no, row.part_name, row.model, row.file_path, row.status, row.created_at],
                'ecr_request'
            );
            await pgQuery(`SELECT setval('ecr_request_id_seq', COALESCE((SELECT MAX(id) FROM ecr_request), 1))`);
        }

        // 7. tool_requests & tool_request_workflow
        const hasToolReq = await getSqliteData(toolReqDb, "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_requests'");
        if (hasToolReq.length > 0) {
            await migrateTable(
                toolReqDb, 'SELECT * FROM tool_requests',
                `INSERT INTO tr_request (id, req_no, req_date, req_by, department, title, detail, purpose, qty, unit, expected_date, file_path, status, priority, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
                (row) => [
                    row.id,
                    row.request_no || 'T-REQ-' + row.id,
                    row.created_at || row.req_date,
                    row.requester || row.req_by || '',
                    row.department,
                    row.title,
                    row.detail,
                    row.category || row.purpose,
                    row.qty || 1,
                    row.unit || 'pcs',
                    row.req_due_date || row.expected_date,
                    row.file_path,
                    row.status,
                    row.priority || 'Normal',
                    row.created_at
                ],
                'tr_request'
            );
            await pgQuery(`SELECT setval('tr_request_id_seq', COALESCE((SELECT MAX(id) FROM tr_request), 1))`);

            await migrateTable(
                toolReqDb, 'SELECT * FROM tool_request_workflow',
                `INSERT INTO tr_workflow (id, req_id, step_no, action_by, action_date, action_type, comment, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
                (row) => [row.id, row.req_id, row.step_no, row.action_by, row.action_date, row.action_type, row.comment, row.status],
                'tr_workflow'
            );
            await pgQuery(`SELECT setval('tr_workflow_id_seq', COALESCE((SELECT MAX(id) FROM tr_workflow), 1))`);
        }

        // 8. Tooling tables (ti_list, ti_dwg_job, ti_return, wc_code, holidays_date)
        const checkAndMigrate = async (tableName, insertSql, mapFn) => {
            const hasTable = await getSqliteData(testDb, `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
            if (hasTable.length > 0) {
                await migrateTable(testDb, `SELECT * FROM ${tableName}`, insertSql, mapFn, tableName);
                await pgQuery(`SELECT setval('${tableName}_id_seq', COALESCE((SELECT MAX(id) FROM ${tableName}), 1))`);
            }
        };

        await checkAndMigrate('ti_list',
            `INSERT INTO ti_list(id, part_number, tool_number, inspect_date, inspector, result, remark, created_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT(id) DO NOTHING`,
            (r) => [r.id, r.part_number, r.tool_number, r.inspect_date, r.inspector, r.result, r.remark, r.created_at]
        );

        await checkAndMigrate('ti_dwg_job',
            `INSERT INTO ti_dwg_job (id, req_no, req_date, req_by, tool_number, reason, status, file_path, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
            (r) => [r.id, r.req_no || r.request_no || 'DRQ-' + r.id, r.req_date || r.created_at, r.req_by || r.requester || '', r.tool_number, r.reason, r.status, r.file_path, r.created_at]
        );

        await checkAndMigrate('ti_return',
            `INSERT INTO ti_return (id, return_no, part_number, tool_number, qty, return_by, return_date, reason, condition, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
            (r) => [r.id, r.return_no || 'RTN-' + r.id, r.part_number || '', r.tool_number, r.qty || 1, r.return_by || '', r.return_date || r.date_return || r.created_at, r.reason, r.condition, r.created_at]
        );

        await checkAndMigrate('wc_code',
            `INSERT INTO wc_code (id, code, description, is_active, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`,
            (r) => [r.id, r.code || r.wc_code || 'WC-' + r.id, r.description || r.wc_name || '', r.is_active === 1 || r.is_active === true, r.created_at]
        );

        await checkAndMigrate('holidays_date',
            `INSERT INTO holidays_date(id, holiday_date, description, is_workday, created_at) VALUES($1, $2, $3, $4, $5) ON CONFLICT(holiday_date) DO NOTHING`,
            (r) => [r.id, r.holidays_date || r.holiday_date, r.description, r.is_workday === 1 || r.is_workday === true, r.created_at]
        );

        console.log('Migration completed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (testDb) testDb.close();
        if (todoDb) todoDb.close();
        if (toolReqDb) toolReqDb.close();
        pgPool.end();
    }
}

runMigration();

