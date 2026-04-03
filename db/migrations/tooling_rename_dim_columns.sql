-- ====================================================
-- Migration: Rename tooling columns to dim_* standard
-- รันทีละตารางใน DBeaver (select แล้ว Ctrl+Enter)
-- ====================================================

-- ============================================================
-- 1. tooling_ksb22g
-- ============================================================

ALTER TABLE tooling_ksb22g
  ADD COLUMN IF NOT EXISTS dim_a NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_b NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_c NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_d NUMERIC;

UPDATE tooling_ksb22g SET
  dim_a = jaw_id_1_a,
  dim_b = jaw_id_2_b,
  dim_c = jaw_width_max_c,
  dim_d = jaw_depth_max_d
WHERE tooling_name ILIKE '%JAW%';

UPDATE tooling_ksb22g SET
  dim_a = backplate_id_a,
  dim_b = backplate_pcd_b
WHERE tooling_name ILIKE '%BACK PLATE%';

ALTER TABLE tooling_ksb22g
  DROP COLUMN IF EXISTS jaw_id_1_a,
  DROP COLUMN IF EXISTS jaw_id_2_b,
  DROP COLUMN IF EXISTS jaw_width_max_c,
  DROP COLUMN IF EXISTS jaw_depth_max_d,
  DROP COLUMN IF EXISTS backplate_id_a,
  DROP COLUMN IF EXISTS backplate_pcd_b;

ALTER TABLE tooling_ksb22g
  DROP CONSTRAINT IF EXISTS uq_ksb22g_name_no;

ALTER TABLE tooling_ksb22g
  ADD CONSTRAINT uq_ksb22g_name_no UNIQUE (tooling_name, tooling_no);

-- ============================================================
-- 2. tooling_ksb80
-- ============================================================

ALTER TABLE tooling_ksb80
  ADD COLUMN IF NOT EXISTS dim_a NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_b NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_c NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_d NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_e NUMERIC;

UPDATE tooling_ksb80 SET
  dim_a = jaw_id_1_a,
  dim_b = jaw_id_2_b,
  dim_c = jaw_width_max_c,
  dim_d = jaw_depth_max_d,
  dim_e = CASE WHEN jaw_e ~ '^\d+(\.\d+)?$' THEN jaw_e::NUMERIC ELSE NULL END
WHERE tooling_name ILIKE '%JAW%';

UPDATE tooling_ksb80 SET
  dim_a = backplate_id_a,
  dim_b = backplate_pcd_b,
  dim_c = backplate_c
WHERE tooling_name ILIKE '%BACK PLATE%';

ALTER TABLE tooling_ksb80
  DROP COLUMN IF EXISTS jaw_id_1_a,
  DROP COLUMN IF EXISTS jaw_id_2_b,
  DROP COLUMN IF EXISTS jaw_width_max_c,
  DROP COLUMN IF EXISTS jaw_depth_max_d,
  DROP COLUMN IF EXISTS jaw_e,
  DROP COLUMN IF EXISTS backplate_id_a,
  DROP COLUMN IF EXISTS backplate_pcd_b,
  DROP COLUMN IF EXISTS backplate_c;

ALTER TABLE tooling_ksb80
  DROP CONSTRAINT IF EXISTS uq_ksb80_name_no;

ALTER TABLE tooling_ksb80
  ADD CONSTRAINT uq_ksb80_name_no UNIQUE (tooling_name, tooling_no);

-- ============================================================
-- 3. tooling_tsg300
-- ============================================================

ALTER TABLE tooling_tsg300
  ADD COLUMN IF NOT EXISTS dim_a NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_b NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_c NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_d NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_e NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_f NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_g NUMERIC;

UPDATE tooling_tsg300 SET
  dim_a = face_chute_a,
  dim_b = face_chute_b,
  dim_c = face_chute_c,
  dim_d = face_chute_d
WHERE tooling_name ILIKE '%CHUTE%';

UPDATE tooling_tsg300 SET
  dim_a = face_carrier_a,
  dim_b = face_carrier_b,
  dim_c = face_carrier_c,
  dim_d = face_carrier_d,
  dim_e = face_carrier_e,
  dim_f = face_carrier_f,
  dim_g = face_carrier_g
WHERE tooling_name ILIKE '%CARRIER%';

