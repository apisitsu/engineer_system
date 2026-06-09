-- ============================================================================
-- #4 PREREQUISITE — data cleanup before the machine-identity FK migration
-- ----------------------------------------------------------------------------
-- The FK migration cannot run until sds_machine_type_code names are unambiguous
-- and every satellite name has exactly one active master row. Sections 1–3 are
-- READ-ONLY diagnostics; section 4 are remediation TEMPLATES (owner must review
-- — destructive, left commented). Re-run sections 1–3 until they return 0 rows.
-- ============================================================================


-- 1. Duplicate machine_type_name (blocks unambiguous id backfill).
--    As of 2026-06-06: NULL ×87, 'no data' ×41, KS-03A ×2, KS-B80 ×2,
--    HI-GRIND-1-D ×4, plus ~10 more. Decide per name: are these genuinely
--    distinct machines (keep, but satellites must point to a specific id) or
--    accidental duplicates (merge)?
SELECT machine_type_name, COUNT(*) AS rows,
       array_agg(id ORDER BY id)               AS ids,
       array_agg(machine_type_code ORDER BY id) AS codes,
       bool_or(is_active)                       AS any_active
FROM sds_machine_type_code
GROUP BY machine_type_name
HAVING COUNT(*) > 1
ORDER BY rows DESC, machine_type_name;


-- 2. Junk master rows (no real name) — candidates to retire (is_active=false)
--    or delete if unreferenced.
SELECT id, machine_type_code, machine_type_name, is_active
FROM sds_machine_type_code
WHERE machine_type_name IS NULL OR btrim(machine_type_name) = '' OR machine_type_name = 'no data'
ORDER BY machine_type_name NULLS FIRST, id;


-- 3. Satellite names still missing a master row (orphans).
--    Expected after the orphan-fix migration: only 'GS-64PF' (needs a master
--    row added — its machine_type_code must come from the floor/owner).
SELECT 'sds_machine_tool' AS src, machine_type AS name FROM sds_machine_tool mt
 WHERE machine_type IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sds_machine_type_code c WHERE c.machine_type_name = mt.machine_type)
UNION
SELECT 'sds_parameter', machine_type_name FROM sds_parameter p
 WHERE machine_type_name IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sds_machine_type_code c WHERE c.machine_type_name = p.machine_type_name)
UNION
SELECT 'sds_excel_mapping', machine_type_name FROM sds_excel_mapping m
 WHERE machine_type_name IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sds_machine_type_code c WHERE c.machine_type_name = m.machine_type_name);


-- ── 4. REMEDIATION TEMPLATES (review before running — destructive) ────────────
/*
-- 4a. Add the missing master row for GS-64PF (fill in the real machine_type_code):
--     INSERT INTO sds_machine_type_code (machine_type_code, machine_type_name, is_active)
--     VALUES ('<CODE>', 'GS-64PF', true);

-- 4b. Retire junk rows that are NOT referenced by any satellite:
--     UPDATE sds_machine_type_code SET is_active = false
--      WHERE (machine_type_name IS NULL OR machine_type_name IN ('', 'no data'))
--        AND id NOT IN (
--          SELECT c.id FROM sds_machine_type_code c
--           JOIN sds_machine_tool  mt ON mt.machine_type      = c.machine_type_name
--          UNION SELECT c.id FROM sds_machine_type_code c
--           JOIN sds_parameter     p  ON p.machine_type_name  = c.machine_type_name
--          UNION SELECT c.id FROM sds_machine_type_code c
--           JOIN sds_excel_mapping m  ON m.machine_type_name  = c.machine_type_name
--        );

-- 4c. For each TRUE duplicate name, keep ONE canonical row and repoint the rest.
--     Do this per-name after deciding the keeper id — no blanket script (the
--     cascade-rename API PUT /api/sds/v2/admin/machine-types/:id is the safe way
--     to merge display names without touching satellites by hand).
*/
