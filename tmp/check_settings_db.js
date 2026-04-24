const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://eng_admin:eng_secret_2026@plbmp130:6543/eng_system' });

async function checkTables() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%setting%' OR table_name LIKE '%config%' OR table_name LIKE '%email%')
        `);
        console.log('Relevant tables found:', res.rows);
        
        for (const row of res.rows) {
            const columns = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '${row.table_name}'
            `);
            console.log(`Columns in ${row.table_name}:`, columns.rows.map(c => c.column_name));
        }
        
        await client.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkTables();
