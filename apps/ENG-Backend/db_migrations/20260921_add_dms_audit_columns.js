/**
 * Migration: Add updated_by and deleted_by columns to dms_documents,
 * and update existing documents' created_by to Admin Munk ('admin').
 */
const { engPool } = require('../instance/eng_db');

async function runMigration() {
    const client = await engPool.connect();
    try {
        console.log('--- Starting DMS Audit Columns Migration ---');
        await client.query('BEGIN');

        // 1. Add updated_by and deleted_by columns
        console.log('Adding updated_by and deleted_by columns to dms_documents...');
        await client.query(`
            ALTER TABLE dms_documents 
            ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100),
            ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100);
        `);

        // 2. Update existing documents to have created_by = 'admin' (Admin Munk)
        console.log('Updating existing documents created_by to "admin" (Admin Munk)...');
        const updateRes = await client.query(`
            UPDATE dms_documents 
            SET created_by = 'admin' 
            WHERE created_by = 'DOCUMENTS.xlsx' 
               OR created_by = 'System Migration' 
               OR created_by IS NULL;
        `);
        console.log(`Updated ${updateRes.rowCount} documents to created_by = 'admin'`);

        await client.query('COMMIT');

        // 3. Verify
        const verifyRes = await client.query(`
            SELECT created_by, COUNT(*) as count 
            FROM dms_documents 
            GROUP BY created_by;
        `);
        console.log('Documents created_by distribution:', verifyRes.rows);

        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'dms_documents' 
              AND column_name IN ('created_by', 'created_at', 'updated_by', 'updated_at', 'deleted_by', 'deleted_at')
            ORDER BY ordinal_position;
        `);
        console.log('DMS Audit Columns:', colsRes.rows);

        console.log('✅ DMS Audit Columns Migration Completed Successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigration };
