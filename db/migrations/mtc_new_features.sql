-- Migration for MTC New Features: Tooling Select and Setup Data Sheet (SDS)

-- 1. Part Specification
CREATE TABLE IF NOT EXISTS spec_process (
    cn VARCHAR(50) PRIMARY KEY,
    od_bf DECIMAL,
    od_bf_max DECIMAL,
    od_bf_min DECIMAL,
    id_bf DECIMAL,
    id_bf_max DECIMAL,
    id_bf_min DECIMAL,
    w_bf DECIMAL,
    w_bf_max DECIMAL,
    w_bf_min DECIMAL,
    od_aft DECIMAL,
    od_aft_max DECIMAL,
    od_aft_min DECIMAL,
    id_aft DECIMAL,
    id_aft_max DECIMAL,
    id_aft_min DECIMAL,
    w_aft DECIMAL,
    w_aft_max DECIMAL,
    w_aft_min DECIMAL,
    type VARCHAR(100),
    yball VARCHAR(10),
    process VARCHAR(100),
    sd DECIMAL,
    sd_aft DECIMAL
);

-- 2. Tooling Tables
CREATE TABLE IF NOT EXISTS tooling_ksb22g (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    jaw_id_1_a DECIMAL,
    jaw_id_2_b DECIMAL,
    jaw_width_max_c DECIMAL,
    jaw_depth_max_d DECIMAL,
    backplate_id_a DECIMAL,
    backplate_pcd_b DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_ksb80 (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    jaw_id_1_a DECIMAL,
    jaw_id_2_b DECIMAL,
    jaw_width_max_c DECIMAL,
    jaw_depth_max_d DECIMAL,
    jaw_e DECIMAL,
    backplate_id_a DECIMAL,
    backplate_pcd_b DECIMAL,
    backplate_c DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_tsg300 (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    face_chute_a DECIMAL,
    face_chute_b DECIMAL,
    face_chute_c DECIMAL,
    face_chute_d DECIMAL,
    face_carrier_a DECIMAL,
    face_carrier_b DECIMAL,
    face_carrier_c DECIMAL,
    face_carrier_d DECIMAL,
    face_carrier_e DECIMAL,
    face_carrier_f DECIMAL,
    face_carrier_g DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_ks03a (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    dim_a DECIMAL, dim_b DECIMAL, dim_c DECIMAL, dim_d DECIMAL,
    dim_e DECIMAL, dim_f DECIMAL, dim_g DECIMAL, dim_h DECIMAL,
    dim_i DECIMAL, dim_j DECIMAL, dim_k DECIMAL, dim_l DECIMAL,
    dim_m DECIMAL, dim_n DECIMAL, dim_o DECIMAL, dim_p DECIMAL,
    dim_q DECIMAL, dim_r DECIMAL, dim_s DECIMAL, dim_t DECIMAL,
    dim_u DECIMAL, dim_v DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_ks400b (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    od_a DECIMAL, id_b DECIMAL, od_c DECIMAL, od_d DECIMAL,
    width_e DECIMAL, step_f DECIMAL,
    loading_chute_a DECIMAL, loading_chute_b DECIMAL, loading_chute_c DECIMAL,
    loading_chute_d DECIMAL, loading_chute_e DECIMAL, loading_chute_f DECIMAL,
    support_block_a DECIMAL, support_block_b DECIMAL, support_block_c DECIMAL,
    support_block_d DECIMAL, support_block_e DECIMAL,
    plug_a_od_a DECIMAL, plug_a_od_b DECIMAL, plug_a_depth_c DECIMAL,
    plug_a_cham_d DECIMAL, plug_a_dist_e DECIMAL,
    plug_b_od_a DECIMAL, plug_b_od_b DECIMAL, plug_b_depth_c DECIMAL,
    plug_b_cham_d DECIMAL, plug_b_dist_e DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_ks500rd (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    dim_a DECIMAL, dim_b DECIMAL, dim_c DECIMAL, dim_d DECIMAL,
    dim_e DECIMAL, dim_f DECIMAL, dim_g DECIMAL, dim_h DECIMAL,
    machine VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS tooling_ks400b5 (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    dim_a DECIMAL, dim_b DECIMAL, dim_c DECIMAL, dim_d DECIMAL,
    dim_e DECIMAL, dim_f DECIMAL, dim_g DECIMAL, dim_h DECIMAL,
    dim_i DECIMAL, dim_j DECIMAL, dim_k DECIMAL, dim_l DECIMAL,
    dim_m DECIMAL, dim_n DECIMAL, dim_o DECIMAL, dim_p DECIMAL,
    dim_q DECIMAL, dim_r DECIMAL, dim_s DECIMAL, dim_t DECIMAL,
    dim_u DECIMAL, dim_v DECIMAL, dim_w DECIMAL, dim_x VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS tooling_ks400b6 (
    id SERIAL PRIMARY KEY,
    tooling_name VARCHAR(255),
    tooling_no VARCHAR(100),
    dim_a DECIMAL, dim_b DECIMAL, dim_c DECIMAL, dim_d DECIMAL,
    dim_e DECIMAL, dim_f DECIMAL, dim_g DECIMAL, dim_h DECIMAL,
    dim_i DECIMAL, dim_j DECIMAL, dim_k DECIMAL, dim_l DECIMAL,
    dim_m DECIMAL, dim_n DECIMAL, dim_o DECIMAL, dim_p DECIMAL,
    dim_q DECIMAL, dim_r DECIMAL, dim_s DECIMAL, dim_t DECIMAL,
    dim_u DECIMAL, dim_v DECIMAL, dim_w DECIMAL, dim_x VARCHAR(50)
);

-- 3. SDS Tables
CREATE TABLE IF NOT EXISTS template (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255),
    excel_file_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS setup_sheet (
    id SERIAL PRIMARY KEY,
    cn VARCHAR(50),
    part_no VARCHAR(100),
    process_name VARCHAR(255),
    process_code VARCHAR(50),
    machine VARCHAR(100),
    category VARCHAR(100),
    setup_data_sheet_rev VARCHAR(50),
    template_id INTEGER REFERENCES template(id)
);

CREATE TABLE IF NOT EXISTS approval (
    id SERIAL PRIMARY KEY,
    setup_sheet_id INTEGER REFERENCES setup_sheet(id),
    prepared_by VARCHAR(255),
    checked_by VARCHAR(255),
    approved_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS template_excel_mapping (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES template(id),
    sheet_name VARCHAR(100),
    cell_address VARCHAR(20),
    param_key VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS setup_parameter_value (
    id SERIAL PRIMARY KEY,
    setup_sheet_id INTEGER REFERENCES setup_sheet(id),
    param_key VARCHAR(100),
    param_value TEXT
);

-- 4. ECR (Engineering Change Request) Table
CREATE TABLE IF NOT EXISTS ecr_request (
    id SERIAL PRIMARY KEY,
    request_no VARCHAR(50),
    req_date TIMESTAMP,
    requester VARCHAR(255),
    department VARCHAR(100),
    req_due_date TIMESTAMP,
    status VARCHAR(50),
    drawing_required BOOLEAN DEFAULT FALSE,
    tooling_required BOOLEAN DEFAULT FALSE,
    program_required BOOLEAN DEFAULT FALSE,
    tool_usage_required BOOLEAN DEFAULT FALSE,
    setup_data_sheet_no VARCHAR(100),
    part_no_tooling VARCHAR(100),
    cn_tooling VARCHAR(100),
    process_tooling VARCHAR(100),
    program_no VARCHAR(100),
    machine_no VARCHAR(100),
    cycle_time VARCHAR(50),
    title_of_change VARCHAR(255),
    reason_of_tooling TEXT,
    tooling_before_change TEXT,
    tooling_after_change TEXT,
    current_tooling_no VARCHAR(100),
    current_tooling_usage DECIMAL,
    new_tooling_no VARCHAR(100),
    new_tooling_usage DECIMAL,
    part_no_drawing VARCHAR(100),
    cn_drawing VARCHAR(100),
    rev_drawing VARCHAR(50),
    reason_of_drawing TEXT,
    drawing_before_change TEXT,
    drawing_after_change TEXT,
    upload_tooling_before TEXT,
    upload_tooling_after TEXT,
    upload_drawing_before TEXT,
    upload_drawing_after TEXT,
    create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP -- Added because it's used in Frontend for sorting/filtering
);

-- 5. MTC Dynamic Selection Rules
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
);
