-- ============================================================================
-- Template Tool System - Database Schema
-- Version: 1.0
-- Created: 2026-05-14
-- Description: Tables for APQP form management, audit trails, user stamps,
--              and calculator usage logging.
-- ============================================================================

-- 1. Form Headers (Centralized metadata for all form types)
CREATE TABLE IF NOT EXISTS tt_form_headers (
    id              SERIAL PRIMARY KEY,
    form_type       VARCHAR(30) NOT NULL CHECK (form_type IN ('control_plan', 'pid', 'pdr', 'pfd', 'pfmea')),
    status          VARCHAR(20) NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Approved')),
    
    -- Common header fields
    pid_number      VARCHAR(100),
    customer_pn     VARCHAR(100),
    nmb_pn          VARCHAR(100),
    form_number     VARCHAR(100),          -- CP No. / PFD No. / PFMEA No. / PDR No.
    revision        VARCHAR(20),
    prepare_by      VARCHAR(100),
    check_by        VARCHAR(100),
    date_initiated  DATE,
    target_date     DATE,
    
    -- PID-specific
    customer_name   VARCHAR(200),
    nhbb_pn         VARCHAR(100),
    category        VARCHAR(10),            -- opt1..opt5
    phase_checks    JSONB DEFAULT '{}',     -- { "phase1": [true, false, true], ... }
    
    -- Audit metadata
    created_by      VARCHAR(20) REFERENCES m_user_profile(u_code),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                            -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_tt_form_headers_type ON tt_form_headers(form_type);
CREATE INDEX IF NOT EXISTS idx_tt_form_headers_status ON tt_form_headers(status);
CREATE INDEX IF NOT EXISTS idx_tt_form_headers_pid ON tt_form_headers(pid_number);
CREATE INDEX IF NOT EXISTS idx_tt_form_headers_deleted ON tt_form_headers(deleted_at);

-- ============================================================================
-- 2. Control Plan Rows
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_control_plan_rows (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    
    operation           TEXT,
    process_function    TEXT,
    machine_device      TEXT,
    char_dwg_no         TEXT,
    char_product        TEXT,
    char_process        TEXT,
    special_class       TEXT,
    method_requirements TEXT,
    method_evaluation   TEXT,
    sample_size         TEXT,
    sample_freq         TEXT,
    control_method      TEXT,
    reaction_plan       TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_cp_rows_header ON tt_control_plan_rows(form_header_id);

-- ============================================================================
-- 3. PFD (Process Flow Diagram) Rows
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_pfd_rows (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    
    process_no          TEXT,
    process_name        TEXT,
    sequence_number     TEXT,
    operation_desc      TEXT,
    product_char        TEXT,
    process_char        TEXT,
    kc_check            BOOLEAN DEFAULT FALSE,
    sp_check            BOOLEAN DEFAULT FALSE,
    manufacturing_site  TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_pfd_rows_header ON tt_pfd_rows(form_header_id);

-- ============================================================================
-- 4. PFMEA (Process FMEA) Rows
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_pfmea_rows (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    
    operation               TEXT,
    process_function        TEXT,
    requirements            TEXT,
    potential_failure_mode  TEXT,
    potential_effects       TEXT,
    severity_1              INTEGER,        -- S (1-10)
    potential_causes        TEXT,
    occurrence_1            INTEGER,        -- O (1-10)
    prevention_controls     TEXT,
    detection_controls      TEXT,
    detection_1             INTEGER,        -- D (1-10)
    rpn_1                   VARCHAR(5),     -- H/M/L
    recommended_action      TEXT,
    responsibility          TEXT,
    actions_taken           TEXT,
    severity_2              INTEGER,
    occurrence_2            INTEGER,
    detection_2             INTEGER,
    rpn_2                   VARCHAR(5),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_pfmea_rows_header ON tt_pfmea_rows(form_header_id);

-- ============================================================================
-- 5. PDR (Product Design Review) Rows
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_pdr_rows (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    
    priority            INTEGER,            -- 1, 2, or 3
    document_no         TEXT,
    revision            TEXT,
    title               TEXT,
    applied             VARCHAR(10),        -- 'Yes', 'No', 'N/A'
    approval            TEXT,
    register            TEXT,
    remark              TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_pdr_rows_header ON tt_pdr_rows(form_header_id);

-- ============================================================================
-- 6. PID Form Data (single-row per form, not a table of rows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_pid_form_data (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL UNIQUE REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    
    category        VARCHAR(10),            -- opt1..opt5
    phase_checks    JSONB DEFAULT '{}',     -- { "phase1": [true, false, true], ... }
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. Form Audit Trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_form_audit_trail (
    id              SERIAL PRIMARY KEY,
    form_header_id  INTEGER NOT NULL REFERENCES tt_form_headers(id) ON DELETE CASCADE,
    table_name      VARCHAR(50) NOT NULL,       -- e.g. 'tt_control_plan_rows'
    row_id          INTEGER,                     -- ID of the modified row (NULL for header changes)
    column_name     VARCHAR(100) NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    changed_by      VARCHAR(20) REFERENCES m_user_profile(u_code),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_audit_header ON tt_form_audit_trail(form_header_id);
CREATE INDEX IF NOT EXISTS idx_tt_audit_changed_at ON tt_form_audit_trail(changed_at);

-- ============================================================================
-- 8. User Stamps (linked to m_user_profile)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_user_stamps (
    id              SERIAL PRIMARY KEY,
    em_id           VARCHAR(20) NOT NULL REFERENCES m_user_profile(u_code),
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    department      VARCHAR(50),
    stamp_image     BYTEA,                  -- Binary stamp image
    signature_image BYTEA,                  -- Binary signature image
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(em_id)
);

-- ============================================================================
-- 9. Calculator Usage Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS tt_calc_usage_log (
    id              SERIAL PRIMARY KEY,
    calc_type       VARCHAR(50) NOT NULL CHECK (calc_type IN ('geometric_radius', 'area_volume', 'rpn_lookup')),
    used_by         VARCHAR(20) REFERENCES m_user_profile(u_code),
    input_params    JSONB,
    results         JSONB,
    used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tt_calc_log_type ON tt_calc_usage_log(calc_type);
CREATE INDEX IF NOT EXISTS idx_tt_calc_log_user ON tt_calc_usage_log(used_by);

-- ============================================================================
-- Trigger: Auto-update updated_at on tt_form_headers
-- ============================================================================
CREATE OR REPLACE FUNCTION tt_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tt_form_headers_updated ON tt_form_headers;
CREATE TRIGGER trg_tt_form_headers_updated
    BEFORE UPDATE ON tt_form_headers
    FOR EACH ROW
    EXECUTE FUNCTION tt_update_timestamp();

DROP TRIGGER IF EXISTS trg_tt_pid_form_data_updated ON tt_pid_form_data;
CREATE TRIGGER trg_tt_pid_form_data_updated
    BEFORE UPDATE ON tt_pid_form_data
    FOR EACH ROW
    EXECUTE FUNCTION tt_update_timestamp();
