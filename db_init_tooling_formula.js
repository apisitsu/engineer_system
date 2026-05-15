const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

const sql = `
CREATE TABLE IF NOT EXISTS tooling_formula (
    id                 BIGSERIAL    PRIMARY KEY,
    machine_name       VARCHAR(100) NOT NULL,
    tooling_name       VARCHAR(100) NOT NULL,
    parameter_name     VARCHAR(100) NOT NULL,
    formula_type       VARCHAR(50)  NOT NULL DEFAULT 'expression',
    formula_value      TEXT         NOT NULL,
    rounding_rule      VARCHAR(20)  NOT NULL DEFAULT 'none',
    rounding_precision INTEGER               DEFAULT 2,
    remark             TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooling_formula_machine
    ON tooling_formula (machine_name);

CREATE INDEX IF NOT EXISTS idx_tooling_formula_machine_tool
    ON tooling_formula (machine_name, tooling_name);
`;

async function run() {
  try {
    console.log('Creating tooling_formula table...');
    await engPool.query(sql);
    console.log('✅ Table tooling_formula created successfully or already exists');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
