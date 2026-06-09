-- ============================================================================
-- ROLLBACK for 20260606_fix_sds_machine_tool_orphans.sql
-- ----------------------------------------------------------------------------
-- Reverts the typo fix: restores 'HIGRIND-1-D' on the exact rows that were
-- changed (ids 4 and 5 — the only sds_machine_tool rows that held the typo).
-- Targeting by id makes this exact even if other 'HI-GRIND-1-D' rows exist.
-- ============================================================================

BEGIN;

UPDATE sds_machine_tool
   SET machine_type = 'HIGRIND-1-D'
 WHERE id IN (4, 5)
   AND machine_type = 'HI-GRIND-1-D';
-- expected: 2 rows

COMMIT;
