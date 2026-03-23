const { engPool } = require('../../instance/eng_db');
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
        const limitString = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

        params.push(pageSize, (page - 1) * pageSize);

        const dataQuery = `SELECT * FROM m_user_profile ${whereString} ${orderString} ${limitString}`;
        const countQuery = `SELECT COUNT(*) FROM m_user_profile ${whereString}`;

        const [dataResult, countResult] = await Promise.all([
            engPool.query(dataQuery, params),
            engPool.query(countQuery, params.slice(0, params.length - 2)) // Remove limit/offset params
        ]);

        res.json({
            result: 'true',
            data: dataResult.rows,
            total: parseInt(countResult.rows[0].count, 10),
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10)
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

module.exports = {
    getSchema, addColumn, dropColumn, getUsers, createUser, updateUser, deleteUserRecord
};
