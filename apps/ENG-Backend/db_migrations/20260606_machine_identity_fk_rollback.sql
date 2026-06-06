-- ============================================================================
-- ROLLBACK for 20260606_machine_identity_fk.sql
-- ----------------------------------------------------------------------------
-- Drops the triggers, function, FK constraints, indexes, and id columns.
-- Idempotent (IF EXISTS). Reverts the schema to its pre-migration state.
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_smt_set_type_id ON sds_machine_tool;
DROP TRIGGER IF EXISTS trg_sp_set_type_id  ON sds_parameter;
DROP TRIGGER IF EXISTS trg_sem_set_type_id ON sds_excel_mapping;
DROP FUNCTION IF EXISTS sds_set_machine_type_id();

ALTER TABLE sds_machine_tool  DROP CONSTRAINT IF EXISTS fk_smt_type;
ALTER TABLE sds_parameter     DROP CONSTRAINT IF EXISTS fk_sp_type;
ALTER TABLE sds_excel_mapping DROP CONSTRAINT IF EXISTS fk_sem_type;

DROP INDEX IF EXISTS idx_smt_type_id;
DROP INDEX IF EXISTS idx_sp_type_id;
DROP INDEX IF EXISTS idx_sem_type_id;

ALTER TABLE sds_machine_tool  DROP COLUMN IF EXISTS machine_type_id;
ALTER TABLE sds_parameter     DROP COLUMN IF EXISTS machine_type_id;
ALTER TABLE sds_excel_mapping DROP COLUMN IF EXISTS machine_type_id;

COMMIT;
