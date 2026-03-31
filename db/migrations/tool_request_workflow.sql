-- Tool Request Workflow Migration
-- Aligns tr_request + tr_workflow with new workflow system

-- ── 1. tr_request: Add columns ──────────────────────────────────────────────
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

-- Backfill current_stage using dynamic SQL to avoid parse-time errors
DO $$ 
BEGIN 
    EXECUTE 'UPDATE tr_request SET current_stage = ''Eng Check'' WHERE current_stage IS NULL';
END $$;

-- ── 2. tr_workflow: Add columns ──────────────────────────────────────────────
ALTER TABLE tr_workflow
  ADD COLUMN IF NOT EXISTS stage_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill created_at from action_date safely using dynamic SQL
DO $$ 
BEGIN 
    -- Check if both source and destination columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tr_workflow' AND column_name='action_date') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tr_workflow' AND column_name='created_at') THEN
        
        -- Use EXECUTE to bypass compile-time column validation
        EXECUTE 'UPDATE tr_workflow SET created_at = action_date WHERE created_at IS NULL AND action_date IS NOT NULL';
        
    END IF;
END $$;
