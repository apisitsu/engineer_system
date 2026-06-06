-- ============================================================================
-- #4 Phase 0 — Fix orphaned machine names in sds_machine_tool (engPool)
-- ----------------------------------------------------------------------------
-- Orphans found by diagnostics B1 (sds_machine_tool.machine_type with no
-- matching sds_machine_type_code.machine_type_name):
--
--   'HIGRIND-1-D' (ids 4,5)   → typo of master 'HI-GRIND-1-D' (missing hyphen).
--                               These 2 rows are currently DEAD: PDF queries
--                               sds_machine_tool by the exact type name, so they
--                               never match. Renaming activates them correctly.
--   'GS-64PF'     (ids 70-73) → NO master row exists. NOT fixed here — needs the
--                               owner to add a sds_machine_type_code entry (its
--                               machine_type_code is unknown). Left as-is.
--
-- Transactional. Rollback: 20260606_fix_sds_machine_tool_orphans_rollback.sql
-- ============================================================================

BEGIN;

UPDATE sds_machine_tool
   SET machine_type = 'HI-GRIND-1-D'
 WHERE machine_type = 'HIGRIND-1-D';
-- expected: 2 rows

-- Safety check — must be 0 after the update
DO $$
DECLARE remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM sds_machine_tool WHERE machine_type = 'HIGRIND-1-D';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'HIGRIND-1-D still present (%) — aborting', remaining;
  END IF;
END $$;

COMMIT;
