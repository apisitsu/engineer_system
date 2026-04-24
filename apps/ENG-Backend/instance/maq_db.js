const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const maqPool = new Pool({
  host: process.env.PG_MAQ_HOST || 'plbmp00',
  port: parseInt(process.env.PG_MAQ_PORT) || 5432,
  database: process.env.PG_MAQ_DB || 'maqdb',
  user: process.env.PG_MAQ_USER,
  password: process.env.PG_MAQ_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

maqPool.on('error', (err) => console.error('[maqPool] idle client error:', err.message));

if (!process.env.PG_MAQ_USER || !process.env.PG_MAQ_PASSWORD) {
  console.warn('[maqPool] WARNING: PG_MAQ_USER or PG_MAQ_PASSWORD not set — maqPool may fail');
}

module.exports = { maqPool };
