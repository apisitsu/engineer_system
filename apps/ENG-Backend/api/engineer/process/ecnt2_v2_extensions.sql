-- ECNT V2 Database Schema Extensions: Discussions, Stage History, Gantt Support & Field Audit

-- 1. Threaded Discussions & Problem Investigation
CREATE TABLE IF NOT EXISTS ecnt2_discussion (
    id              SERIAL PRIMARY KEY,
    document_type   VARCHAR(3) NOT NULL,            -- 'ECR' | 'ECN'
    document_id     INTEGER NOT NULL,
    stage_key       VARCHAR(50),                    -- e.g. 'STAGE_2_R1', 'BLOCK_5_IMPACT'
    category        VARCHAR(30) DEFAULT 'GENERAL',  -- 'CLARIFICATION' | 'REVISION_RESPONSE' | 'QUESTION' | 'ISSUE' | 'GENERAL'
    author_empno    VARCHAR(50) NOT NULL,
    author_name     VARCHAR(200) NOT NULL,
    author_dept     VARCHAR(100),
    author_role     VARCHAR(100),
    message         TEXT NOT NULL,
    attachments     JSONB DEFAULT '[]'::jsonb,      -- Array of { file_name, file_url, file_type, file_size }
    parent_id       INTEGER REFERENCES ecnt2_discussion(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_disc_doc ON ecnt2_discussion(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_ecnt2_disc_parent ON ecnt2_discussion(parent_id);

-- 2. Stage Progression & Gantt Interval History
CREATE TABLE IF NOT EXISTS ecnt2_stage_history (
    id              SERIAL PRIMARY KEY,
    document_type   VARCHAR(3) NOT NULL,            -- 'ECR' | 'ECN'
    document_id     INTEGER NOT NULL,
    stage_code      VARCHAR(50) NOT NULL,           -- e.g. 'STAGE_1', 'STAGE_2', 'STAGE_2_R1', etc.
    stage_title     VARCHAR(200) NOT NULL,          -- e.g. 'Stage 2-R1: Dept Mgr Clarification'
    stage_type      VARCHAR(30) NOT NULL,           -- 'STANDARD' | 'RETURN_LOOP' | 'DECISION' | 'CONCERN_PARALLEL'
    assigned_role   VARCHAR(100),
    assigned_dept   VARCHAR(100),
    assigned_pic    VARCHAR(200),
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP,
    duration_hours  NUMERIC(10, 2),
    status          VARCHAR(30) DEFAULT 'ACTIVE',   -- 'ACTIVE' | 'COMPLETED' | 'RETURNED' | 'SKIPPED'
    action_taken    VARCHAR(50),                    -- 'SUBMIT' | 'APPROVE' | 'REQUEST_MORE_DETAIL' | 'RESUBMIT' | 'DENY' | 'CLOSE'
    action_by       VARCHAR(100),
    action_by_name  VARCHAR(200),
    notes           TEXT,
    return_target   VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_stage_doc ON ecnt2_stage_history(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_ecnt2_stage_code ON ecnt2_stage_history(stage_code);

-- 3. Field-Level Audit Trail (Data Modification History)
CREATE TABLE IF NOT EXISTS ecnt2_field_audit (
    id              SERIAL PRIMARY KEY,
    document_type   VARCHAR(3) NOT NULL,            -- 'ECR' | 'ECN'
    document_id     INTEGER NOT NULL,
    stage_code      VARCHAR(50),
    field_name      VARCHAR(100) NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    modified_by     VARCHAR(100) NOT NULL,
    modified_by_name VARCHAR(200),
    modified_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ecnt2_audit_doc ON ecnt2_field_audit(document_type, document_id);

-- 4. Alter ecnt2_ecr & ecnt2_ecn to support current_stage_code and SLA milestones
ALTER TABLE ecnt2_ecr ADD COLUMN IF NOT EXISTS current_stage_code VARCHAR(50) DEFAULT 'STAGE_2';
ALTER TABLE ecnt2_ecr ADD COLUMN IF NOT EXISTS target_effective_date TIMESTAMP;
ALTER TABLE ecnt2_ecr ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0;

ALTER TABLE ecnt2_ecn ADD COLUMN IF NOT EXISTS current_stage_code VARCHAR(50) DEFAULT 'STAGE_5';
ALTER TABLE ecnt2_ecn ADD COLUMN IF NOT EXISTS target_effective_date TIMESTAMP;
ALTER TABLE ecnt2_ecn ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0;