ALTER TABLE tooling_tsg300
  DROP COLUMN IF EXISTS face_chute_a,
  DROP COLUMN IF EXISTS face_chute_b,
  DROP COLUMN IF EXISTS face_chute_c,
  DROP COLUMN IF EXISTS face_chute_d,
  DROP COLUMN IF EXISTS face_carrier_a,
  DROP COLUMN IF EXISTS face_carrier_b,
  DROP COLUMN IF EXISTS face_carrier_c,
  DROP COLUMN IF EXISTS face_carrier_d,
  DROP COLUMN IF EXISTS face_carrier_e,
  DROP COLUMN IF EXISTS face_carrier_f,
  DROP COLUMN IF EXISTS face_carrier_g;

ALTER TABLE tooling_tsg300
  DROP CONSTRAINT IF EXISTS uq_tsg300_name_no;

ALTER TABLE tooling_tsg300
  ADD CONSTRAINT uq_tsg300_name_no UNIQUE (tooling_name, tooling_no);

-- ============================================================
-- 4. tooling_ks400b
-- ============================================================

ALTER TABLE tooling_ks400b
  ADD COLUMN IF NOT EXISTS dim_a NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_b NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_c NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_d NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_e NUMERIC,
  ADD COLUMN IF NOT EXISTS dim_f NUMERIC;

UPDATE tooling_ks400b SET
  dim_a = od_a, dim_b = id_b, dim_c = od_c,
  dim_d = od_d, dim_e = width_e, dim_f = step_f
WHERE tooling_name ILIKE '%WORK DRIVER%';

UPDATE tooling_ks400b SET
  dim_a = loading_chute_a, dim_b = loading_chute_b, dim_c = loading_chute_c,
  dim_d = loading_chute_d, dim_e = loading_chute_e, dim_f = loading_chute_f
WHERE tooling_name ILIKE '%LOADING CHUTE%';

UPDATE tooling_ks400b SET
  dim_a = support_block_a, dim_b = support_block_b, dim_c = support_block_c,
  dim_d = support_block_d, dim_e = support_block_e
WHERE tooling_name ILIKE '%SUPPORT BLOCK%';

UPDATE tooling_ks400b SET
  dim_a = plug_a_od_a, dim_b = plug_a_od_b, dim_c = plug_a_depth_c,
  dim_d = plug_a_cham_d, dim_e = plug_a_dist_e
WHERE tooling_name ILIKE '%PLUG(A)%' OR tooling_name ILIKE '%PLUG (A)%';

UPDATE tooling_ks400b SET
  dim_a = plug_b_od_a, dim_b = plug_b_od_b, dim_c = plug_b_depth_c,
  dim_d = plug_b_cham_d, dim_e = plug_b_dist_e
WHERE tooling_name ILIKE '%PLUG(B)%' OR tooling_name ILIKE '%PLUG (B)%';

ALTER TABLE tooling_ks400b
  DROP COLUMN IF EXISTS od_a,
  DROP COLUMN IF EXISTS id_b,
  DROP COLUMN IF EXISTS od_c,
  DROP COLUMN IF EXISTS od_d,
  DROP COLUMN IF EXISTS width_e,
  DROP COLUMN IF EXISTS step_f,
  DROP COLUMN IF EXISTS loading_chute_a,
  DROP COLUMN IF EXISTS loading_chute_b,
  DROP COLUMN IF EXISTS loading_chute_c,
  DROP COLUMN IF EXISTS loading_chute_d,
  DROP COLUMN IF EXISTS loading_chute_e,
  DROP COLUMN IF EXISTS loading_chute_f,
  DROP COLUMN IF EXISTS support_block_a,
  DROP COLUMN IF EXISTS support_block_b,
  DROP COLUMN IF EXISTS support_block_c,
  DROP COLUMN IF EXISTS support_block_d,
  DROP COLUMN IF EXISTS support_block_e,
  DROP COLUMN IF EXISTS plug_a_od_a,
  DROP COLUMN IF EXISTS plug_a_od_b,
  DROP COLUMN IF EXISTS plug_a_depth_c,
  DROP COLUMN IF EXISTS plug_a_cham_d,
  DROP COLUMN IF EXISTS plug_a_dist_e,
  DROP COLUMN IF EXISTS plug_b_od_a,
  DROP COLUMN IF EXISTS plug_b_od_b,
  DROP COLUMN IF EXISTS plug_b_depth_c,
  DROP COLUMN IF EXISTS plug_b_cham_d,
  DROP COLUMN IF EXISTS plug_b_dist_e;

ALTER TABLE tooling_ks400b
  DROP CONSTRAINT IF EXISTS uq_ks400b_name_no;

ALTER TABLE tooling_ks400b
  ADD CONSTRAINT uq_ks400b_name_no UNIQUE (tooling_name, tooling_no);
