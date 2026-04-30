-- ═══════════════════════════════════════════════════════════════
-- Blueprint & Selective Cloning — Template Configuration Table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kb_template_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                    -- e.g., 'Fast-track ECR', 'Standard ECR Template'
    master_project_id INT NOT NULL REFERENCES kb_project(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL DEFAULT '{}',       -- { board_ids: [], list_ids: [], card_ids: [], task_ids: [] }
    created_by VARCHAR(50),                        -- u_code of creator
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by master project
CREATE INDEX IF NOT EXISTS idx_kb_template_config_master ON kb_template_config(master_project_id);
