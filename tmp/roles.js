require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'eng_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function run() {
    const res = await pool.query('SELECT * FROM kb_project_manager LIMIT 10');
    console.log("Project Managers / Members:", res.rows);
    process.exit(0);
}
run();
