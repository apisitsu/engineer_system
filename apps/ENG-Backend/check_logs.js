const { engPool } = require('./instance/eng_db');

const checkLogs = async () => {
    try {
        const res = await engPool.query("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 5");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
};

checkLogs();
