// Setup Data Sheet database (production_db)
const { Pool } = require('pg');

const poolSds = new Pool({ connectionString: process.env.SDS_URL });
poolSds.on('error', (err) => console.error('sds pool error:', err.message));

module.exports = { poolSds };
