-- ============================================================================
-- #4 Phase 0b — dedupe machine types + retire junk (engPool) to unblock the FK
-- ----------------------------------------------------------------------------
-- A. HI-GRIND-1-D had 4 ACTIVE master rows (codes 507/519/520/521) and IS
--    referenced by sds_machine_tool → ambiguous backfill = the real FK blocker.
--    Keep the representative (lowest machine_type_code = 507, matches the PDF
--    `ORDER BY machine_type_code LIMIT 1` pick) active; deactivate 519/520/521.
--    Same pattern as 20260605_dedupe_sds_machine_type_name (KS-03A/KS-B80/...).
--
-- B. Retire junk master rows (machine_type_name NULL / '' / 'no data', 128 rows)
--    that NO satellite references (verified: sds_machine_tool/parameter/
--    excel_mapping all 0). Soft-retire via is_active=false (NOT deleted).
--
-- Non-destructive (is_active flip only). Transactional.
-- Rollback: 20260606_dedupe_machine_types_for_fk_rollback.sql
--
-- NOTE: still NOT enough to run the FK migration on its own — 'GS-64PF' has no
-- master row at all (needs the owner to add one with the real machine_type_code).
-- ============================================================================

BEGIN;

-- A. dedupe HI-GRIND-1-D → keep code 507 active, deactivate the rest
UPDATE sds_machine_type_code
   SET is_active = false
 WHERE machine_type_name = 'HI-GRIND-1-D'
   AND is_active
   AND machine_type_code <> '507';
-- expected: 3 rows (codes 519,520,521 / ids 58,59,60)

DO $$
DECLARE active_cnt int;
BEGIN
  SELECT COUNT(*) INTO active_cnt FROM sds_machine_type_code
   WHERE machine_type_name = 'HI-GRIND-1-D' AND is_active;
  IF active_cnt <> 1 THEN
    RAISE EXCEPTION 'HI-GRIND-1-D active count = % (expected 1) — aborting', active_cnt;
  END IF;
END $$;

-- B. retire unreferenced junk
UPDATE sds_machine_type_code c
   SET is_active = false
 WHERE is_active
   AND (machine_type_name IS NULL OR btrim(machine_type_name) = '' OR machine_type_name = 'no data')
   AND NOT EXISTS (SELECT 1 FROM sds_machine_tool  t WHERE t.machine_type     = c.machine_type_name)
   AND NOT EXISTS (SELECT 1 FROM sds_parameter     p WHERE p.machine_type_name = c.machine_type_name)
   AND NOT EXISTS (SELECT 1 FROM sds_excel_mapping m WHERE m.machine_type_name = c.machine_type_name);
-- expected: 128 rows

COMMIT;
