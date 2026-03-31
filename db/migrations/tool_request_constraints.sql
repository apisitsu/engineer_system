-- ============================================================================
-- Tool Request Workflow - Database Constraints & Indexes Migration
-- Purpose: Add data integrity constraints and performance indexes
-- Date: 2026-03-31
-- ============================================================================

BEGIN;

-- ── 1. UNIQUE CONSTRAINTS ────────────────────────────────────────────────────

-- Ensure request_item is unique (business identifier)
ALTER TABLE tr_request 
  ADD CONSTRAINT tr_request_request_item_unique 
  UNIQUE (request_item);

-- Ensure req_no is unique when not null (official request number)
ALTER TABLE tr_request 
  ADD CONSTRAINT tr_request_req_no_unique 
  UNIQUE (req_no);

-- ── 2. FOREIGN KEY CONSTRAINTS ──────────────────────────────────────────────

-- Link workflow records to requests with cascade delete
ALTER TABLE tr_workflow 
  ADD CONSTRAINT fk_tr_workflow_req_id 
  FOREIGN KEY (req_id) 
  REFERENCES tr_request(id) 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

-- ── 3. CHECK CONSTRAINTS ────────────────────────────────────────────────────

-- Ensure status has valid values
ALTER TABLE tr_request
  ADD CONSTRAINT chk_tr_request_status 
  CHECK (status IN (
    'Pending Eng Check',
    'Pending Draft Man',
    'Pending DWG Check',
    'Pending Eng Review',
    'Pending Eng Approve',
    'Pending Eng Inform',
    'Completed & Informed',
    'Denied',
    'Denied by Approve',
    'Complete'  -- Legacy status
  ));

-- Ensure current_stage has valid values
ALTER TABLE tr_request
  ADD CONSTRAINT chk_tr_request_current_stage 
  CHECK (current_stage IN (
    'Eng Check',
    'Draft Man',
    'DWG Check',
    'Eng Review',
    'Eng Approve',
    'Eng Inform'
  ));

-- Ensure workflow action_type is valid
ALTER TABLE tr_workflow
  ADD CONSTRAINT chk_tr_workflow_action_type 
  CHECK (action_type IN ('approve', 'deny', 'submit'));

-- Ensure step_no is positive
ALTER TABLE tr_workflow
  ADD CONSTRAINT chk_tr_workflow_step_no 
  CHECK (step_no > 0 AND step_no <= 10);

-- ── 4. NOT NULL CONSTRAINTS ─────────────────────────────────────────────────

-- Essential fields should not be null
ALTER TABLE tr_request 
  ALTER COLUMN requester SET NOT NULL,
  ALTER COLUMN department SET NOT NULL,
  ALTER COLUMN type_of_request SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN detail SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN current_stage SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- Workflow essential fields
ALTER TABLE tr_workflow 
  ALTER COLUMN req_id SET NOT NULL,
  ALTER COLUMN step_no SET NOT NULL,
  ALTER COLUMN action_type SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

-- ── 5. PERFORMANCE INDEXES ──────────────────────────────────────────────────

-- Index on request_item for fast lookups
CREATE INDEX IF NOT EXISTS idx_tr_request_request_item 
  ON tr_request(request_item);

-- Index on req_no for fast lookups
CREATE INDEX IF NOT EXISTS idx_tr_request_req_no 
  ON tr_request(req_no);

-- Composite index on status + created_at for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tr_request_status_created 
  ON tr_request(status, created_at DESC);

-- Index on requester for user-specific queries
CREATE INDEX IF NOT EXISTS idx_tr_request_requester 
  ON tr_request(requester);

-- Index on department for department-specific queries
CREATE INDEX IF NOT EXISTS idx_tr_request_department 
  ON tr_request(department);

-- Index on req_due_date for overdue detection
CREATE INDEX IF NOT EXISTS idx_tr_request_due_date 
  ON tr_request(req_due_date) 
  WHERE status NOT IN ('Completed & Informed', 'Denied', 'Denied by Approve');

-- Index on workflow req_id for fast joins
CREATE INDEX IF NOT EXISTS idx_tr_workflow_req_id 
  ON tr_workflow(req_id);

