const { engPool } = require('../instance/eng_db');

async function migrate() {
    console.log("Starting migration: 20260922_fix_ecnt_block4_states.js...");
    try {
        const check = await engPool.query(`
            SELECT id, ecr_no, current_block, process_status, current_stage_code 
            FROM ecnt2_ecr 
            WHERE process_status = 'Issued ECN' AND current_block = 4
        `);
        console.log(`Found ${check.rows.length} ECR records stuck in Block 4 with 'Issued ECN':`);
        console.log(check.rows);

        if (check.rows.length > 0) {
            const updateResult = await engPool.query(`
                UPDATE ecnt2_ecr 
                SET current_block = 5, updated_at = NOW() 
                WHERE process_status = 'Issued ECN' AND current_block = 4
                RETURNING id, ecr_no, current_block, process_status
            `);
            console.log(`Successfully updated ${updateResult.rowCount} records to current_block = 5:`);
            console.log(updateResult.rows);
        } else {
            console.log("No records need updating.");
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

migrate();
