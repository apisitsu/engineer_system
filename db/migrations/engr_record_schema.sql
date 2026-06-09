-- ============================================================
-- Engineer Record Module Schema
-- Table prefix: engr_ (Engineer Record)
-- Migration: Rod End Request Record (Excel → PostgreSQL)
-- ============================================================

-- Main records table
CREATE TABLE IF NOT EXISTS engr_record (
    id              SERIAL PRIMARY KEY,
    record_no       INTEGER NOT NULL,
    request_date    DATE NOT NULL,
    request_by      VARCHAR(50) NOT NULL DEFAULT 'PC/MC',
    lot_no          VARCHAR(30),
    cn              VARCHAR(30),
    pn              VARCHAR(80),
    plant           VARCHAR(30),
    case_type       VARCHAR(50) NOT NULL,
    spec_problem    TEXT,
    judge_revise    TEXT,
    reason          TEXT,
    judgment_by     VARCHAR(100),
    finish_date     DATE,
    plan_start_date DATE,
    remark          TEXT,
    responsible     VARCHAR(150),
    confirm_codi    VARCHAR(80),
    comment         TEXT,
    ts_flag         VARCHAR(30),

    -- Audit
    created_by      VARCHAR(20),
    updated_by      VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    -- For data sync dedup
    source_hash     VARCHAR(64),
    sync_batch_id   VARCHAR(50),

    CONSTRAINT uq_engr_record_no UNIQUE (record_no)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_engr_record_date ON engr_record (request_date);
CREATE INDEX IF NOT EXISTS idx_engr_record_case ON engr_record (case_type);
CREATE INDEX IF NOT EXISTS idx_engr_record_lot ON engr_record (lot_no);
CREATE INDEX IF NOT EXISTS idx_engr_record_cn ON engr_record (cn);
CREATE INDEX IF NOT EXISTS idx_engr_record_responsible ON engr_record (responsible);
CREATE INDEX IF NOT EXISTS idx_engr_record_finish ON engr_record (finish_date);
CREATE INDEX IF NOT EXISTS idx_engr_record_created ON engr_record (created_at);

-- Monthly summary cache (pre-computed KPIs for dashboard)
CREATE TABLE IF NOT EXISTS engr_monthly_summary (
    id              SERIAL PRIMARY KEY,
    year            INTEGER NOT NULL,
    month_num       INTEGER NOT NULL,
    total_lots      INTEGER DEFAULT 0,
    case_request_drawing     INTEGER DEFAULT 0,
    case_judgment_spec       INTEGER DEFAULT 0,
    case_change_dwg          INTEGER DEFAULT 0,
    case_dwg_problem         INTEGER DEFAULT 0,
    case_special             INTEGER DEFAULT 0,
    waiting_count            INTEGER DEFAULT 0,
    finished_count           INTEGER DEFAULT 0,
    waiting_on_due           INTEGER DEFAULT 0,
    waiting_pass_due         INTEGER DEFAULT 0,
    already_pass_due         INTEGER DEFAULT 0,
    finish_on_due            INTEGER DEFAULT 0,
    finish_pass_due          INTEGER DEFAULT 0,
    avg_finish_days          NUMERIC(8,2) DEFAULT 0,
    avg_drawing_days         NUMERIC(8,2) DEFAULT 0,
    max_finish_days          NUMERIC(8,2) DEFAULT 0,
    max_waiting_days         NUMERIC(8,2) DEFAULT 0,
    blue_tag_0_1_day         INTEGER DEFAULT 0,
    blue_tag_lt_1_week       INTEGER DEFAULT 0,
    pass_due_remark          TEXT,
    computed_at              TIMESTAMP DEFAULT NOW(),

    CONSTRAINT uq_engr_summary_year_month UNIQUE (year, month_num)
);

-- Sync log for data import tracking
CREATE TABLE IF NOT EXISTS engr_sync_log (
    id              SERIAL PRIMARY KEY,
    batch_id        VARCHAR(50) NOT NULL,
    file_name       VARCHAR(255),
    file_hash       VARCHAR(64),
    records_total   INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending',
    error_message   TEXT,
    started_at      TIMESTAMP DEFAULT NOW(),
    completed_at    TIMESTAMP
);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION engr_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_engr_record_updated_at ON engr_record;
CREATE TRIGGER trg_engr_record_updated_at
    BEFORE UPDATE ON engr_record
    FOR EACH ROW
    EXECUTE FUNCTION engr_set_updated_at();
