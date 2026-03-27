// Engineering_System shared auth database (rodpc)
const { Pool } = require('pg');

const poolRodpc = new Pool({
  host: process.env.RODPC_HOST || 'localhost',
  port: parseInt(process.env.RODPC_PORT || '5432'),
  user: process.env.RODPC_USER || 'rodpc',
  password: process.env.RODPC_PASSWORD || 'RODPC',
  database: process.env.RODPC_DB || 'rodpc',
});
poolRodpc.on('error', (err) => console.error('rodpc pool error:', err.message));

module.exports = { poolRodpc };
