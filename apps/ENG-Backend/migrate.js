const fs = require('fs');
const path = require('path');
const { engPool } = require('./instance/eng_db');

async function runInit() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'api', 'engineer', 'process', 'db_init_ecr.sql'), 'utf8');
        await engPool.query(sql);
        console.log("Migration executed successfully.");
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
runInit();
