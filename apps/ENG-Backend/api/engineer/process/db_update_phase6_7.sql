-- ==========================================
-- ECR/ECN System Database Updates (Phases 6 & 7)
-- ==========================================

-- 1. Phase 6: Tasks Management Table (Step 3.5 & 3.6)
CREATE TABLE IF NOT EXISTS ecnt_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecr_id UUID REFERENCES ecnt_document(id) ON DELETE CASCADE,
    dept_name VARCHAR(100),
    task_detail TEXT,
    is_checked BOOLEAN DEFAULT false,
    checked_by VARCHAR(100),
    checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Phase 6: Notifications & Action Tracking Table
CREATE TABLE IF NOT EXISTS ecnt_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecr_id UUID REFERENCES ecnt_document(id) ON DELETE CASCADE,
    step VARCHAR(50),
    action_by VARCHAR(100),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Phase 7: Assigned To (ENG Department) for Step 3.1
ALTER TABLE ecnt_document ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100);
