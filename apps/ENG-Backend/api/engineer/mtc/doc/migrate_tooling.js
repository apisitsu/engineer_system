const { engPool } = require('./instance/eng_db');

const migrateQueries = [
  // 1. tooling_ksb22g
  `ALTER TABLE tooling_ksb22g ADD COLUMN IF NOT EXISTS dim_a numeric, ADD COLUMN IF NOT EXISTS dim_b numeric, 
   ADD COLUMN IF NOT EXISTS dim_c numeric, ADD COLUMN IF NOT EXISTS dim_d numeric;`,
  `UPDATE tooling_ksb22g SET 
     dim_a = COALESCE(jaw_id_1_a, backplate_id_a),
     dim_b = COALESCE(jaw_id_2_b, backplate_pcd_b),
     dim_c = jaw_width_max_c,
     dim_d = jaw_depth_max_d;`,
  `ALTER TABLE tooling_ksb22g 
   DROP COLUMN IF EXISTS jaw_id_1_a, DROP COLUMN IF EXISTS jaw_id_2_b, DROP COLUMN IF EXISTS jaw_width_max_c, 
   DROP COLUMN IF EXISTS jaw_depth_max_d, DROP COLUMN IF EXISTS backplate_id_a, DROP COLUMN IF EXISTS backplate_pcd_b;`,

  // 2. tooling_ksb80
  `ALTER TABLE tooling_ksb80 ADD COLUMN IF NOT EXISTS dim_a numeric, ADD COLUMN IF NOT EXISTS dim_b numeric, 
   ADD COLUMN IF NOT EXISTS dim_c numeric, ADD COLUMN IF NOT EXISTS dim_d numeric, ADD COLUMN IF NOT EXISTS dim_e character varying;`,
  `UPDATE tooling_ksb80 SET 
     dim_a = COALESCE(jaw_id_1_a, backplate_id_a),
     dim_b = COALESCE(jaw_id_2_b, backplate_pcd_b),
     dim_c = COALESCE(jaw_width_max_c, backplate_c),
     dim_d = jaw_depth_max_d,
     dim_e = jaw_e;`,
  `ALTER TABLE tooling_ksb80 
   DROP COLUMN IF EXISTS jaw_id_1_a, DROP COLUMN IF EXISTS jaw_id_2_b, DROP COLUMN IF EXISTS jaw_width_max_c, 
   DROP COLUMN IF EXISTS jaw_depth_max_d, DROP COLUMN IF EXISTS jaw_e, DROP COLUMN IF EXISTS backplate_id_a, 
   DROP COLUMN IF EXISTS backplate_pcd_b, DROP COLUMN IF EXISTS backplate_c;`,

  // 3. tooling_tsg300
  `ALTER TABLE tooling_tsg300 ADD COLUMN IF NOT EXISTS dim_a numeric, ADD COLUMN IF NOT EXISTS dim_b numeric, 
   ADD COLUMN IF NOT EXISTS dim_c numeric, ADD COLUMN IF NOT EXISTS dim_d numeric, ADD COLUMN IF NOT EXISTS dim_e numeric, 
   ADD COLUMN IF NOT EXISTS dim_f numeric, ADD COLUMN IF NOT EXISTS dim_g numeric;`,
  `UPDATE tooling_tsg300 SET 
     dim_a = COALESCE(face_chute_a, face_carrier_a),
     dim_b = COALESCE(face_chute_b, face_carrier_b),
     dim_c = COALESCE(face_chute_c, face_carrier_c),
     dim_d = COALESCE(face_chute_d, face_carrier_d),
     dim_e = face_carrier_e,
     dim_f = face_carrier_f,
     dim_g = face_carrier_g;`,
  `ALTER TABLE tooling_tsg300 
   DROP COLUMN IF EXISTS face_chute_a, DROP COLUMN IF EXISTS face_chute_b, DROP COLUMN IF EXISTS face_chute_c, 
   DROP COLUMN IF EXISTS face_chute_d, DROP COLUMN IF EXISTS face_carrier_a, DROP COLUMN IF EXISTS face_carrier_b, 
   DROP COLUMN IF EXISTS face_carrier_c, DROP COLUMN IF EXISTS face_carrier_d, DROP COLUMN IF EXISTS face_carrier_e, 
   DROP COLUMN IF EXISTS face_carrier_f, DROP COLUMN IF EXISTS face_carrier_g;`,

  // 4. tooling_ks400b (Missing columns completely)
  `ALTER TABLE tooling_ks400b 
   ADD COLUMN IF NOT EXISTS dim_a numeric, ADD COLUMN IF NOT EXISTS dim_b numeric, 
   ADD COLUMN IF NOT EXISTS dim_c numeric, ADD COLUMN IF NOT EXISTS dim_d numeric, 
   ADD COLUMN IF NOT EXISTS dim_e numeric, ADD COLUMN IF NOT EXISTS dim_f numeric;`
];

async function run() {
  console.log('Starting Migration...');
  for (let q of migrateQueries) {
    try {
      await engPool.query(q);
      console.log('Success:', q.substring(0, 50) + '...');
    } catch (e) {
      console.error('Error on query:', q);
      console.error(e.message);
    }
  }
  console.log('Migration Completed.');
  process.exit(0);
}

run();
