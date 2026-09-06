-- Phase 1: Architecture & Database Design — ECNT V2

-- 1. Core Document Tables

-- ecnt2_ecr: Engineering Change Request (Blocks 1-4)
CREATE TABLE IF NOT EXISTS ecnt2_ecr (
    id              SERIAL PRIMARY KEY,
    ecr_no          VARCHAR(20) UNIQUE,                    
    
    ref_coc_no      VARCHAR(100),                          
    request_by      VARCHAR(100) NOT NULL,                 
    request_by_name VARCHAR(200),                          
    request_date    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    department      VARCHAR(100),                          
    
    status_type     VARCHAR(20) DEFAULT 'PERMANENT',       
    objective       VARCHAR(50),                            
    objective_other TEXT,                                   
    
    is_drawing      BOOLEAN DEFAULT FALSE,                 
    is_tooling      BOOLEAN DEFAULT FALSE,                 
    is_program      BOOLEAN DEFAULT FALSE,                 
    is_usage        BOOLEAN DEFAULT FALSE,                 
    
    title_of_change TEXT,
    reason_of_change TEXT,
    
    dwg_part_no         VARCHAR(100),
    dwg_cn              VARCHAR(100),
    dwg_revision        VARCHAR(50),
    dwg_reason_of_change TEXT,
    dwg_before_change   TEXT,                              
    dwg_after_change    TEXT,                              
    
    tool_current_no     VARCHAR(100),
    tool_current_usage  VARCHAR(50),                        
    tool_new_no         VARCHAR(100),
    tool_new_usage      VARCHAR(50),                        
    
    prog_before_change  TEXT,                              
    prog_condition_before TEXT,                            
    prog_after_change   TEXT,                              
    prog_condition_after TEXT,                             
    
    usage_setup_no      VARCHAR(100),                      
    usage_part_no       VARCHAR(100),
    usage_cn            VARCHAR(100),
    usage_process       VARCHAR(200),
    usage_program_no    VARCHAR(100),
    usage_mc_no         VARCHAR(100),
    usage_cycle_time_before TEXT,
    usage_cycle_time_after  TEXT,
    usage_before_change TEXT,
    usage_after_change  TEXT,
    
    current_block   SMALLINT DEFAULT 1,                    
    process_status  VARCHAR(50) DEFAULT 'Draft',           
    assigned_to     VARCHAR(100),                          
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_ecr_status ON ecnt2_ecr(process_status);
CREATE INDEX IF NOT EXISTS idx_ecnt2_ecr_requester ON ecnt2_ecr(request_by);
CREATE INDEX IF NOT EXISTS idx_ecnt2_ecr_assigned ON ecnt2_ecr(assigned_to);


-- ecnt2_ecn: Engineering Change Notice (Blocks 5-11)
CREATE TABLE IF NOT EXISTS ecnt2_ecn (
    id              SERIAL PRIMARY KEY,
    ecn_no          VARCHAR(50) UNIQUE,                    
    ecr_id          INTEGER NOT NULL REFERENCES ecnt2_ecr(id) ON DELETE CASCADE,
    
    request_by      VARCHAR(100),                          
    request_date    TIMESTAMP,                             
    department      VARCHAR(100),                          
    engineer_assigned VARCHAR(100),                        
    
    title_of_change TEXT,
    reason_of_change TEXT,
    scope_of_implementation TEXT,
    before_change   TEXT,                                   
    after_change    TEXT,                                   
    
    dwg_suspended   BOOLEAN DEFAULT FALSE,                 
    dwg_enabled     BOOLEAN DEFAULT FALSE,                 
    
    related_models  JSONB,                                 
    notice_to_customer_file TEXT,
    
    current_block   SMALLINT DEFAULT 5,                    
    process_status  VARCHAR(50) DEFAULT 'Pending Eng Mgr ECN', 
    
    closed_by       VARCHAR(100),
    closed_by_name  VARCHAR(200),
    closed_date     TIMESTAMP,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_ecn_ecr ON ecnt2_ecn(ecr_id);
CREATE INDEX IF NOT EXISTS idx_ecnt2_ecn_status ON ecnt2_ecn(process_status);
CREATE INDEX IF NOT EXISTS idx_ecnt2_ecn_engineer ON ecnt2_ecn(engineer_assigned);


-- 2. Impact Assessment (Block 5)
CREATE TABLE IF NOT EXISTS ecnt2_impact_assessment (
    id              SERIAL PRIMARY KEY,
    ecn_id          INTEGER NOT NULL REFERENCES ecnt2_ecn(id) ON DELETE CASCADE,
    
    has_customer_impact     BOOLEAN DEFAULT FALSE,
    customer_name           VARCHAR(200),
    m4_request_doc_no       VARCHAR(100),
    customer_notification_date TIMESTAMP,
    customer_change_notice_date TIMESTAMP,
    customer_approved_date  TIMESTAMP,
    
    has_kzw_fjsw_impact     BOOLEAN DEFAULT FALSE,
    operation_type          VARCHAR(50),                    
    kzw_notification_date   TIMESTAMP,
    kzw_dcn_ecn_doc_no      VARCHAR(200),
    kzw_doc_received_date   TIMESTAMP,
    
    has_sale_drawing_impact  BOOLEAN DEFAULT FALSE,
    sale_drawing_revision_no VARCHAR(200),
    sale_drawing_finish_date TIMESTAMP,
    
    has_traceability        BOOLEAN DEFAULT FALSE,
    traceability_details    JSONB,                          
    
    has_wip_stock           BOOLEAN DEFAULT FALSE,
    wip_stock_details       JSONB,                          
    
    has_outsourcing         BOOLEAN DEFAULT FALSE,
    outsourcing_details     JSONB,                          
    
    has_unit_price          BOOLEAN DEFAULT FALSE,
    unit_price_details      JSONB,                          
    
    has_manufacturing       BOOLEAN DEFAULT FALSE,
    manufacturing_details   JSONB,                          
    
    has_product_quality     BOOLEAN DEFAULT FALSE,
    product_quality_details JSONB,                          
    
    has_safety              BOOLEAN DEFAULT FALSE,
    safety_details          JSONB,                          
    
    has_otd                 BOOLEAN DEFAULT FALSE,
    otd_details             JSONB,                          
    
    confirmed_by            VARCHAR(100),
    confirmed_date          TIMESTAMP,
    
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_impact_ecn ON ecnt2_impact_assessment(ecn_id);


-- 3. QC Decisions (Blocks 7-8)
CREATE TABLE IF NOT EXISTS ecnt2_qc_decision (
    id              SERIAL PRIMARY KEY,
    ecn_id          INTEGER NOT NULL REFERENCES ecnt2_ecn(id) ON DELETE CASCADE,
    decision_type   VARCHAR(10) NOT NULL,                  
    
    decision        VARCHAR(20) NOT NULL,                  
    fai_type        VARCHAR(20),                           
    reason          TEXT,
    
    confirmed_by    VARCHAR(100),                          
    confirmed_by_name VARCHAR(200),
    confirmed_date  TIMESTAMP,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_qc_ecn ON ecnt2_qc_decision(ecn_id);


-- 4. FAI Summary (Block 9)
CREATE TABLE IF NOT EXISTS ecnt2_fai_summary (
    id              SERIAL PRIMARY KEY,
    ecn_id          INTEGER NOT NULL REFERENCES ecnt2_ecn(id) ON DELETE CASCADE,
    
    fai_approved_confirmed BOOLEAN DEFAULT FALSE,          
    fai_lot_no      VARCHAR(200),
    summary_result  TEXT,
    stakeholder_comment TEXT,
    
    confirmed_by    VARCHAR(100),                          
    confirmed_by_name VARCHAR(200),
    confirmed_date  TIMESTAMP,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5. Concern Approval Tasks (Block 10)
CREATE TABLE IF NOT EXISTS ecnt2_concern_task (
    id              SERIAL PRIMARY KEY,
    ecn_id          INTEGER NOT NULL REFERENCES ecnt2_ecn(id) ON DELETE CASCADE,
    
    dept_code       VARCHAR(10) NOT NULL,                  
    dept_label      VARCHAR(100),                          
    is_needed       BOOLEAN DEFAULT FALSE,                 
    
    approved_by     VARCHAR(100),                          
    approved_by_name VARCHAR(200),
    approved_date   TIMESTAMP,
    status          VARCHAR(20) DEFAULT 'PENDING',         
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_concern_ecn ON ecnt2_concern_task(ecn_id);


-- 6. Approval Log (All Blocks)
CREATE TABLE IF NOT EXISTS ecnt2_approval_log (
    id              SERIAL PRIMARY KEY,
    
    document_type   VARCHAR(3) NOT NULL,                   
    document_id     INTEGER NOT NULL,                      
    
    block_number    SMALLINT NOT NULL,                     
    step_label      VARCHAR(100),                          
    
    action          VARCHAR(30) NOT NULL,                  
    action_by       VARCHAR(100) NOT NULL,                 
    action_by_name  VARCHAR(200),
    action_role     VARCHAR(100),                          
    
    comment         TEXT,
    deny_reason     TEXT,
    request_to_requester TEXT,                             
    
    details         JSONB,                                 
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_log_ecr ON ecnt2_approval_log(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_ecnt2_log_block ON ecnt2_approval_log(block_number);


-- 7. File Attachments
CREATE TABLE IF NOT EXISTS ecnt2_attachment (
    id              SERIAL PRIMARY KEY,
    
    document_type   VARCHAR(3) NOT NULL,                   
    document_id     INTEGER NOT NULL,
    block_number    SMALLINT,
    field_name      VARCHAR(100),                          
    
    file_name       VARCHAR(500),
    file_url        VARCHAR(1000) NOT NULL,                
    file_type       VARCHAR(50),                           
    file_size       INTEGER,
    
    uploaded_by     VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_attach_doc ON ecnt2_attachment(document_type, document_id);


-- 8. Notification Log
CREATE TABLE IF NOT EXISTS ecnt2_notification (
    id              SERIAL PRIMARY KEY,
    
    document_type   VARCHAR(3) NOT NULL,
    document_id     INTEGER NOT NULL,
    block_number    SMALLINT,
    
    recipient       VARCHAR(100),                          
    recipient_email VARCHAR(200),
    email_type      VARCHAR(50),                           
    subject         VARCHAR(500),
    body            TEXT,
    
    is_sent         BOOLEAN DEFAULT FALSE,
    sent_at         TIMESTAMP,
    error_message   TEXT,
    
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 9. Master Person-In-Charge (Seed Data)
CREATE TABLE IF NOT EXISTS ecnt2_master_pic (
    id              SERIAL PRIMARY KEY,
    role_code       VARCHAR(30) NOT NULL UNIQUE,            
    role_label      VARCHAR(200) NOT NULL,
    person_name     VARCHAR(200) NOT NULL,
    u_code          VARCHAR(20),                           
    department      VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data (from Detail for system.xlsx)
INSERT INTO ecnt2_master_pic (role_code, role_label, person_name, department) VALUES
    ('ENG_MGR',      'Eng. Dept Manager',              'TEERAPOL KANTAPOOM',       'ENG'),
    ('ENG_ASSIGNED', 'Eng. Assigned',                  'NATHAPORN YAMMANUS',       'ENG'),
    ('QC_FAI',       'QC Decision for FAI',            'PATCHARAYADA WAIYABOON',   'QC'),
    ('PC',           'PC',                             'TASANEE CHUDUANG',         'PC'),
    ('QA',           'QA',                             'CHUANPIT KHATTIYA',        'QA'),
    ('QC',           'QC',                             'SUPARAT KATSANUK',         'QC'),
    ('PD1',          'Production #1',                  'CHANASORN MEEPRO',         'PD'),
    ('PD2',          'Production #2',                  'WATCHARIYA ROEKARAM',      'PD'),
    ('MC',           'MC',                             'PUSSADEE ROIKEAW',         'MC'),
    ('MM',           'MM',                             'Sarunyu Chokchaikasemsuk', 'MM'),
    ('THAI_MGR',     'Thai Manager/Div. Head',         'Sakda Tantidechamongkol',  'MGT'),
    ('JP_MGR',       'Japanese Manager',               'Ryoichi Furuta',           'MGT')
ON CONFLICT (role_code) DO UPDATE SET
    person_name = EXCLUDED.person_name,
    updated_at = NOW();
