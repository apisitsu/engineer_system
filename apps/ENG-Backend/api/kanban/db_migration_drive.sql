-- ═══════════════════════════════════════════════════════════════════
-- db_migration_drive.sql
-- Add Google Drive metadata columns to kb_attachment table
-- Run: psql -h plbmp130 -p 6543 -U eng_admin -d eng_system -f db_migration_drive.sql
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Google Drive File ID (returned by GAS after upload)
ALTER TABLE kb_attachment ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);

-- 2. Drive folder path for reference (e.g., "/12/45/89")
ALTER TABLE kb_attachment ADD COLUMN IF NOT EXISTS drive_folder_path VARCHAR(512);

-- 3. Index for fast lookups during migration and deletion
CREATE INDEX IF NOT EXISTS idx_kb_attachment_drive_file_id ON kb_attachment(drive_file_id);

-- 4. Index for finding un-migrated records
CREATE INDEX IF NOT EXISTS idx_kb_attachment_drive_null ON kb_attachment(drive_file_id) WHERE drive_file_id IS NULL;

COMMIT;
