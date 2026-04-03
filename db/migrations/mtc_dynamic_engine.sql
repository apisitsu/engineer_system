-- Create table for Machines
CREATE TABLE IF NOT EXISTS mtc_machines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    group_name VARCHAR(50) NOT NULL, -- e.g., 'FACE', 'OD', 'ID'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for Tool Categories under each machine
CREATE TABLE IF NOT EXISTS mtc_tool_categories (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES mtc_machines(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL, -- e.g., 'CHUTE', 'CARRIER'
    display_order INTEGER DEFAULT 0,
    required_count INTEGER DEFAULT 1, -- used for Incomplete alert
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_id, category_name)
);

-- Create table for Tool Configuration (Columns and Formulas)
CREATE TABLE IF NOT EXISTS mtc_tool_configs (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES mtc_tool_categories(id) ON DELETE CASCADE,
    column_name VARCHAR(50) NOT NULL, -- key in data (e.g., 'valA')
    display_label VARCHAR(100) NOT NULL, -- header in table (e.g., 'Slot Length (A)')
    formula TEXT, -- JS formula string (e.g., 'part.odAft + 0.5')
    search_type VARCHAR(20) DEFAULT 'nearest', -- 'nearest', 'min', 'max', 'equal'
    tolerance FLOAT DEFAULT 0.1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, column_name)
);

-- Insert initial data for TSG-300ZNC as an example
DO $$ 
DECLARE 
    m_id INT;
    c_id INT;
BEGIN
    INSERT INTO mtc_machines (name, group_name) VALUES ('TSG-300ZNC', 'FACE') RETURNING id INTO m_id;
    
    -- Add CHUTE Category
    INSERT INTO mtc_tool_categories (machine_id, category_name, required_count, display_order) 
    VALUES (m_id, 'CHUTE', 1, 1) RETURNING id INTO c_id;
    
    INSERT INTO mtc_tool_configs (category_id, column_name, display_label, formula) VALUES 
    (c_id, 'valA', 'Slot Length (A)', 'part.wAft + 0.2'),
    (c_id, 'valB', 'Slot Height (B)', 'part.odAft + 0.5');

    -- Add CARRIER Category
    INSERT INTO mtc_tool_categories (machine_id, category_name, required_count, display_order) 
    VALUES (m_id, 'CARRIER (ZNC)', 1, 2) RETURNING id INTO c_id;
    
    INSERT INTO mtc_tool_configs (category_id, column_name, display_label, formula) VALUES 
    (c_id, 'valA', 'Slot Width (A)', 'part.odAft + 1.0');
END $$;
