const fs = require('fs');
const path = require('path');
const { engPool } = require('./instance/eng_db');

const sqlFilePath = path.join(__dirname, '../../db_eng/eng_system/tooling_ks400b.sql');

async function restoreKS400B() {
  console.log('Starting KS400B Restoration...');

  try {
    // 1. Drop old table
    await engPool.query(`DROP TABLE IF EXISTS tooling_ks400b;`);
    console.log('Dropped old tooling_ks400b table.');

    // 2. Create schema to match the backup dump
    await engPool.query(`
      CREATE TABLE tooling_ks400b (
        id SERIAL PRIMARY KEY,
        tooling_name TEXT,
        tooling_no TEXT,
        od_a NUMERIC,
        id_b NUMERIC,
        od_c NUMERIC,
        od_d NUMERIC,
        width_e NUMERIC,
        step_f NUMERIC,
        loading_chute_a NUMERIC,
        loading_chute_b NUMERIC,
        loading_chute_c NUMERIC,
        loading_chute_d NUMERIC,
        loading_chute_e NUMERIC,
        loading_chute_f NUMERIC,
        support_block_a NUMERIC,
        support_block_b NUMERIC,
        support_block_c NUMERIC,
        support_block_d NUMERIC,
        support_block_e NUMERIC,
        plug_a_od_a NUMERIC,
        plug_a_od_b NUMERIC,
        plug_a_depth_c NUMERIC,
        plug_a_cham_d NUMERIC,
        plug_a_dist_e NUMERIC,
        plug_b_od_a NUMERIC,
        plug_b_od_b NUMERIC,
        plug_b_depth_c NUMERIC,
        plug_b_cham_d NUMERIC,
        plug_b_dist_e NUMERIC,
        machine TEXT
      );
    `);
    console.log('Created tooling_ks400b with legacy dimensions.');

    // 3. Load data from SQL backup
    const sqlData = fs.readFileSync(sqlFilePath, 'utf8');
    await engPool.query(sqlData);
    console.log('Inserted data from backup file successfully.');

    // 4. Map to new consolidated DIM columns (dim_a - dim_f)
    await engPool.query(`
      ALTER TABLE tooling_ks400b 
      ADD COLUMN dim_a NUMERIC, ADD COLUMN dim_b NUMERIC, ADD COLUMN dim_c NUMERIC, 
      ADD COLUMN dim_d NUMERIC, ADD COLUMN dim_e NUMERIC, ADD COLUMN dim_f NUMERIC;
    `);

    await engPool.query(`
      UPDATE tooling_ks400b SET 
        dim_a = COALESCE(od_a, loading_chute_a, support_block_a, plug_a_od_a, plug_b_od_a),
        dim_b = COALESCE(id_b, loading_chute_b, support_block_b, plug_a_od_b, plug_b_od_b),
        dim_c = COALESCE(od_c, loading_chute_c, support_block_c, plug_a_depth_c, plug_b_depth_c),
        dim_d = COALESCE(od_d, loading_chute_d, support_block_d, plug_a_cham_d, plug_b_cham_d),
        dim_e = COALESCE(width_e, loading_chute_e, support_block_e, plug_a_dist_e, plug_b_dist_e),
        dim_f = COALESCE(step_f, loading_chute_f);
    `);
    console.log('Migrated data into dim_a through dim_f.');

    // 5. Cleanup legacy columns
    await engPool.query(`
      ALTER TABLE tooling_ks400b 
      DROP COLUMN od_a, DROP COLUMN id_b, DROP COLUMN od_c, DROP COLUMN od_d, DROP COLUMN width_e, DROP COLUMN step_f,
      DROP COLUMN loading_chute_a, DROP COLUMN loading_chute_b, DROP COLUMN loading_chute_c, DROP COLUMN loading_chute_d,
      DROP COLUMN loading_chute_e, DROP COLUMN loading_chute_f, DROP COLUMN support_block_a, DROP COLUMN support_block_b,
      DROP COLUMN support_block_c, DROP COLUMN support_block_d, DROP COLUMN support_block_e, DROP COLUMN plug_a_od_a,
      DROP COLUMN plug_a_od_b, DROP COLUMN plug_a_depth_c, DROP COLUMN plug_a_cham_d, DROP COLUMN plug_a_dist_e,
      DROP COLUMN plug_b_od_a, DROP COLUMN plug_b_od_b, DROP COLUMN plug_b_depth_c, DROP COLUMN plug_b_cham_d, DROP COLUMN plug_b_dist_e;
    `);
    console.log('Dropped legacy dimension columns. KS400B Restoration COMPLETE!');

  } catch (error) {
    console.error('Error during restoration:', error);
  } finally {
    process.exit(0);
  }
}

restoreKS400B();
