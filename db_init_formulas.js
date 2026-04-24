const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

const sql = `
CREATE TABLE IF NOT EXISTS mtc_formulas (
    id SERIAL PRIMARY KEY,
    machine_name VARCHAR(50) NOT NULL,
    tool_category VARCHAR(100),
    param_key VARCHAR(50) NOT NULL,
    formula TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(machine_name, tool_category, param_key)
);`;

async function run() {
  try {
    console.log('Attempting to create mtc_formulas table...');
    await engPool.query(sql);
    console.log('✅ Table mtc_formulas created successfully or already exists');
  } catch (err) {
    console.error('❌ Error creating table:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
