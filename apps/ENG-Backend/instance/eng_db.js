require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL connection pool for eng_system (Docker port 6543)
const engPool = new Pool({
    host: process.env.PG_NEW_HOST,
    port: parseInt(process.env.PG_NEW_PORT),
    database: process.env.PG_NEW_DB,
    user: process.env.PG_NEW_USER,
    password: process.env.PG_NEW_PASS,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

engPool.connect()
    .then(client => {
        console.log('✅ PostgreSQL eng_system Connected!');
        client.release();
    })
    .catch(err => {
        console.error('❌ PostgreSQL eng_system error:', err.message);
    });

engPool.on('error', (err) => {
    console.error('Unexpected error on idle client (eng_system):', err);
});

module.exports = { engPool };