-- Index on workflow stage_name for stage-based queries
CREATE INDEX IF NOT EXISTS idx_tr_workflow_stage_name 
  ON tr_workflow(stage_name);

-- Index on workflow action_by for user activity tracking
CREATE INDEX IF NOT EXISTS idx_tr_workflow_action_by 
  ON tr_workflow(action_by);

-- Composite index for workflow ordering
CREATE INDEX IF NOT EXISTS idx_tr_workflow_req_created 
  ON tr_workflow(req_id, created_at DESC);

-- ── 6. TRIGGER FOR UPDATED_AT ───────────────────────────────────────────────

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to tr_request
DROP TRIGGER IF EXISTS tr_request_update_updated_at ON tr_request;
CREATE TRIGGER tr_request_update_updated_at
    BEFORE UPDATE ON tr_request
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── 7. TRIGGER FOR AUDIT LOGGING ────────────────────────────────────────────

-- Create audit log table if not exists
CREATE TABLE IF NOT EXISTS tr_request_audit (
    id SERIAL PRIMARY KEY,
    req_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB
);

-- Index on audit table for fast lookups
CREATE INDEX IF NOT EXISTS idx_tr_request_audit_req_id 
  ON tr_request_audit(req_id);

CREATE INDEX IF NOT EXISTS idx_tr_request_audit_changed_at 
  ON tr_request_audit(changed_at DESC);

-- Function to log changes
CREATE OR REPLACE FUNCTION log_tr_request_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO tr_request_audit (req_id, action, changed_by, old_data, new_data)
        VALUES (NEW.id, 'INSERT', current_setting('app.current_user', TRUE), NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO tr_request_audit (req_id, action, changed_by, old_data, new_data)
        VALUES (NEW.id, 'UPDATE', current_setting('app.current_user', TRUE), to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO tr_request_audit (req_id, action, changed_by, old_data, new_data)
        VALUES (OLD.id, 'DELETE', current_setting('app.current_user', TRUE), to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for audit logging
DROP TRIGGER IF EXISTS tr_request_audit_changes ON tr_request;
CREATE TRIGGER tr_request_audit_changes
    AFTER INSERT OR UPDATE OR DELETE ON tr_request
    FOR EACH ROW
    EXECUTE FUNCTION log_tr_request_changes();

-- ── 8. COMMENTS FOR DOCUMENTATION ───────────────────────────────────────────

COMMENT ON TABLE tr_request IS 'Main table for General DWG Request system - stores request records';
COMMENT ON TABLE tr_workflow IS 'Workflow history table - tracks all actions on requests through 6 stages';
COMMENT ON TABLE tr_request_audit IS 'Audit log for tr_request table - tracks all changes for compliance';

COMMENT ON COLUMN tr_request.request_item IS 'Auto-generated item number: ITEM-YYYYMMDD-XXX';
COMMENT ON COLUMN tr_request.req_no IS 'Official request number assigned during Eng Check stage';
COMMENT ON COLUMN tr_request.current_stage IS 'Current workflow stage: Eng Check, Draft Man, DWG Check, Eng Review, Eng Approve, Eng Inform';
COMMENT ON COLUMN tr_request.status IS 'Current status of the request';
COMMENT ON COLUMN tr_request.req_due_date IS 'Due date calculated based on request type (excludes weekends)';

COMMENT ON COLUMN tr_workflow.req_id IS 'Foreign key to tr_request(id)';
COMMENT ON COLUMN tr_workflow.step_no IS 'Workflow step number (1-6) corresponding to stages';
COMMENT ON COLUMN tr_workflow.action_type IS 'Action taken: approve, deny, submit';
COMMENT ON COLUMN tr_workflow.extra_data IS 'JSONB field storing stage-specific data (files, comments, etc.)';

-- ── 9. GRANT PERMISSIONS (adjust as needed) ─────────────────────────────────

-- Grant permissions to eng_admin (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tr_request TO eng_admin;
-- GRANT SELECT, INSERT ON tr_workflow TO eng_admin;
-- GRANT SELECT ON tr_request_audit TO eng_admin;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eng_admin;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
