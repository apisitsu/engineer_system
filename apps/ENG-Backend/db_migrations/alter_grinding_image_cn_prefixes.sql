-- Migration: change cn_prefix (single) → cn_prefixes (text array)
-- One grinding image can now map to multiple CN prefixes.

BEGIN;

-- 1. Add new array column
ALTER TABLE sds_v2_grinding_image
  ADD COLUMN IF NOT EXISTS cn_prefixes text[];

-- 2. Migrate existing single-value cn_prefix into array
UPDATE sds_v2_grinding_image
SET cn_prefixes = ARRAY[cn_prefix]
WHERE cn_prefix IS NOT NULL AND cn_prefixes IS NULL;

-- 3. Make it NOT NULL
ALTER TABLE sds_v2_grinding_image
  ALTER COLUMN cn_prefixes SET NOT NULL;

-- 4. Drop old unique index/constraint on (cn_prefix, COALESCE(process_code,''))
DO $$
DECLARE
  idx_name text;
BEGIN
  FOR idx_name IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'sds_v2_grinding_image'
      AND indexname != 'sds_v2_grinding_image_pkey'
      AND indexdef ILIKE '%cn_prefix%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', idx_name);
  END LOOP;
END $$;

-- 5. Drop old cn_prefix column
ALTER TABLE sds_v2_grinding_image
  DROP COLUMN IF EXISTS cn_prefix;

-- 6. GIN index for fast ANY() lookups
CREATE INDEX IF NOT EXISTS idx_sds_grinding_cn_prefixes
  ON sds_v2_grinding_image USING GIN (cn_prefixes);

COMMIT;
