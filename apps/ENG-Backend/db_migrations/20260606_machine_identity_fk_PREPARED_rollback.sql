-- ============================================================================
-- ROLLBACK for 20260606_machine_identity_fk_PREPARED.sql
-- ----------------------------------------------------------------------------
-- Drops the FK constraints, indexes, and id columns added by the forward script.
-- Safe to run repeatedly (IF EXISTS guards). Run BEFORE reverting any code that
-- reads machine_type_id.
-- ============================================================================

BEGIN;

ALTER TABLE sds_machine_tool  DROP CONSTRAINT IF EXISTS fk_smt_type;
ALTER TABLE sds_parameter     DROP CONSTRAINT IF EXISTS fk_sp_type;
ALTER TABLE sds_excel_mapping DROP CONSTRAINT IF EXISTS fk_sem_type;

DROP INDEX IF EXISTS idx_smt_type_id;
DROP INDEX IF EXISTS idx_sp_type_id;
DROP INDEX IF EXISTS idx_sem_type_id;

ALTER TABLE sds_machine_tool  DROP COLUMN IF EXISTS machine_type_id;
ALTER TABLE sds_parameter     DROP COLUMN IF EXISTS machine_type_id;
ALTER TABLE sds_excel_mapping DROP COLUMN IF EXISTS machine_type_id;

-- If step 5 (tooling_machine link) was applied:
ALTER TABLE tooling_machine   DROP CONSTRAINT IF EXISTS tooling_machine_sds_machine_type_id_fkey;
ALTER TABLE tooling_machine   DROP COLUMN IF EXISTS sds_machine_type_id;

COMMIT;
