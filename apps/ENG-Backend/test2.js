const { engPool } = require('./instance/eng_db');
async function run() {
  try {
    const {rows: rows2} = await engPool.query(`SELECT COALESCE(NULL, '{}') as members2`);
    console.log(typeof rows2[0].members2, Array.isArray(rows2[0].members2));
  } finally {
    engPool.end();
  }
}
run();
