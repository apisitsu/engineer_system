require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PG_NEW_HOST,
    port: parseInt(process.env.PG_NEW_PORT),
    database: process.env.PG_NEW_DB,
    user: process.env.PG_NEW_USER,
    password: process.env.PG_NEW_PASS,
    connectionTimeoutMillis: 5000,
});

async function debugConnection() {
    console.log(`Connecting to ${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}...`);
    try {
        const client = await pool.connect();
        console.log("✅ CONNECTED SUCCESSFULLY!");
        const res = await client.query("SELECT current_database(), now()");
        console.log("Database Info:", res.rows[0]);
        client.release();
    } catch (err) {
        console.error("❌ CONNECTION FAILED!");
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        console.error("Full Error:", err);
    } finally {
        await pool.end();
        process.exit();
    }
}

debugConnection();
