-- Migration to create tt_pdf_usage_logs table for tracking PDF workstation usage

CREATE TABLE IF NOT EXISTS tt_pdf_usage_logs (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    empno VARCHAR(50) NOT NULL,
    user_name VARCHAR(255),
    total_pages INTEGER DEFAULT 1,
    action_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster querying by user or date
CREATE INDEX IF NOT EXISTS idx_pdf_usage_logs_empno ON tt_pdf_usage_logs(empno);
CREATE INDEX IF NOT EXISTS idx_pdf_usage_logs_created_at ON tt_pdf_usage_logs(created_at);
