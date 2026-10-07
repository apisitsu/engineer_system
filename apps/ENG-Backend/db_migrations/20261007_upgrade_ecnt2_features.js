const { engPool } = require('../instance/eng_db');

async function migrate() {
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- Migrating ECNT V2 Extensions ---');

        // 1. ecnt2_fai_summary
        await client.query(`
            ALTER TABLE ecnt2_fai_summary 
            ADD COLUMN IF NOT EXISTS google_sheet_url TEXT,
            ADD COLUMN IF NOT EXISTS attachments JSONB;
        `);
        console.log('✓ ecnt2_fai_summary columns ensured.');

        // 2. ecnt2_impact_assessment
        await client.query(`
            ALTER TABLE ecnt2_impact_assessment 
            ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
        `);
        console.log('✓ ecnt2_impact_assessment columns ensured.');

        // 3. ecnt2_ecr
        await client.query(`
            ALTER TABLE ecnt2_ecr 
            ADD COLUMN IF NOT EXISTS risk_assessment_notes TEXT,
            ADD COLUMN IF NOT EXISTS risk_assessment_by VARCHAR(100),
            ADD COLUMN IF NOT EXISTS risk_assessment_by_name VARCHAR(200),
            ADD COLUMN IF NOT EXISTS risk_assessment_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS last_rmd_comment TEXT;
        `);
        console.log('✓ ecnt2_ecr columns ensured.');

        // 4. ecnt2_ecn
        await client.query(`
            ALTER TABLE ecnt2_ecn 
            ADD COLUMN IF NOT EXISTS last_rmd_comment TEXT;
        `);
        console.log('✓ ecnt2_ecn columns ensured.');

        await client.query('COMMIT');
        console.log('✅ Migration successfully completed!');
        process.exit(0);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
