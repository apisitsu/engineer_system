const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { engPool } = require('../instance/eng_db');

async function checkTables() {
  try {
    const res = await engPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'm_user_skills'
      ORDER BY ordinal_position;
    `);
    console.log('m_user_skills columns:', res.rows);
    process.exit(0);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTables();
