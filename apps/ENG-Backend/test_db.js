const { pool } = require('./instance/instance');
async function test() {
  try {
    const result = await pool.query('SELECT * FROM pc_mrp LIMIT 1');
    console.log(Object.keys(result.rows[0]));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
test();
