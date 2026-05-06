const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

async function backfill() {
    try {
        // Backfill projects: set start_date = created_at where start_date is NULL
        const projResult = await engPool.query(`
            UPDATE kb_project
            SET start_date = created_at
            WHERE start_date IS NULL AND created_at IS NOT NULL
        `);
        console.log(`✅ Projects backfilled: ${projResult.rowCount} rows updated`);

        // Backfill boards: set start_date = created_at where start_date is NULL
        const boardResult = await engPool.query(`
            UPDATE kb_board
            SET start_date = created_at
            WHERE start_date IS NULL AND created_at IS NOT NULL
        `);
        console.log(`✅ Boards backfilled: ${boardResult.rowCount} rows updated`);
    } catch (e) {
        console.error('Backfill failed:', e);
    } finally {
        await engPool.end();
    }
}

backfill();
