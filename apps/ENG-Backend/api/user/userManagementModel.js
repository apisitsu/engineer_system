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

// Verify if the table system_logs exists, if not create it
const initAuditTable = async () => {
    try {
        await engPool.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error("Error creating system_logs table:", err);
    }
};

initAuditTable();

const logAction = async (userId, action, details) => {
    try {
        await engPool.query(
            "INSERT INTO system_logs (user_id, action, details) VALUES ($1, $2, $3)",
            [userId, action, details]
        );
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
        // Build the query safely with pg-format for the identifier
        // and parameterized query for the default value doesn't exactly work in ALTER TABLE DEFAULT, 
        // so we format the literal safely or use format('%L')
        const alterQuery = format('ALTER TABLE m_user_profile ADD COLUMN %I %s DEFAULT %L', columnName, sqlDataType, defaultValue);

        await engPool.query(alterQuery);
        await logAction(userId, 'ADD_COLUMN', `Added column ${columnName} of type ${sqlDataType} with default ${defaultValue}`);

        res.json({ result: 'true', message: `Column ${columnName} added successfully.` });
    } catch (error) {
        console.error("Error adding column:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 3. Delete Column
const dropColumn = async (req, res) => {
    const { columnName } = req.body;
    const userId = req.user?.id || 'System';

    if (BLACKLISTED_COLUMNS.includes(columnName)) {
        return res.status(403).json({ result: 'false', message: `Cannot drop blacklisted column: ${columnName}` });
    }

    try {
        const alterQuery = format('ALTER TABLE m_user_profile DROP COLUMN %I', columnName);
        await engPool.query(alterQuery);
        await logAction(userId, 'DROP_COLUMN', `Dropped column ${columnName}`);

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

        const dataQuery = `SELECT * FROM m_user_profile ${whereString} ${orderString} ${limitString}`;
        const countQuery = `SELECT COUNT(*) FROM m_user_profile ${whereString}`;

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
        const record = req.body;

        // Hash password if provided
        if (record.u_pass) {
            record.u_pass = await bcrypt.hash(record.u_pass, 10);
        }

        const columns = Object.keys(record);
        if (columns.length === 0) return res.status(400).json({ result: 'false', message: 'No data provided.' });

        const values = Object.values(record);

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        // Format columns safely
        const colString = columns.map(c => format('%I', c)).join(', ');

        const insertQuery = `INSERT INTO m_user_profile (${colString}) VALUES (${placeholders}) RETURNING *`;

        const result = await engPool.query(insertQuery, values);
        res.json({ result: 'true', data: result.rows[0], message: 'User created' });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 6. Update user record
const updateUser = async (req, res) => {
    try {
        const { u_code } = req.params;
        const record = req.body;

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

        if (result.rowCount === 0) return res.status(404).json({ result: 'false', message: 'User not found.' });

        res.json({ result: 'true', data: result.rows[0], message: 'User updated' });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ result: 'false', error: error.message });
    }
};

// 7. Delete user record
const deleteUserRecord = async (req, res) => {
    try {
        const { u_code } = req.params;
        const deleteQuery = `DELETE FROM m_user_profile WHERE u_code = $1 RETURNING *`;
        const result = await engPool.query(deleteQuery, [u_code]);
        if (result.rowCount === 0) return res.status(404).json({ result: 'false', message: 'User not found.' });

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

        const userCheck = await engPool.query('SELECT u_code, role FROM m_user_profile WHERE u_code = $1', [u_code]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ result: 'false', message: `User ${u_code} not found in profile.` });
        }

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

            await logAction(req.user?.empno || 'SYSTEM', 'UPDATE_LEADER_SKILLS', `Updated leader skills for ${u_code}: ATK=${powers.atk}, DEF=${powers.def}, HP=${powers.hp}, MP=${powers.mp}`);

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

        await logAction(req.user?.empno || 'SYSTEM', 'UPDATE_USER_SKILLS', `Updated skills and power for ${u_code}: ATK=${powers.atk}, DEF=${powers.def}, HP=${powers.hp}, MP=${powers.mp}`);

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

module.exports = {
    getSchema, addColumn, dropColumn, getUsers, createUser, updateUser, deleteUserRecord, searchExternalUsers,
    getUserSkills, getUserSkillByCode, saveUserSkills, calculatePowers
};

