require('dotenv').config();
const { Pool } = require("pg");

const pool = new Pool({
  dialect: "postgres",
  user: process.env.PG_RODPC_USER,
  password: process.env.PG_RODPC_PASSWORD,
  port: process.env.PG_RODPC_PORT,
  host: process.env.PG_RODPC_HOST,
  database: process.env.PG_RODPC_DB,
  // database: "rodpc_test",
  // database: "rodpc_test2",
  timezone: "(GMT+07:00) Bangkok",
});
/// check database connection ///
pool.connect(function (err) {
  if (err) {
    return console.error("❌ PostgreSQL plb018 error: " + err.message);
  } else {
    console.log("✅ PostgreSQL plb018 Connected!");
  }
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client (RODPC)', err);
});

module.exports = { pool };
