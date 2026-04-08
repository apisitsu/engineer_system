-- =================================================================
--  Migration: Missing SQLite Tables to PostgreSQL
--  Run this to add tables that were previously only in SQLite
-- =================================================================

-- 1. Add missing columns to m_user_profile
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_name VARCHAR(255);
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_pass TEXT;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_department VARCHAR(50);
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS user_group VARCHAR(50);
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_status INTEGER DEFAULT 1;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS u_authority INTEGER DEFAULT 4;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS section INTEGER;
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS create_d TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS update_d TIMESTAMPTZ DEFAULT NOW();

-- 2. CREATE ecr_request (from test.db)
CREATE TABLE IF NOT EXISTS ecr_request (
    id BIGSERIAL PRIMARY KEY,
    ecr_no VARCHAR(50) UNIQUE NOT NULL,
    request_date TIMESTAMPTZ,
    req_by VARCHAR(50),
    department VARCHAR(50),
    detail TEXT,
    reason TEXT,
    effect_to TEXT,
    part_no TEXT,
    part_name TEXT,
    model TEXT,
    file_path TEXT,
    status VARCHAR(20) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE tool_requests & workflow (from tool_req.db)
CREATE TABLE IF NOT EXISTS tr_request (
    id BIGSERIAL PRIMARY KEY,
    req_no VARCHAR(50) UNIQUE NOT NULL,
    req_date TIMESTAMPTZ DEFAULT NOW(),
    req_by VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    detail TEXT,
    purpose TEXT,
    qty INT DEFAULT 1,
    unit VARCHAR(20),
    expected_date TIMESTAMPTZ,
    file_path TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    priority VARCHAR(20) DEFAULT 'Normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tr_workflow (
    id BIGSERIAL PRIMARY KEY,
    req_id BIGINT REFERENCES tr_request(id) ON DELETE CASCADE,
    step_no INT NOT NULL,
    action_by VARCHAR(50),
    action_date TIMESTAMPTZ DEFAULT NOW(),
    action_type VARCHAR(50),
    comment TEXT,
    status VARCHAR(50)
);

-- 4. CREATE tooling tables (from test.db)
CREATE TABLE IF NOT EXISTS ti_list (
    id BIGSERIAL PRIMARY KEY,
    part_number VARCHAR(100),
    tool_number VARCHAR(100),
    inspect_date TIMESTAMPTZ,
    inspector VARCHAR(50),
    result VARCHAR(20),
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ti_dwg_job (
    id BIGSERIAL PRIMARY KEY,
    req_no VARCHAR(50) UNIQUE NOT NULL,
    req_date TIMESTAMPTZ,
    req_by VARCHAR(50),
    tool_number VARCHAR(100),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    file_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ti_return (
    id BIGSERIAL PRIMARY KEY,
    return_no VARCHAR(50) UNIQUE NOT NULL,
    part_number VARCHAR(100),
    tool_number VARCHAR(100),
    qty INT DEFAULT 1,
    return_by VARCHAR(50),
    return_date TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    condition VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wc_code (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays_date (
    id BIGSERIAL PRIMARY KEY,
    holiday_date DATE UNIQUE NOT NULL,
    description VARCHAR(255),
    is_workday BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at_extra()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ecr_request', 'tr_request', 'ti_list',
    'ti_dwg_job', 'ti_return', 'wc_code', 'holidays_date'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = format('trg_%s_updated_at', tbl)
    ) THEN
      EXECUTE format('
        CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_extra();
      ', tbl, tbl);
    END IF;
  END LOOP;
END;
$$;

