const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

const checkMachineTypes = async () => {
  try {
    const res = await engPool.query(`
      SELECT id, machine_type_code, machine_type_name FROM mtc_machine_type_code ORDER BY machine_type_code
    `);
    console.log('--- mtc_machine_type_code ---');
    console.table(res.rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit();
  }
};

checkMachineTypes();
