-- ============================================================================
-- #4 Machine Identity SSOT — surrogate-id FK  (FINAL — prerequisites met)
-- ----------------------------------------------------------------------------
-- Prereqs verified 2026-06-06: no orphan names, no ambiguous names, no
-- inactive-only names. Backfill coverage: sds_machine_tool 81/81,
-- sds_parameter 1362/1362, sds_excel_mapping 0/121 (all 121 are NULL-name =
-- shared layouts → machine_type_id stays NULL by design).
--
-- Adds a nullable integer FK machine_type_id → sds_machine_type_code.id on the
-- three satellites, backfills it, and installs a BEFORE INSERT/UPDATE trigger so
-- the column stays correct on every future write WITHOUT any app-code change
-- (resolves from the existing name column → the active master row). This gives
-- referential integrity (FK: can't reference a missing master; ON DELETE
-- RESTRICT: can't delete a referenced master) while leaving all existing
-- name-based queries untouched.
--
-- Kept NULLABLE (not NOT NULL): a tool/param may legitimately be entered before
-- its master row exists (see the GS-64PF lesson); FK still rejects a *wrong* id.
--
-- Transactional. Rollback: 20260606_machine_identity_fk_rollback.sql
-- ============================================================================

BEGIN;

-- 1. Columns ------------------------------------------------------------------
ALTER TABLE sds_machine_tool  ADD COLUMN IF NOT EXISTS machine_type_id integer;
ALTER TABLE sds_parameter     ADD COLUMN IF NOT EXISTS machine_type_id integer;
ALTER TABLE sds_excel_mapping ADD COLUMN IF NOT EXISTS machine_type_id integer;

-- 2. Backfill from the (unique) active master --------------------------------
UPDATE sds_machine_tool  s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type AND c.is_active;
UPDATE sds_parameter     s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type_name AND c.is_active;
UPDATE sds_excel_mapping s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type_name AND c.is_active;

-- 3. FK constraints (NOT VALID then VALIDATE = minimal locking) ---------------
ALTER TABLE sds_machine_tool  ADD CONSTRAINT fk_smt_type
  FOREIGN KEY (machine_type_id) REFERENCES sds_machine_type_code(id)
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE sds_parameter     ADD CONSTRAINT fk_sp_type
  FOREIGN KEY (machine_type_id) REFERENCES sds_machine_type_code(id)
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE sds_excel_mapping ADD CONSTRAINT fk_sem_type
  FOREIGN KEY (machine_type_id) REFERENCES sds_machine_type_code(id)
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE sds_machine_tool  VALIDATE CONSTRAINT fk_smt_type;
ALTER TABLE sds_parameter     VALIDATE CONSTRAINT fk_sp_type;
ALTER TABLE sds_excel_mapping VALIDATE CONSTRAINT fk_sem_type;

-- 4. Indexes on the FK columns ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_smt_type_id ON sds_machine_tool  (machine_type_id);
CREATE INDEX IF NOT EXISTS idx_sp_type_id  ON sds_parameter     (machine_type_id);
CREATE INDEX IF NOT EXISTS idx_sem_type_id ON sds_excel_mapping (machine_type_id);

-- 5. Self-maintaining trigger -------------------------------------------------
-- Resolves machine_type_id from the row's name column (passed as TG_ARGV[0])
-- to the active master on every INSERT/UPDATE. NULL name → NULL id (shared
-- layout). Keeps the FK column correct with zero app-code changes.
CREATE OR REPLACE FUNCTION sds_set_machine_type_id() RETURNS trigger AS $fn$
DECLARE
  nm text;
BEGIN
  nm := row_to_json(NEW) ->> TG_ARGV[0];
  IF nm IS NULL OR btrim(nm) = '' THEN
    NEW.machine_type_id := NULL;
  ELSE
    SELECT id INTO NEW.machine_type_id
      FROM sds_machine_type_code
     WHERE machine_type_name = nm AND is_active
     ORDER BY machine_type_code
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_smt_set_type_id ON sds_machine_tool;
CREATE TRIGGER trg_smt_set_type_id BEFORE INSERT OR UPDATE ON sds_machine_tool
  FOR EACH ROW EXECUTE FUNCTION sds_set_machine_type_id('machine_type');

DROP TRIGGER IF EXISTS trg_sp_set_type_id ON sds_parameter;
CREATE TRIGGER trg_sp_set_type_id BEFORE INSERT OR UPDATE ON sds_parameter
  FOR EACH ROW EXECUTE FUNCTION sds_set_machine_type_id('machine_type_name');

DROP TRIGGER IF EXISTS trg_sem_set_type_id ON sds_excel_mapping;
CREATE TRIGGER trg_sem_set_type_id BEFORE INSERT OR UPDATE ON sds_excel_mapping
  FOR EACH ROW EXECUTE FUNCTION sds_set_machine_type_id('machine_type_name');

COMMIT;
