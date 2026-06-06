-- ============================================================================
-- ROLLBACK for 20260606_name_gs64pf_master.sql
-- ----------------------------------------------------------------------------
-- Restores id=298 to its prior state (nameless, retired) — i.e. undoes both the
-- name assignment and the reactivation.
-- ============================================================================

BEGIN;

UPDATE sds_machine_type_code
   SET machine_type_name = NULL,
       is_active         = false
 WHERE id = 298
   AND machine_type_code = '762';

COMMIT;
