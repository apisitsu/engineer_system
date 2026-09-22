/**
 * 20260922_add_watermark_margin_columns.js
 *
 * Adds margin_unit (cm / in) and margin_offset (numerical distance from edge) to tt_pdf_watermarks.
 */
const { engPool } = require('../instance/eng_db');

async function migrate() {
    console.log('🚀 Adding margin_unit and margin_offset columns to tt_pdf_watermarks...');
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE tt_pdf_watermarks 
            ADD COLUMN IF NOT EXISTS margin_unit VARCHAR(10) DEFAULT 'cm',
            ADD COLUMN IF NOT EXISTS margin_offset NUMERIC(6,2) DEFAULT 1.50;
        `);
        await client.query('COMMIT');
        console.log('✅ Successfully added margin columns to tt_pdf_watermarks');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
