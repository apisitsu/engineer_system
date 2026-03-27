-- Backend Schema Initialization for ECR/ECN Workflow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ECNT Document (Main ECR Data)
CREATE TABLE IF NOT EXISTS ecnt_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecr_no VARCHAR(50) NOT NULL UNIQUE,
    request_by VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    require_date TIMESTAMP,
    due_date TIMESTAMP,
    status_type VARCHAR(50),
    objective VARCHAR(100),
    objective_others TEXT,
    
    -- Change Type Flags
    is_drawing BOOLEAN DEFAULT FALSE,
    is_tooling BOOLEAN DEFAULT FALSE,
    is_program BOOLEAN DEFAULT FALSE,
    is_usage BOOLEAN DEFAULT FALSE,

    -- Condition C: Product/Process Drawing Details
    part_no_drawing VARCHAR(100),
    cn_drawing VARCHAR(100),
    rev_drawing VARCHAR(50),
    drawing_before_change TEXT,
    drawing_after_change TEXT,
    upload_drawing_before TEXT,
    upload_drawing_after TEXT,

    -- Conditions A & D: Tooling/Program/Usage Details
    setup_data_sheet_no VARCHAR(100),
    part_no_tooling VARCHAR(100),
    cn_tooling VARCHAR(100),
    cycle_time VARCHAR(100),
    setup_desc_before TEXT,
    setup_desc_after TEXT,
    upload_setup_before TEXT,
    upload_setup_after TEXT,

    -- Condition E: Cutting Program
    cutting_desc_before TEXT,
    cutting_desc_after TEXT,
    upload_cutting_before TEXT,
    upload_cutting_after TEXT,

    -- Condition B: Current/New Tooling Usage
    current_tooling_no VARCHAR(100),
    current_tooling_usage VARCHAR(100),
    new_tooling_no VARCHAR(100),
    new_tooling_usage VARCHAR(100),

    -- Workflow State
    process_status VARCHAR(100) DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ECNT Approval Logs (Workflow History tracking)
CREATE TABLE IF NOT EXISTS ecnt_approval_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecr_id UUID NOT NULL REFERENCES ecnt_document(id) ON DELETE CASCADE,
    step_number VARCHAR(10) NOT NULL,
    action_by VARCHAR(100) NOT NULL,
    action_role VARCHAR(50),
    action_status VARCHAR(50) NOT NULL,
    comments TEXT,
    
    -- Dynamic JSON matching complex form inputs (Step 3.2, 3.5, 3.6 data)
    details JSONB, 
    
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
