const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');

/**
 * Executes a .sql file in the PostgreSQL eng_system database.
 * @param {string} fileName 
 */
async function executeSqlFile(fileName) {
    const filePath = path.join(__dirname, fileName);
    console.log(`\n⏳ Executing: ${fileName}`);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found: ${filePath}`);
        return;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by ';' but avoid splitting within strings (simplified regex)
    // For safer execution, we split by ';' but the scripts here are simple
    const statements = sql
        .replace(/--.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        for (const statement of statements) {
            // console.log(`   Running: ${statement.substring(0, 50)}...`);
            await client.query(statement);
        }
        await client.query('COMMIT');
        console.log(`✅ Success: ${fileName}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed: ${fileName}`);
        console.error(`   Error message: ${err.message}`);
        // Log the specific statement that failed
        if (err.position) {
            const context = sql.substring(Math.max(0, err.position - 50), Math.min(sql.length, err.position + 50));
            console.error(`   Near error position ${err.position}: "...${context}..."`);
        }
    } finally {
        client.release();
    }
}

async function run() {
    try {
        console.log('🚀 Starting SDS V2 Database Migrations...');
        
        // 1. Core Tables
        await executeSqlFile('sds_v2_core_tables.up.sql');
        
        // 2. Images & Templates
        await executeSqlFile('sds_v2_images_and_template.up.sql');
        
        console.log('\n🏁 Migration process finished.');
        process.exit(0);
    } catch (err) {
        console.error('\n💥 Critical Error:', err);
        process.exit(1);
    }
}

run();
