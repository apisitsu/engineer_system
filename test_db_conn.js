const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'apps/ENG-Backend/.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'eng_system',
    password: process.env.DB_PASSWORD || 'Eng1234567889',
    port: process.env.DB_PORT || 6543,
});

async function test() {
  console.log('Attempting to connect to DB at', process.env.DB_HOST || 'localhost', ':', process.env.DB_PORT || 6543);
  try {
    const client = await pool.connect();
    console.log('✅ Connected!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

test();
