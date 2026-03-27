// Tooling Select database (tooling_select)
const { Pool } = require('pg');

const poolTooling = new Pool({ connectionString: process.env.TOOLING_URL });
poolTooling.on('error', (err) => console.error('tooling pool error:', err.message));

module.exports = { poolTooling };
