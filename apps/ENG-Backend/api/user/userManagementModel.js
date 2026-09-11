const { engPool } = require('../../instance/eng_db');
const { pool } = require('../../instance/instance');
const format = require('pg-format');
const bcrypt = require('bcryptjs');

// Blacklist of core columns that cannot be dropped or altered in type
const BLACKLISTED_COLUMNS = [
    'u_code', 'u_name', 'u_pass', 'u_role', 'u_group',
    'u_authority', 'created_at', 'updated_at', 'id',
    'u_nickname', 'profile_img_b64', 'theme', 'element', 'section'
];

// Verify if the table system_logs exists, if not create it with enhanced audit columns
const initAuditTable = async () => {
    try {
        await engPool.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE system_logs 
            ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS category VARCHAR(50),
            ADD COLUMN IF NOT EXISTS target_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS target_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS old_data JSONB,
            ADD COLUMN IF NOT EXISTS new_data JSONB,
            ADD COLUMN IF NOT EXISTS changes JSONB,
            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);

            CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_system_logs_target_id ON system_logs (target_id);
            CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs (category);
            CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs (user_id);
        `);
    } catch (err) {
        console.error("Error creating/upgrading system_logs table:", err);
    }
};

initAuditTable();

// Standardized Actor Resolver from Express Request
const getActorInfo = (req) => {
    const userId = req.user?.empno || req.user?.id || req.body?.updated_by || req.headers['x-user-id'] || 'SYSTEM';
    const actorName = req.user?.name || req.user?.u_name || req.body?.actor_name || null;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    return { userId, actorName, ipAddress };
};

// Flexible, Backward-Compatible Audit Logger
const logAction = async (arg1, arg2, arg3, options = {}) => {
    try {
        let payload = {};
        if (typeof arg1 === 'object' && arg1 !== null && !arg2) {
            payload = arg1;
        } else {
            payload = {
                userId: arg1,
                action: arg2,
                details: arg3,
                ...options
            };
        }

        const {
            userId = 'SYSTEM',
            actorName = null,
            action = 'UNKNOWN_ACTION',
            category = 'GENERAL',
            targetId = null,
            targetName = null,
            details = '',
            oldData = null,
            newData = null,
            changes = null,
            ipAddress = null
        } = payload;

        await engPool.query(`
            INSERT INTO system_logs (
                user_id, actor_name, action, category, 
                target_id, target_name, details, 
                old_data, new_data, changes, ip_address, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        `, [
            userId,
            actorName,
            action,
            category,
            targetId,
            targetName,
            details,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            changes ? JSON.stringify(changes) : null,
            ipAddress
        ]);
    } catch (err) {
        console.error("Audit log failed:", err);
    }
};

// 1. Get Schema of m_user_profile
const getSchema = async (req, res) => {
    try {
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'm_user_profile'
            ORDER BY ordinal_position;
        `;
        const result = await engPool.query(query);
        res.json({ result: 'true', data: result.rows });
    } catch (error) {
        console.error("Error getting schema:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 2. Add New Column
const addColumn = async (req, res) => {
    const { columnName, dataType, defaultValue } = req.body;
    const userId = req.user?.id || 'System';

    // Regex Validation for column name (only alphanumeric and underscores, must start with letter)
    const isValidName = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName);
    if (!isValidName) {
        return res.status(400).json({ result: 'false', message: 'Invalid column name format.' });
    }

    if (!dataType || !defaultValue) {
        return res.status(400).json({ result: 'false', message: 'Data type and default value are required.' });
    }

    // Map allowed types to prevent injection
    const allowedTypes = {
        'VARCHAR(255)': 'VARCHAR(255)',
        'NUMERIC': 'NUMERIC',
        'BOOLEAN': 'BOOLEAN',
        'TIMESTAMP': 'TIMESTAMP' // We can let user pick date and map it to timestamp
    };

    const sqlDataType = allowedTypes[dataType];
    if (!sqlDataType) {
        return res.status(400).json({ result: 'false', message: 'Invalid data type.' });
    }

    try {
        const alterQuery = format('ALTER TABLE m_user_profile ADD COLUMN %I %s DEFAULT %L', columnName, sqlDataType, defaultValue);
        await engPool.query(alterQuery);

        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        await logAction({
            userId: actorId,
            actorName,
            action: 'SCHEMA_ADD_COLUMN',
            category: 'DATABASE_SCHEMA',
            targetId: columnName,
            targetName: `Column: ${columnName}`,
            details: `Added new column "${columnName}" (${sqlDataType}) with default value "${defaultValue}" to m_user_profile`,
            newData: { columnName, dataType: sqlDataType, defaultValue },
            ipAddress
        });

        res.json({ result: 'true', message: `Column ${columnName} added successfully.` });
    } catch (error) {
        console.error("Error adding column:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 3. Delete Column
const dropColumn = async (req, res) => {
    const { columnName } = req.body;

    if (BLACKLISTED_COLUMNS.includes(columnName)) {
        return res.status(403).json({ result: 'false', message: `Cannot drop blacklisted column: ${columnName}` });
    }

    try {
        const alterQuery = format('ALTER TABLE m_user_profile DROP COLUMN %I', columnName);
        await engPool.query(alterQuery);

        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        await logAction({
            userId: actorId,
            actorName,
            action: 'SCHEMA_DROP_COLUMN',
            category: 'DATABASE_SCHEMA',
            targetId: columnName,
            targetName: `Column: ${columnName}`,
            details: `Dropped column "${columnName}" from m_user_profile`,
            oldData: { columnName },
            ipAddress
        });

        res.json({ result: 'true', message: `Column ${columnName} dropped successfully.` });
    } catch (error) {
        console.error("Error dropping column:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 4. Get all users with server-side global search, filtering, and sorting
const getUsers = async (req, res) => {
    try {
        const { search = '', sortField = 'u_code', sortOrder = 'asc', page = 1, pageSize = 50 } = req.query;

        // Get Schema to build global search
        const schemaQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'm_user_profile';`;
        const schemaResult = await engPool.query(schemaQuery);
        const textColumns = schemaResult.rows
            .filter(col => ['character varying', 'text', 'varchar'].includes(col.data_type.toLowerCase()))
            .map(col => col.column_name);

        let whereClauses = [];
        let params = [];
        let paramIndex = 1;

        if (search && textColumns.length > 0) {
            const searchClauses = textColumns.map(col => `${format('%I', col)} ILIKE $${paramIndex}`);
            whereClauses.push(`(${searchClauses.join(' OR ')})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const orderString = format('ORDER BY %I %s', sortField, sortOrder === 'desc' ? 'DESC' : 'ASC'); // pg-format handling sort safely
        let limitString = '';
        if (pageSize !== 'all' && Number(pageSize) < 1000) {
            limitString = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
        }

        const dataQuery = `
            SELECT 
                u.*,
                s.mc_setup, s.inspection, s.mc_operation,
                s.public_std, s.cust_specification, s.internal_document,
                s.cad, s.programming, s.microsoft,
                s.detail_oriented, s.critical_thinking, s.process_comprehension,
                s.time_management, s.collaboration, s.leadership,
                s.qualifications,
                s.leader_skills,
                s.evaluation_type,
                s.evaluation_details,
                s.evaluation_history
            FROM m_user_profile u
            LEFT JOIN m_user_skills s ON u.u_code = s.u_code
            ${whereString ? whereString.replace(/\b([a-z_]+)\b(?= ILIKE)/g, 'u.$1') : ''} 
            ${orderString ? orderString.replace(/ORDER BY ([a-z_]+)/g, 'ORDER BY u.$1') : ''} 
            ${limitString}
        `;
        const countQuery = `SELECT COUNT(*) FROM m_user_profile u ${whereString ? whereString.replace(/\b([a-z_]+)\b(?= ILIKE)/g, 'u.$1') : ''}`;

        const countParams = limitString ? params.slice(0, params.length - 2) : params;
        const [dataResult, countResult] = await Promise.all([
            engPool.query(dataQuery, params),
            engPool.query(countQuery, countParams)
        ]);

        res.json({
            result: 'true',
            data: dataResult.rows,
            total: parseInt(countResult.rows[0].count, 10),
            page: parseInt(page, 10),
            pageSize: pageSize === 'all' ? dataResult.rows.length : parseInt(pageSize, 10)
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 5. Create user record
const createUser = async (req, res) => {
    try {
        const record = { ...req.body };

        // Hash password if provided
        if (record.u_pass) {
            record.u_pass = await bcrypt.hash(record.u_pass, 10);
        }

        const columns = Object.keys(record);
        if (columns.length === 0) return res.status(400).json({ result: 'false', message: 'No data provided.' });

        const values = Object.values(record);

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const colString = columns.map(c => format('%I', c)).join(', ');

        const insertQuery = `INSERT INTO m_user_profile (${colString}) VALUES (${placeholders}) RETURNING *`;

        const result = await engPool.query(insertQuery, values);
        const createdUser = result.rows[0];

        // Audit Log
        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        const safeRecord = { ...createdUser, u_pass: '[PROTECTED]' };
        await logAction({
            userId: actorId,
            actorName,
            action: 'USER_CREATE',
            category: 'USER_PROFILE',
            targetId: createdUser.u_code,
            targetName: createdUser.u_name,
            details: `Registered new user ${createdUser.u_code} (${createdUser.u_name || ''}) - Role: ${createdUser.role || '-'}, Dept: ${createdUser.u_department || '-'}`,
            newData: safeRecord,
            ipAddress
        });

        res.json({ result: 'true', data: createdUser, message: 'User created' });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 6. Update user record with field-by-field diff tracking
const updateUser = async (req, res) => {
    try {
        const { u_code } = req.params;
        const record = { ...req.body };

        // Retrieve existing state before update for diff calculation
        const oldRes = await engPool.query('SELECT * FROM m_user_profile WHERE u_code = $1', [u_code]);
        if (oldRes.rowCount === 0) return res.status(404).json({ result: 'false', message: 'User not found.' });
        const oldUser = oldRes.rows[0];

        // Hash password if explicitly provided in update payload
        if (record.u_pass) {
            record.u_pass = await bcrypt.hash(record.u_pass, 10);
        }

        // Remove undefined or null
        const columns = Object.keys(record).filter(key => key !== 'u_code');
        if (columns.length === 0) return res.status(400).json({ result: 'false', message: 'No data to update.' });

        const setString = columns.map((c, i) => `${format('%I', c)} = $${i + 1}`).join(', ');
        const values = columns.map(c => record[c]);
        values.push(u_code);

        const updateQuery = `UPDATE m_user_profile SET ${setString} WHERE u_code = $${values.length} RETURNING *`;
        const result = await engPool.query(updateQuery, values);
        const updatedUser = result.rows[0];

        // Compute exact field-by-field diff
        const changes = {};
        const changeSummaries = [];
        for (const key of columns) {
            if (key === 'u_pass') {
                changes['u_pass'] = { old: '[PROTECTED]', new: '[UPDATED]' };
                changeSummaries.push('Password updated');
                continue;
            }
            const oldVal = oldUser[key];
            const newVal = record[key];
            if (String(oldVal ?? '') !== String(newVal ?? '')) {
                changes[key] = {
                    old: oldVal ?? null,
                    new: newVal ?? null
                };
                changeSummaries.push(`${key}: "${oldVal ?? '—'}" ➔ "${newVal ?? '—'}"`);
            }
        }

        // Audit Log if any fields changed
        if (Object.keys(changes).length > 0) {
            const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
            const safeOld = { ...oldUser, u_pass: '[PROTECTED]' };
            const safeNew = { ...updatedUser, u_pass: '[PROTECTED]' };

            await logAction({
                userId: actorId,
                actorName,
                action: 'USER_UPDATE',
                category: 'USER_PROFILE',
                targetId: u_code,
                targetName: updatedUser.u_name,
                details: `Updated user ${u_code} (${updatedUser.u_name}): ${changeSummaries.join(', ')}`,
                oldData: safeOld,
                newData: safeNew,
                changes,
                ipAddress
            });
        }

        res.json({ result: 'true', data: updatedUser, message: 'User updated' });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 7. Delete user record
const deleteUserRecord = async (req, res) => {
    try {
        const { u_code } = req.params;

        // Retrieve existing user before deleting for historical archive
        const oldRes = await engPool.query('SELECT * FROM m_user_profile WHERE u_code = $1', [u_code]);
        if (oldRes.rowCount === 0) return res.status(404).json({ result: 'false', message: 'User not found.' });
        const oldUser = oldRes.rows[0];

        const deleteQuery = `DELETE FROM m_user_profile WHERE u_code = $1 RETURNING *`;
        await engPool.query(deleteQuery, [u_code]);

        // Audit Log
        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        const safeOld = { ...oldUser, u_pass: '[PROTECTED]' };
        await logAction({
            userId: actorId,
            actorName,
            action: 'USER_DELETE',
            category: 'USER_PROFILE',
            targetId: u_code,
            targetName: oldUser.u_name,
            details: `Deleted user ${u_code} (${oldUser.u_name || ''}) from department ${oldUser.u_department || '-'}`,
            oldData: safeOld,
            ipAddress
        });

        res.json({ result: 'true', message: 'User deleted successfully' });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 8. Search / Get users from External Factory Database (RODPC `m_user`)
const searchExternalUsers = async (req, res) => {
    try {
        const { search = '', limit = 30 } = req.query;
        let query = `
            SELECT u_code, u_name, u_authority, u_role, u_status
            FROM m_user
        `;
        const params = [];
        if (search && search.trim()) {
            query += ` WHERE u_code ILIKE $1 OR u_name ILIKE $1`;
            params.push(`%${search.trim()}%`);
            query += ` ORDER BY u_code ASC LIMIT $2`;
            params.push(Math.min(parseInt(limit, 10) || 30, 100));
        } else {
            query += ` ORDER BY u_code ASC LIMIT $1`;
            params.push(Math.min(parseInt(limit, 10) || 30, 100));
        }

        const result = await pool.query(query, params);

        // Check which users already exist in m_user_profile
        const codes = result.rows.map(r => r.u_code);
        let existingCodes = new Set();
        if (codes.length > 0) {
            const existing = await engPool.query(
                `SELECT u_code FROM m_user_profile WHERE u_code = ANY($1)`,
                [codes]
            );
            existingCodes = new Set(existing.rows.map(r => r.u_code));
        }

        const formatted = result.rows.map(row => ({
            u_code: row.u_code,
            u_name: row.u_name,
            u_authority: row.u_authority,
            u_role: row.u_role,
            is_already_imported: existingCodes.has(row.u_code)
        }));

        res.json({ result: 'true', data: formatted });
    } catch (error) {
        console.error("Error searching external users from m_user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 9. Skill Management & Power Calculation
const norm = (val, maxVal = 3.0) => (val ? (Number(val) / maxVal) * 100 : 0);

const calculatePowers = (skills) => {
    const mc_setup = norm(skills.mc_setup || 1);
    const inspection = norm(skills.inspection || 1);
    const mc_op = norm(skills.mc_operation || 1);
    const pub_std = norm(skills.public_std || 1);
    const cust_spec = norm(skills.cust_specification || 1);
    const int_doc = norm(skills.internal_document || 1);
    const cad = norm(skills.cad || 1);
    const prog = norm(skills.programming || 1);
    const ms = norm(skills.microsoft || 1);
    const detail = norm(skills.detail_oriented || 1);
    const crit = norm(skills.critical_thinking || 1);
    const proc = norm(skills.process_comprehension || 1);
    const time_m = norm(skills.time_management || 1);
    const collab = norm(skills.collaboration || 1);
    const leader = norm(skills.leadership || 1);

    const atk = Math.round(0.35 * mc_setup + 0.35 * mc_op + 0.20 * inspection + 0.10 * detail);
    const def = Math.round(0.25 * pub_std + 0.30 * cust_spec + 0.25 * int_doc + 0.10 * inspection + 0.10 * detail);
    const hp = Math.round(0.35 * time_m + 0.35 * collab + 0.20 * leader + 0.10 * proc);
    const mp = Math.round(0.35 * prog + 0.30 * cad + 0.15 * ms + 0.20 * crit);

    return { atk, def, hp, mp };
};

const getUserSkills = async (req, res) => {
    try {
        const query = `
            SELECT 
                u.u_code,
                u.u_name,
                u.u_nickname,
                u.position,
                u.u_department,
                u.user_group,
                u.role,
                u.section,
                u.u_authority,
                u.u_status,
                u.profile_img_b64,
                u.element,
                u.theme,
                s.mc_setup,
                s.inspection,
                s.mc_operation,
                s.public_std,
                s.cust_specification,
                s.internal_document,
                s.cad,
                s.programming,
                s.microsoft,
                s.detail_oriented,
                s.critical_thinking,
                s.process_comprehension,
                s.time_management,
                s.collaboration,
                s.leadership,
                COALESCE(s.atk, u.atk, 0) as atk,
                COALESCE(s.def, u.def, 0) as def,
                COALESCE(s.hp, u.hp, 0) as hp,
                COALESCE(s.mp, u.mp, 0) as mp,
                s.total_score,
                s.qualifications,
                s.evaluation_details,
                s.evaluation_history,
                s.updated_at
            FROM m_user_profile u
            LEFT JOIN m_user_skills s ON u.u_code = s.u_code
            ORDER BY u.u_code ASC
        `;
        const result = await engPool.query(query);
        res.json({ result: 'true', data: result.rows });
    } catch (error) {
        console.error("Error fetching user skills:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

const getUserSkillByCode = async (req, res) => {
    try {
        const { u_code } = req.params;
        const query = `
            SELECT 
                s.*,
                u.u_name,
                u.u_nickname,
                u.position,
                u.u_department,
                u.user_group,
                u.role,
                u.profile_img_b64,
                u.element,
                u.theme
            FROM m_user_skills s
            JOIN m_user_profile u ON s.u_code = u.u_code
            WHERE s.u_code = $1
        `;
        const result = await engPool.query(query, [u_code]);
        if (result.rows.length === 0) {
            return res.status(404).json({ result: 'false', message: `Skills not found for user ${u_code}` });
        }
        res.json({ result: 'true', data: result.rows[0] });
    } catch (error) {
        console.error(`Error fetching skill for ${req.params.u_code}:`, error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

const norm4 = (v) => (Number(v || 0) / 4.0) * 100;

const calculateLeaderPowers = (skills) => {
    const atk = Math.round(
        0.15 * norm4(skills.basic_instruments) +
        0.15 * norm4(skills.contour_projector) +
        0.20 * norm4(skills.cmm_operation) +
        0.15 * norm4(skills.instrument_selection) +
        0.15 * norm4(skills.dimensional_reporting) +
        0.10 * norm4(skills.jig_fixture_design) +
        0.10 * norm4(skills.jig_fixture_concept)
    );

    const def = Math.round(
        0.25 * norm4(skills.wi_dv_compliance) +
        0.20 * norm4(skills.anomaly_detection) +
        0.15 * norm4(skills.anomaly_action) +
        0.15 * norm4(skills.read_drawing_symbols) +
        0.15 * norm4(skills.drawing_symbols) +
        0.10 * norm4(skills.out_of_spec_action)
    );

    const hp = Math.round(
        0.20 * norm4(skills.target_delivery) +
        0.20 * norm4(skills.otd_traveler_pc) +
        0.15 * norm4(skills.prioritization) +
        0.15 * norm4(skills.training_wi_dv) +
        0.10 * norm4(skills.teaching_me10) +
        0.10 * norm4(skills.external_communication) +
        0.10 * norm4(skills.ot_planning)
    );

    const mp = Math.round(
        0.30 * norm4(skills.me10_basic) +
        0.25 * norm4(skills.drawing_drafting) +
        0.20 * norm4(skills.drawing_database) +
        0.15 * norm4(skills.computer_mrp) +
        0.10 * norm4(skills.excel_reporting)
    );

    return { atk, def, hp, mp };
};

const saveUserSkills = async (req, res) => {
    try {
        const { u_code } = req.params;
        const skillsData = req.body;

        const userCheck = await engPool.query('SELECT u_code, u_name, role FROM m_user_profile WHERE u_code = $1', [u_code]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ result: 'false', message: `User ${u_code} not found in profile.` });
        }

        // Fetch previous skills for audit diff
        const oldSkillsRes = await engPool.query('SELECT * FROM m_user_skills WHERE u_code = $1', [u_code]);
        const oldSkills = oldSkillsRes.rows[0] || null;

        // Branch 1: Leader Evaluation (33 Skills, scale 0-4)
        if (skillsData.evaluation_type === 'leader' || userCheck.rows[0].role === 'LEADER') {
            const leaderSkills = skillsData.leader_skills || {};
            const powers = calculateLeaderPowers(leaderSkills);
            const totalScore = Object.values(leaderSkills).reduce((a, b) => a + (Number(b) || 0), 0);
            const history = skillsData.evaluation_history ? JSON.stringify(skillsData.evaluation_history) : '[]';

            const updateLeaderQuery = `
                INSERT INTO m_user_skills (
                    u_code, evaluation_type, leader_skills, evaluation_history,
                    atk, def, hp, mp, total_score, updated_at
                ) VALUES ($1, 'leader', $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (u_code) DO UPDATE SET
                    evaluation_type = 'leader',
                    leader_skills = EXCLUDED.leader_skills,
                    evaluation_history = CASE 
                        WHEN EXCLUDED.evaluation_history IS NOT NULL AND EXCLUDED.evaluation_history != '[]'::jsonb 
                        THEN EXCLUDED.evaluation_history 
                        ELSE m_user_skills.evaluation_history 
                    END,
                    atk = EXCLUDED.atk,
                    def = EXCLUDED.def,
                    hp = EXCLUDED.hp,
                    mp = EXCLUDED.mp,
                    total_score = EXCLUDED.total_score,
                    updated_at = NOW()
                RETURNING *;
            `;

            const skillResult = await engPool.query(updateLeaderQuery, [
                u_code,
                JSON.stringify(leaderSkills),
                history,
                powers.atk,
                powers.def,
                powers.hp,
                powers.mp,
                totalScore
            ]);

            await engPool.query(
                `UPDATE m_user_profile SET atk = $1, def = $2, hp = $3, mp = $4, updated_at = NOW() WHERE u_code = $5`,
                [powers.atk, powers.def, powers.hp, powers.mp, u_code]
            );

            // Audit Log
            const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
            const powerChanges = {
                atk: { old: oldSkills?.atk ?? 0, new: powers.atk },
                def: { old: oldSkills?.def ?? 0, new: powers.def },
                hp: { old: oldSkills?.hp ?? 0, new: powers.hp },
                mp: { old: oldSkills?.mp ?? 0, new: powers.mp },
                total_score: { old: oldSkills?.total_score ?? 0, new: totalScore }
            };

            await logAction({
                userId: actorId,
                actorName,
                action: 'SKILL_UPDATE_LEADER',
                category: 'USER_SKILLS',
                targetId: u_code,
                targetName: userCheck.rows[0].u_name,
                details: `Updated Leader skills & calibrated powers for ${u_code} (${userCheck.rows[0].u_name || ''}): ATK ${oldSkills?.atk ?? 0}➔${powers.atk}, DEF ${oldSkills?.def ?? 0}➔${powers.def}, HP ${oldSkills?.hp ?? 0}➔${powers.hp}, MP ${oldSkills?.mp ?? 0}➔${powers.mp} (Total: ${totalScore})`,
                oldData: oldSkills,
                newData: { leader_skills: leaderSkills, powers, totalScore },
                changes: powerChanges,
                ipAddress
            });

            return res.json({
                result: 'true',
                message: `Leader skills and powers updated successfully for ${u_code}`,
                data: {
                    ...skillResult.rows[0],
                    powers
                }
            });
        }

        // Branch 2: Staff Evaluation (15 Engineering Skills, scale 1-3)
        const skillKeys = [
            'mc_setup', 'inspection', 'mc_operation',
            'public_std', 'cust_specification', 'internal_document',
            'cad', 'programming', 'microsoft',
            'detail_oriented', 'critical_thinking', 'process_comprehension',
            'time_management', 'collaboration', 'leadership'
        ];

        const sanitizedSkills = {};
        let totalScore = 0;
        for (const key of skillKeys) {
            let val = parseInt(skillsData[key], 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 3) val = 3;
            sanitizedSkills[key] = val;
            totalScore += val;
        }

        const powers = calculatePowers(sanitizedSkills);
        const qualifications = skillsData.qualifications ? JSON.stringify(skillsData.qualifications) : '{}';

        const updateSkillQuery = `
            INSERT INTO m_user_skills (
                u_code, mc_setup, inspection, mc_operation,
                public_std, cust_specification, internal_document,
                cad, programming, microsoft,
                detail_oriented, critical_thinking, process_comprehension,
                time_management, collaboration, leadership,
                total_score, atk, def, hp, mp,
                qualifications, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, NOW()
            )
            ON CONFLICT (u_code) DO UPDATE SET
                mc_setup = EXCLUDED.mc_setup,
                inspection = EXCLUDED.inspection,
                mc_operation = EXCLUDED.mc_operation,
                public_std = EXCLUDED.public_std,
                cust_specification = EXCLUDED.cust_specification,
                internal_document = EXCLUDED.internal_document,
                cad = EXCLUDED.cad,
                programming = EXCLUDED.programming,
                microsoft = EXCLUDED.microsoft,
                detail_oriented = EXCLUDED.detail_oriented,
                critical_thinking = EXCLUDED.critical_thinking,
                process_comprehension = EXCLUDED.process_comprehension,
                time_management = EXCLUDED.time_management,
                collaboration = EXCLUDED.collaboration,
                leadership = EXCLUDED.leadership,
                total_score = EXCLUDED.total_score,
                atk = EXCLUDED.atk,
                def = EXCLUDED.def,
                hp = EXCLUDED.hp,
                mp = EXCLUDED.mp,
                qualifications = CASE 
                    WHEN EXCLUDED.qualifications IS NOT NULL AND EXCLUDED.qualifications != '{}'::jsonb 
                    THEN EXCLUDED.qualifications 
                    ELSE m_user_skills.qualifications 
                END,
                updated_at = NOW()
            RETURNING *
        `;

        const skillResult = await engPool.query(updateSkillQuery, [
            u_code,
            sanitizedSkills.mc_setup, sanitizedSkills.inspection, sanitizedSkills.mc_operation,
            sanitizedSkills.public_std, sanitizedSkills.cust_specification, sanitizedSkills.internal_document,
            sanitizedSkills.cad, sanitizedSkills.programming, sanitizedSkills.microsoft,
            sanitizedSkills.detail_oriented, sanitizedSkills.critical_thinking, sanitizedSkills.process_comprehension,
            sanitizedSkills.time_management, sanitizedSkills.collaboration, sanitizedSkills.leadership,
            totalScore, powers.atk, powers.def, powers.hp, powers.mp,
            qualifications
        ]);

        await engPool.query(`
            UPDATE m_user_profile 
            SET atk = $1, def = $2, hp = $3, mp = $4, updated_at = NOW()
            WHERE u_code = $5
        `, [powers.atk, powers.def, powers.hp, powers.mp, u_code]);

        // Audit Log
        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        const skillChanges = {};
        for (const k of skillKeys) {
            if (oldSkills && oldSkills[k] !== sanitizedSkills[k]) {
                skillChanges[k] = { old: oldSkills[k], new: sanitizedSkills[k] };
            }
        }
        skillChanges['atk'] = { old: oldSkills?.atk ?? 0, new: powers.atk };
        skillChanges['def'] = { old: oldSkills?.def ?? 0, new: powers.def };
        skillChanges['hp'] = { old: oldSkills?.hp ?? 0, new: powers.hp };
        skillChanges['mp'] = { old: oldSkills?.mp ?? 0, new: powers.mp };
        skillChanges['total_score'] = { old: oldSkills?.total_score ?? 0, new: totalScore };

        await logAction({
            userId: actorId,
            actorName,
            action: 'SKILL_UPDATE_STAFF',
            category: 'USER_SKILLS',
            targetId: u_code,
            targetName: userCheck.rows[0].u_name,
            details: `Updated Staff skills & calibrated powers for ${u_code} (${userCheck.rows[0].u_name || ''}): ATK ${oldSkills?.atk ?? 0}➔${powers.atk}, DEF ${oldSkills?.def ?? 0}➔${powers.def}, HP ${oldSkills?.hp ?? 0}➔${powers.hp}, MP ${oldSkills?.mp ?? 0}➔${powers.mp} (Total: ${totalScore})`,
            oldData: oldSkills,
            newData: { ...sanitizedSkills, powers, totalScore },
            changes: skillChanges,
            ipAddress
        });

        res.json({
            result: 'true',
            message: `User skills and powers updated successfully for ${u_code}`,
            data: {
                ...skillResult.rows[0],
                powers
            }
        });
    } catch (error) {
        console.error("Error saving user skills:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 12. Update User Qualifications directly (Official certifications & special overrides)
const updateQualifications = async (req, res) => {
    try {
        const { u_code } = req.params;
        const { qualifications } = req.body;

        if (!qualifications || typeof qualifications !== 'object') {
            return res.status(400).json({ result: 'false', message: 'Valid qualifications object is required' });
        }

        // Retrieve old qualifications for diff
        const oldSkillsRes = await engPool.query('SELECT qualifications FROM m_user_skills WHERE u_code = $1', [u_code]);
        const oldQualifications = oldSkillsRes.rows[0]?.qualifications || {};

        const query = `
            INSERT INTO m_user_skills (u_code, qualifications, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (u_code) DO UPDATE SET
                qualifications = EXCLUDED.qualifications,
                updated_at = NOW()
            RETURNING *
        `;

        const result = await engPool.query(query, [u_code, JSON.stringify(qualifications)]);

        // Compute diff
        const diffQual = {};
        const allKeys = Array.from(new Set([...Object.keys(oldQualifications), ...Object.keys(qualifications)]));
        for (const k of allKeys) {
            if (JSON.stringify(oldQualifications[k]) !== JSON.stringify(qualifications[k])) {
                diffQual[k] = { old: oldQualifications[k] || null, new: qualifications[k] || null };
            }
        }

        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);
        await logAction({
            userId: actorId,
            actorName,
            action: 'QUALIFICATION_UPDATE',
            category: 'QUALIFICATIONS',
            targetId: u_code,
            targetName: `Qualifications (${u_code})`,
            details: `Updated qualifications & certifications for user ${u_code}`,
            oldData: oldQualifications,
            newData: qualifications,
            changes: diffQual,
            ipAddress
        });

        res.json({
            result: 'true',
            message: `Qualifications updated successfully for ${u_code}`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating user qualifications:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 13. Get Qualification Criteria & Skill Definitions
const getQualificationCriteria = async (req, res) => {
    try {
        const { DEFAULT_QUALIFICATION_COLUMNS, DEFAULT_SKILL_DEFINITIONS } = require('../../scripts/init_criteria_db');
        const query = `SELECT * FROM m_qualification_criteria WHERE criteria_key = 'default';`;
        let result = await engPool.query(query);

        if (result.rows.length === 0) {
            // Seed default if empty
            const seedQuery = `
                INSERT INTO m_qualification_criteria (criteria_key, qualification_columns, skill_definitions, updated_by, updated_at)
                VALUES ('default', $1, $2, 'SYSTEM_INIT', NOW())
                RETURNING *;
            `;
            result = await engPool.query(seedQuery, [
                JSON.stringify(DEFAULT_QUALIFICATION_COLUMNS),
                JSON.stringify(DEFAULT_SKILL_DEFINITIONS)
            ]);
        }

        res.json({
            result: 'true',
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error fetching qualification criteria:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 14. Save/Update Qualification Criteria
const saveQualificationCriteria = async (req, res) => {
    try {
        const qualification_columns = req.body.qualification_columns || req.body.qualificationColumns;
        const skill_definitions = req.body.skill_definitions || req.body.skillDefinitions;
        const leader_criteria = req.body.leader_criteria || req.body.leaderCriteria;
        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);

        // Ensure leader_criteria column exists
        await engPool.query(`
            ALTER TABLE m_qualification_criteria 
            ADD COLUMN IF NOT EXISTS leader_criteria JSONB;
        `);

        const query = `
            INSERT INTO m_qualification_criteria (criteria_key, qualification_columns, skill_definitions, leader_criteria, updated_by, updated_at)
            VALUES ('default', 
                COALESCE($1, '[]'::jsonb), 
                COALESCE($2, '[]'::jsonb), 
                COALESCE($3, '[]'::jsonb), 
                $4, 
                NOW()
            )
            ON CONFLICT (criteria_key) DO UPDATE SET
                qualification_columns = CASE WHEN $1 IS NOT NULL THEN $1 ELSE m_qualification_criteria.qualification_columns END,
                skill_definitions = CASE WHEN $2 IS NOT NULL THEN $2 ELSE m_qualification_criteria.skill_definitions END,
                leader_criteria = CASE WHEN $3 IS NOT NULL THEN $3 ELSE m_qualification_criteria.leader_criteria END,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
            RETURNING *;
        `;

        const result = await engPool.query(query, [
            qualification_columns ? JSON.stringify(qualification_columns) : null,
            skill_definitions ? JSON.stringify(skill_definitions) : null,
            leader_criteria ? JSON.stringify(leader_criteria) : null,
            actorId
        ]);

        await logAction({
            userId: actorId,
            actorName,
            action: 'CRITERIA_UPDATE',
            category: 'CRITERIA',
            targetId: 'criteria:default',
            targetName: 'Master Qualification Criteria',
            details: `Updated qualification criteria: ${qualification_columns ? qualification_columns.length + ' staff roles' : ''} ${skill_definitions ? skill_definitions.length + ' skills' : ''} ${leader_criteria ? leader_criteria.length + ' leader criteria' : ''}`,
            newData: { qualification_columns, skill_definitions, leader_criteria },
            ipAddress
        });

        res.json({
            result: 'true',
            message: 'Qualification criteria saved successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error saving qualification criteria:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 15. Reset Qualification Criteria to Factory Defaults
const resetQualificationCriteria = async (req, res) => {
    try {
        const { DEFAULT_QUALIFICATION_COLUMNS, DEFAULT_SKILL_DEFINITIONS } = require('../../scripts/init_criteria_db');
        const { userId: actorId, actorName, ipAddress } = getActorInfo(req);

        const query = `
            INSERT INTO m_qualification_criteria (criteria_key, qualification_columns, skill_definitions, updated_by, updated_at)
            VALUES ('default', $1, $2, $3, NOW())
            ON CONFLICT (criteria_key) DO UPDATE SET
                qualification_columns = EXCLUDED.qualification_columns,
                skill_definitions = EXCLUDED.skill_definitions,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
            RETURNING *;
        `;

        const result = await engPool.query(query, [
            JSON.stringify(DEFAULT_QUALIFICATION_COLUMNS),
            JSON.stringify(DEFAULT_SKILL_DEFINITIONS),
            actorId
        ]);

        await logAction({
            userId: actorId,
            actorName,
            action: 'CRITERIA_RESET',
            category: 'CRITERIA',
            targetId: 'criteria:default',
            targetName: 'Master Qualification Criteria',
            details: 'Reset qualification criteria matrix to factory baseline defaults',
            ipAddress
        });

        res.json({
            result: 'true',
            message: 'Qualification criteria reset to factory defaults successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error resetting qualification criteria:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 16. Get Audit Logs with comprehensive filtering & pagination
const getAuditLogs = async (req, res) => {
    try {
        const queryParams = req?.query || req || {};
        const {
            page = 1,
            pageSize = 20,
            search = '',
            category = 'ALL',
            action = 'ALL',
            targetId = '',
            userId = '',
            startDate = '',
            endDate = '',
            sortOrder = 'desc'
        } = queryParams;

        let whereClauses = [];
        let params = [];
        let paramIdx = 1;

        if (search && search.trim()) {
            whereClauses.push(`(
                details ILIKE $${paramIdx} OR 
                user_id ILIKE $${paramIdx} OR 
                actor_name ILIKE $${paramIdx} OR 
                target_id ILIKE $${paramIdx} OR 
                target_name ILIKE $${paramIdx} OR 
                action ILIKE $${paramIdx}
            )`);
            params.push(`%${search.trim()}%`);
            paramIdx++;
        }

        if (category && category !== 'ALL') {
            whereClauses.push(`category = $${paramIdx}`);
            params.push(category);
            paramIdx++;
        }

        if (action && action !== 'ALL') {
            whereClauses.push(`action = $${paramIdx}`);
            params.push(action);
            paramIdx++;
        }

        if (targetId && targetId.trim()) {
            whereClauses.push(`target_id ILIKE $${paramIdx}`);
            params.push(`%${targetId.trim()}%`);
            paramIdx++;
        }

        if (userId && userId.trim()) {
            whereClauses.push(`(user_id ILIKE $${paramIdx} OR actor_name ILIKE $${paramIdx})`);
            params.push(`%${userId.trim()}%`);
            paramIdx++;
        }

        if (startDate) {
            whereClauses.push(`created_at >= $${paramIdx}`);
            params.push(startDate);
            paramIdx++;
        }

        if (endDate) {
            whereClauses.push(`created_at <= $${paramIdx}::date + interval '1 day'`);
            params.push(endDate);
            paramIdx++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const orderSql = sortOrder.toLowerCase() === 'asc' ? 'ORDER BY created_at ASC, id ASC' : 'ORDER BY created_at DESC, id DESC';

        let limitSql = '';
        if (pageSize !== 'all' && Number(pageSize) > 0) {
            limitSql = `LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
            params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
        }

        const dataQuery = `SELECT * FROM system_logs ${whereSql} ${orderSql} ${limitSql}`;
        const countParams = limitSql ? params.slice(0, params.length - 2) : params;
        const countQuery = `SELECT COUNT(*) FROM system_logs ${whereSql}`;

        const [dataRes, countRes] = await Promise.all([
            engPool.query(dataQuery, params),
            engPool.query(countQuery, countParams)
        ]);

        res.json({
            result: 'true',
            data: dataRes.rows,
            total: parseInt(countRes.rows[0].count, 10),
            page: parseInt(page, 10),
            pageSize: pageSize === 'all' ? dataRes.rows.length : parseInt(pageSize, 10)
        });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 17. Get Audit Log Stats
const getAuditLogStats = async (req, res) => {
    try {
        const totalQuery = `SELECT COUNT(*) FROM system_logs;`;
        const todayQuery = `SELECT COUNT(*) FROM system_logs WHERE created_at >= CURRENT_DATE;`;
        const categoryQuery = `
            SELECT COALESCE(category, 'GENERAL') as category, COUNT(*) as count 
            FROM system_logs 
            GROUP BY category 
            ORDER BY count DESC;
        `;
        const recentActorsQuery = `
            SELECT COALESCE(actor_name, user_id) as actor, COUNT(*) as count 
            FROM system_logs 
            GROUP BY actor 
            ORDER BY count DESC 
            LIMIT 5;
        `;

        const [totalRes, todayRes, catRes, actorsRes] = await Promise.all([
            engPool.query(totalQuery),
            engPool.query(todayQuery),
            engPool.query(categoryQuery),
            engPool.query(recentActorsQuery)
        ]);

        res.json({
            result: 'true',
            data: {
                total: parseInt(totalRes.rows[0].count, 10),
                today: parseInt(todayRes.rows[0].count, 10),
                categories: catRes.rows,
                topActors: actorsRes.rows
            }
        });
    } catch (error) {
        console.error("Error fetching audit log stats:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

module.exports = {
    getSchema, addColumn, dropColumn, getUsers, createUser, updateUser, deleteUserRecord, searchExternalUsers,
    getUserSkills, getUserSkillByCode, saveUserSkills, calculatePowers, updateQualifications,
    getQualificationCriteria, saveQualificationCriteria, resetQualificationCriteria,
    getAuditLogs, getAuditLogStats, logAction
};

