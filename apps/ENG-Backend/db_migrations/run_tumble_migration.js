const { pool } = require('../instance/instance');

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log("Creating tumble_model table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumble_model (
          id SERIAL PRIMARY KEY,
          new_cn VARCHAR(50),
          old_cn VARCHAR(50),
          part VARCHAR(100),
          class_name VARCHAR(100),
          material VARCHAR(100),
          process VARCHAR(100),
          prev_con_code VARCHAR(100),
          condition_code VARCHAR(100),
          create_user VARCHAR(50),
          create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_user VARCHAR(50),
          update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Creating tumble_condition table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumble_condition (
          id SERIAL PRIMARY KEY,
          code VARCHAR(100),
          process VARCHAR(100),
          mc_type_no VARCHAR(100),
          cleaning_parts_used VARCHAR(100),
          cleaning_parts_time VARCHAR(100),
          qty_max VARCHAR(100),
          media_spec VARCHAR(100),
          media_qty_kg VARCHAR(100),
          ss_100 VARCHAR(100),
          light_1a VARCHAR(100),
          water_qty_l VARCHAR(100),
          revolution VARCHAR(100),
          time_min VARCHAR(100),
          inspection_sampling VARCHAR(100),
          water_displacement_used VARCHAR(100),
          time VARCHAR(100),
          rust_protection_used VARCHAR(100),
          rust_protection_time VARCHAR(100),
          create_user VARCHAR(50),
          create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_user VARCHAR(50),
          update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Creating tumble_condition_history table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumble_condition_history (
          id SERIAL PRIMARY KEY,
          code VARCHAR(100),
          process VARCHAR(100),
          mc_type_no VARCHAR(100),
          cleaning_parts_used VARCHAR(100),
          cleaning_parts_time VARCHAR(100),
          qty_max VARCHAR(100),
          media_spec VARCHAR(100),
          media_qty_kg VARCHAR(100),
          ss_100 VARCHAR(100),
          light_1a VARCHAR(100),
          water_qty_l VARCHAR(100),
          revolution VARCHAR(100),
          time_min VARCHAR(100),
          inspection_sampling VARCHAR(100),
          water_displacement_used VARCHAR(100),
          time VARCHAR(100),
          rust_protection_used VARCHAR(100),
          rust_protection_time VARCHAR(100),
          create_user VARCHAR(50),
          create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_user VARCHAR(50),
          update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Creating tumble_condition_part table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS tumble_condition_part (
          id SERIAL PRIMARY KEY,
          code VARCHAR(100),
          part_name VARCHAR(255),
          detail TEXT,
          material_part VARCHAR(100),
          part_size VARCHAR(100),
          process_code VARCHAR(100),
          create_user VARCHAR(50),
          create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_user VARCHAR(50),
          update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log("Migration completed successfully.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    process.exit(0);
  }
};

migrate();
