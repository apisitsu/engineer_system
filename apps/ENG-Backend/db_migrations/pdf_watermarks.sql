-- Migration to create tables for the PDF Watermark system

-- 1. Table for Watermark Templates
CREATE TABLE IF NOT EXISTS tt_pdf_watermarks (
    id SERIAL PRIMARY KEY,
    owner_empno VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    opacity FLOAT DEFAULT 0.3,
    font_size INTEGER DEFAULT 48,
    angle INTEGER DEFAULT 45,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fetching a user's owned watermarks
CREATE INDEX IF NOT EXISTS idx_pdf_watermarks_owner ON tt_pdf_watermarks(owner_empno);

-- 2. Table for Watermark Sharing
CREATE TABLE IF NOT EXISTS tt_pdf_watermark_shares (
    watermark_id INTEGER REFERENCES tt_pdf_watermarks(id) ON DELETE CASCADE,
    shared_with_empno VARCHAR(50) NOT NULL,
    PRIMARY KEY (watermark_id, shared_with_empno)
);

-- Index for fetching watermarks shared with a user
CREATE INDEX IF NOT EXISTS idx_pdf_watermark_shares_empno ON tt_pdf_watermark_shares(shared_with_empno);

-- 3. Migration V2 — Additional watermark template settings
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS repeat_mode BOOLEAN DEFAULT false;
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS repeat_gap INTEGER DEFAULT 100;
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS font_family VARCHAR(50) DEFAULT 'Helvetica';
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS font_weight VARCHAR(20) DEFAULT 'normal';
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS font_style VARCHAR(20) DEFAULT 'normal';
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS position_preset VARCHAR(20) DEFAULT 'center';
ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS repeat_style VARCHAR(20) DEFAULT 'full';
