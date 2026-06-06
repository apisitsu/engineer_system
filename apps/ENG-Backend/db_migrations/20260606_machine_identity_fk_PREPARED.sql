-- ============================================================================
-- #4 Machine Identity SSOT — surrogate-id FK  (PREPARED — DO NOT RUN AS-IS)
-- ----------------------------------------------------------------------------
-- Goal: replace fragile string-name joins between sds_machine_type_code (master)
-- and its satellites (sds_machine_tool / sds_parameter / sds_excel_mapping) with
-- an integer FK to sds_machine_type_code.id, giving referential integrity +
-- rename safety (rename the name column freely; FKs are by id).
--
-- ⚠ WHY THIS IS NOT EXECUTED YET — blocked by the master data (audited 2026-06-06):
--   1. machine_type_name is NOT unique. 16 duplicate groups incl. NULL ×87,
--      'no data' ×41, KS-03A ×2, KS-B80 ×2, HI-GRIND-1-D ×4 … so a name maps to
--      MULTIPLE master rows → the backfill below is ambiguous for those names.
--   2. sds_machine_tool still has the orphan 'GS-64PF' (no master row at all).
--
-- ➜ Run 20260606_machine_identity_cleanup_prereq.sql FIRST and resolve every
--   item it reports (dedup names, retire junk rows, add the GS-64PF master row).
--   Only then uncomment and run this. The DO-block gate aborts if data is still
--   ambiguous, so a premature run rolls back cleanly rather than mis-linking.
--
-- Rollback: 20260606_machine_identity_fk_PREPARED_rollback.sql
-- ============================================================================

/*  ── UNCOMMENT AFTER PREREQUISITES ARE MET ───────────────────────────────────

BEGIN;

-- 0. Gate: abort if any satellite name resolves to ≠1 active master row.
DO $$
DECLARE bad int;
BEGIN
  SELECT COUNT(*) INTO bad FROM (
    SELECT mt.machine_type AS name
      FROM (SELECT DISTINCT machine_type FROM sds_machine_tool WHERE machine_type IS NOT NULL) mt
      JOIN sds_machine_type_code c ON c.machine_type_name = mt.machine_type AND c.is_active
     GROUP BY mt.machine_type HAVING COUNT(*) <> 1
    UNION ALL
    SELECT p.machine_type_name
      FROM (SELECT DISTINCT machine_type_name FROM sds_parameter WHERE machine_type_name IS NOT NULL) p
      JOIN sds_machine_type_code c ON c.machine_type_name = p.machine_type_name AND c.is_active
     GROUP BY p.machine_type_name HAVING COUNT(*) <> 1
  ) x;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Ambiguous/missing master mapping for % satellite name(s) — clean up first', bad;
  END IF;
END $$;

-- 1. Add nullable id columns
ALTER TABLE sds_machine_tool   ADD COLUMN IF NOT EXISTS machine_type_id integer;
ALTER TABLE sds_parameter      ADD COLUMN IF NOT EXISTS machine_type_id integer;
ALTER TABLE sds_excel_mapping  ADD COLUMN IF NOT EXISTS machine_type_id integer;

-- 2. Backfill from the (now unambiguous) active master row
UPDATE sds_machine_tool   s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type AND c.is_active;
UPDATE sds_parameter      s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type_name AND c.is_active;
UPDATE sds_excel_mapping  s SET machine_type_id = c.id
  FROM sds_machine_type_code c
 WHERE c.machine_type_name = s.machine_type_name AND c.is_active;
-- NB: sds_excel_mapping rows with machine_type_name IS NULL = intentional shared
-- layout → machine_type_id stays NULL (allowed).

-- 3. FK constraints (NOT VALID first, then VALIDATE — non-blocking on big tables)
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

-- 4. Indexes on the new FK columns
CREATE INDEX IF NOT EXISTS idx_smt_type_id ON sds_machine_tool  (machine_type_id);
CREATE INDEX IF NOT EXISTS idx_sp_type_id  ON sds_parameter     (machine_type_id);
CREATE INDEX IF NOT EXISTS idx_sem_type_id ON sds_excel_mapping (machine_type_id);

COMMIT;

-- 5. (separate change) Link T-Select → SDS master explicitly, replacing the
--    repOf/resolveMachine string heuristic:
--    ALTER TABLE tooling_machine ADD COLUMN IF NOT EXISTS sds_machine_type_id integer
--      REFERENCES sds_machine_type_code(id) ON DELETE SET NULL;
--    -- then backfill by name/group and switch the bridge code to read the FK.

-- 6. CODE follow-up (dual-read, then drop name reliance):
--    sdsV2PdfController.buildValueMap, sdsV2ReportController (repOf/nameToGroup),
--    sdsV2AdminController writes — join/insert by machine_type_id, keep name for
--    display only. Do this AFTER the columns exist and are validated.

──────────────────────────────────────────────────────────────────────────── */
