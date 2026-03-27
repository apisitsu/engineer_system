const { engPool } = require('../apps/ENG-Backend/instance/eng_db');

const testConnection = async () => {
    try {
        const res = await engPool.query('SELECT NOW()');
        console.log('Connection Success:', res.rows[0]);
    } catch (err) {
        console.error('Detailed Connection Error:', err);
    } finally {
        await engPool.end();
    }
};

testConnection();
