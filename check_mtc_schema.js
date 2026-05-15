const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

const checkSchema = async () => {
  try {
    const res = await engPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sds_machine_type_code'
    `);
    console.log('--- sds_machine_type_code schema ---');
    console.table(res.rows);

    const data = await engPool.query(`
      SELECT machine_type_code, machine_type_name FROM sds_machine_type_code LIMIT 10
    `);
    console.log('--- sds_machine_type_code data ---');
    console.table(data.rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit();
  }
};

checkSchema();
