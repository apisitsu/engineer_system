-- ============================================================================
-- ECNT V2: System Configuration & Dynamic Workflow Settings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecnt2_system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Settings if not exists
INSERT INTO ecnt2_system_config (key, value, description, updated_by)
VALUES 
(
    'stage_assignees',
    '{
        "dept_mgr_mapping": {
            "ENG": { "emp_no": "eng_mgr", "name": "ENG Manager", "email": "eng.mgr@minebea.co.th" },
            "QA": { "emp_no": "qa_admin", "name": "QA User", "email": "qa.mgr@minebea.co.th" },
            "QC": { "emp_no": "qc_admin", "name": "QC User", "email": "qc.mgr@minebea.co.th" },
            "PD1": { "emp_no": "pd1_admin", "name": "PD1 User", "email": "pd1.mgr@minebea.co.th" },
            "PD2": { "emp_no": "pd2_admin", "name": "PD2 User", "email": "pd2.mgr@minebea.co.th" },
            "MC": { "emp_no": "mc_admin", "name": "MC User", "email": "mc.mgr@minebea.co.th" },
            "MM": { "emp_no": "mm_admin", "name": "MM User", "email": "mm.mgr@minebea.co.th" },
            "PC": { "emp_no": "pc_admin", "name": "PC User", "email": "pc.mgr@minebea.co.th" },
            "TOP": { "emp_no": "thai_mgr", "name": "Thai Mgr", "email": "top.mgr@minebea.co.th" }
        },
        "eng_mgr": { "emp_no": "eng_mgr", "name": "ENG Manager", "email": "eng.mgr@minebea.co.th" },
        "default_qc_pic": { "emp_no": "qc_admin", "name": "QC User", "email": "qc.pic@minebea.co.th" },
        "default_assigned_engineer": { "emp_no": "eng_admin", "name": "ENG User", "email": "eng.staff@minebea.co.th" }
    }'::jsonb,
    'Mapping of department managers and primary stage PICs',
    'SYSTEM'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ecnt2_system_config (key, value, description, updated_by)
VALUES 
(
    'concern_depts',
    '[
        { "dept_code": "PC", "dept_label": "PC (Production Control)", "default_pic": "TASANEE CHUDUANG", "emp_no": "pc_admin", "email": "pc@minebea.co.th", "is_needed": true },
        { "dept_code": "QA", "dept_label": "QA (Quality Assurance)", "default_pic": "CHUANPIT KHATTIYA", "emp_no": "qa_admin", "email": "qa@minebea.co.th", "is_needed": true },
        { "dept_code": "QC", "dept_label": "QC (Quality Control)", "default_pic": "SUPARAT KATSANUK", "emp_no": "qc_admin", "email": "qc@minebea.co.th", "is_needed": true },
        { "dept_code": "PD1", "dept_label": "Production #1", "default_pic": "CHANASORN MEEPRO", "emp_no": "pd1_admin", "email": "pd1@minebea.co.th", "is_needed": true },
        { "dept_code": "PD2", "dept_label": "Production #2", "default_pic": "WATCHARIYA ROEKARAM", "emp_no": "pd2_admin", "email": "pd2@minebea.co.th", "is_needed": true },
        { "dept_code": "MC", "dept_label": "MC (Machining)", "default_pic": "PUSSADEE ROIKEAW", "emp_no": "mc_admin", "email": "mc@minebea.co.th", "is_needed": true },
        { "dept_code": "MM", "dept_label": "MM (Materials)", "default_pic": "Sarunyu Chokchaikasemsuk", "emp_no": "mm_admin", "email": "mm@minebea.co.th", "is_needed": true }
    ]'::jsonb,
    'List of concern departments and PICs for Block 9 evaluation',
    'SYSTEM'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ecnt2_system_config (key, value, description, updated_by)
VALUES 
(
    'email_settings',
    '{
        "gas_webapp_url": "https://script.google.com/a/macros/minebea.co.th/s/AKfycbxvX4smuNCm8k5x-fkAcurKRG2OfXB0wID0OKzATCreHHIn1BZu0kQDZzFvSfaYoHjCvw/exec",
        "enabled": true,
        "notify_on_stages": ["STAGE_2", "STAGE_2_R1", "STAGE_3", "STAGE_4", "STAGE_5_R1", "STAGE_7", "STAGE_9", "STAGE_10"]
    }'::jsonb,
    'Google Apps Script Web App email notification parameters',
    'SYSTEM'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ecnt2_system_config (key, value, description, updated_by)
VALUES 
(
    'system_admins',
    '["admin", "eng_mgr"]'::jsonb,
    'Employee IDs granted administrative control over ECNT settings',
    'SYSTEM'
)
ON CONFLICT (key) DO NOTHING;
