// Drawing Request database (engreq)
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.ENGREQ_URL });
pool.on('error', (err) => console.error('engreq pool error:', err.message));

module.exports = { pool };
