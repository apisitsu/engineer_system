const { engPool } = require('../apps/ENG-Backend/instance/eng_db');

async function testQuery() {
    try {
        console.log("--- Testing Connection & Query spec_process ---");
        const res = await engPool.query("SELECT cn, part_no, process FROM setup_sheet LIMIT 5");
        console.log("✅ Connection Successful!");
        console.table(res.rows);
        
        const countRes = await engPool.query("SELECT count(*) FROM setup_sheet");
        console.log(`Total records in setup_sheet: ${countRes.rows[0].count}`);
    } catch (err) {
        console.error("❌ Database Error:", err.message);
    } finally {
        process.exit();
    }
}

testQuery();
