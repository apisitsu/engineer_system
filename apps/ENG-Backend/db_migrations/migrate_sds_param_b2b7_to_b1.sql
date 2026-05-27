-- Migration: Consolidate SDS parameter data for KS-400B group
-- KS-400B1 is now the representative for KS-400B1/B2/B7.
-- Step 1: Migrate per-CN data from KS-400B2 → KS-400B1 (skip if KS-400B1 already has the row)
-- Step 2: Migrate per-CN data from KS-400B7 → KS-400B1 (skip if already covered by step 1 or existing B1)
-- Step 3: Delete all KS-400B2 and KS-400B7 rows (machine-config + per-CN)
-- Step 4: Delete KS-400B2 and KS-400B7 entries from sds_machine_tool

BEGIN;

-- 1. Migrate KS-400B2 per-CN rows → KS-400B1
INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, updated_by, updated_at)
SELECT p.cn, 'KS-400B1', p.param_key, p.param_value, p.updated_by, p.updated_at
  FROM sds_parameter p
 WHERE p.machine_type_name = 'KS-400B2'
   AND p.cn IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sds_parameter x
      WHERE x.cn = p.cn
        AND x.machine_type_name = 'KS-400B1'
        AND x.param_key = p.param_key
   )
ON CONFLICT DO NOTHING;

-- 2. Migrate KS-400B7 per-CN rows → KS-400B1 (skip rows already migrated from B2 or pre-existing B1)
INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, updated_by, updated_at)
SELECT p.cn, 'KS-400B1', p.param_key, p.param_value, p.updated_by, p.updated_at
  FROM sds_parameter p
 WHERE p.machine_type_name = 'KS-400B7'
   AND p.cn IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sds_parameter x
      WHERE x.cn = p.cn
        AND x.machine_type_name = 'KS-400B1'
        AND x.param_key = p.param_key
   )
ON CONFLICT DO NOTHING;

-- 3. Delete all KS-400B2 and KS-400B7 rows (machine-config + per-CN)
DELETE FROM sds_parameter WHERE machine_type_name IN ('KS-400B2', 'KS-400B7');

-- 4. Delete KS-400B2 and KS-400B7 tool entries from sds_machine_tool
DELETE FROM sds_machine_tool WHERE machine_type IN ('KS-400B2', 'KS-400B7');

COMMIT;
