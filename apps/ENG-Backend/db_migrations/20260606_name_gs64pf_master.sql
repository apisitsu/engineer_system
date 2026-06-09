-- ============================================================================
-- #4 Phase 0c — name the GS-64PF master row (engPool)
-- ----------------------------------------------------------------------------
-- The last FK blocker: sds_machine_tool rows (ids 70-73) reference machine_type
-- 'GS-64PF' which had no master row. It turns out the master row DID exist —
-- id=298, machine_type_code='762' — but with machine_type_name=NULL, so it
-- (a) never matched the 'GS-64PF' name and (b) got swept into the junk retire
-- (20260606_dedupe_machine_types_for_fk.sql) as a nameless row.
--
-- Owner confirmed code 762 = GS-64PF. Restore the name + reactivate.
-- Transactional. Rollback: 20260606_name_gs64pf_master_rollback.sql
-- ============================================================================

BEGIN;

UPDATE sds_machine_type_code
   SET machine_type_name = 'GS-64PF',
       is_active         = true
 WHERE id = 298
   AND machine_type_code = '762';
-- expected: 1 row

DO $$
DECLARE ok int;
BEGIN
  SELECT COUNT(*) INTO ok FROM sds_machine_type_code
   WHERE machine_type_name = 'GS-64PF' AND is_active;
  IF ok <> 1 THEN
    RAISE EXCEPTION 'GS-64PF active master count = % (expected 1) — aborting', ok;
  END IF;
END $$;

COMMIT;
