/**
 * Database Migration: Standardize all DMS document numbers to 6 digits
 * Updates historical 5-digit document numbers (PFD, PFMEA, CP) to 6-digit zero-padded format.
 */
const { engPool } = require('../instance/eng_db');

async function standardizeTo6Digits() {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        console.log('--- Standardizing DMS Document Numbers to 6 Digits ---');

        const selectQuery = `
            SELECT id, document_no, prefix, title
            FROM dms_documents
            WHERE document_no ~ '^[A-Z]+-[0-9]{5}$'
            ORDER BY id ASC
        `;

        const res = await client.query(selectQuery);
        console.log(`Found ${res.rows.length} documents with 5 digits.`);

        let updatedCount = 0;
        for (const row of res.rows) {
            const parts = row.document_no.split('-');
            const prefix = parts[0];
            const num = parts[1];
            const newDocNo = `${prefix}-0${num}`;

            const upd = await client.query(
                `UPDATE dms_documents 
                 SET document_no = $1, 
                     updated_at = NOW(), 
                     updated_by = 'System Standardization (6-Digit)' 
                 WHERE id = $2`,
                [newDocNo, row.id]
            );
            if (upd.rowCount === 1) {
                updatedCount++;
            }
        }

        console.log(`Updated ${updatedCount} document numbers to 6 digits.`);

        // Ensure all types have digit_length: 6
        await client.query(`UPDATE dms_document_types SET digit_length = 6 WHERE digit_length != 6`);

        await client.query('COMMIT');
        console.log('--- Migration Completed Successfully ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration error:', err);
        throw err;
    } finally {
        client.release();
        await engPool.end();
    }
}

if (require.main === module) {
    standardizeTo6Digits().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { standardizeTo6Digits };
