-- Tool Request Workflow Migration
-- Aligns tr_request + tr_workflow with new workflow system

-- ── tr_request: add new columns ──────────────────────────────────────────────
ALTER TABLE tr_request
  ADD COLUMN IF NOT EXISTS request_item   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS requester      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS requester_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS work_center    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS work_center_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS type_of_request VARCHAR(50),
  ADD COLUMN IF NOT EXISTS category       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS drawing_required VARCHAR(50),
  ADD COLUMN IF NOT EXISTS type_of_drawing  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS machine_no     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS machine_name   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS req_due_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_stage  VARCHAR(50) DEFAULT 'Eng Check';

-- backfill current_stage for existing rows
UPDATE tr_request SET current_stage = 'Eng Check' WHERE current_stage IS NULL;

-- ── tr_workflow: add new columns ──────────────────────────────────────────────
ALTER TABLE tr_workflow
  ADD COLUMN IF NOT EXISTS stage_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- backfill created_at from action_date for existing rows
UPDATE tr_workflow SET created_at = action_date WHERE created_at IS NULL;
