-- ═══════════════════════════════════════════════════════════════
-- Blueprint & Selective Cloning — Template Configuration Table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kb_template_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                    -- e.g., 'Fast-track ECR', 'Standard ECR Template'
    template_type VARCHAR(20) DEFAULT 'project',   -- 'project', 'card', 'list'
    master_project_id INT REFERENCES kb_project(id) ON DELETE CASCADE, -- Nullable for card/list templates
    config_data JSONB NOT NULL DEFAULT '{}',       -- Content schema varies by template_type
    master_project_name VARCHAR(255),              -- Snapshot of project name at creation time (fallback)
    created_by VARCHAR(50),                        -- u_code of creator
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by master project
CREATE INDEX IF NOT EXISTS idx_kb_template_config_master ON kb_template_config(master_project_id);

-- Migration: Add new columns if table already exists
ALTER TABLE kb_template_config ADD COLUMN IF NOT EXISTS master_project_name VARCHAR(255);
ALTER TABLE kb_template_config ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) DEFAULT 'project';
ALTER TABLE kb_template_config ALTER COLUMN master_project_id DROP NOT NULL;

-- Backfill existing records with the current project name
UPDATE kb_template_config t
SET master_project_name = p.name
FROM kb_project p
WHERE p.id = t.master_project_id
  AND t.master_project_name IS NULL;
