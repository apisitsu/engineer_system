const { engPool } = require('../apps/ENG-Backend/instance/eng_db');

async function createTable() {
    const sql = `
    CREATE TABLE IF NOT EXISTS mtc_selection_rules (
        id SERIAL PRIMARY KEY,
        machine_name VARCHAR(100) NOT NULL,
        tool_category VARCHAR(100) NOT NULL,
        rule_name VARCHAR(255),
        source_field VARCHAR(50),
        operator VARCHAR(10),
        offset_value DECIMAL DEFAULT 0,
        target_tool_table VARCHAR(100),
        target_tool_field VARCHAR(100),
        tolerance_plus DECIMAL DEFAULT 0,
        tolerance_minus DECIMAL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
    
    try {
        await engPool.query(sql);
        console.log("✅ Table mtc_selection_rules created successfully!");
    } catch (err) {
        console.error("❌ Error creating table:", err.message);
    } finally {
        process.exit();
    }
}

createTable();
