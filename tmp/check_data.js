const { engPool } = require('../apps/ENG-Backend/instance/eng_db');

async function checkData() {
    try {
        console.log("--- Checking spec_process table ---");
        const res = await engPool.query("SELECT cn, process, type FROM spec_process LIMIT 5");
        if (res.rows.length === 0) {
            console.log("⚠️ No data found in spec_process table.");
        } else {
            console.log("✅ Found sample C/N numbers:");
            res.rows.forEach(row => {
                console.log(`- CN: ${row.cn} | Process: ${row.process} | Type: ${row.type}`);
            });
        }
        
        console.log("\n--- Checking tooling tables count ---");
        const tables = ['tooling_ksb22g', 'tooling_ksb80', 'tooling_tsg300', 'tooling_ks03a'];
        for (const table of tables) {
            const tRes = await engPool.query(`SELECT count(*) FROM ${table}`);
            console.log(`- ${table}: ${tRes.rows[0].count} records`);
        }

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        process.exit();
    }
}

checkData();
