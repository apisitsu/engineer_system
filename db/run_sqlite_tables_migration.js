const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend folder ONLY (ignore root .env)
const envPath = path.join(__dirname, '..', 'apps', 'ENG-Backend', '.env');
console.log('Loading .env from:', envPath);
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Use the same config as the backend
const engPool = new Pool({
    host: envConfig.PG_NEW_HOST,
    port: parseInt(envConfig.PG_NEW_PORT),
    database: envConfig.PG_NEW_DB,
    user: envConfig.PG_NEW_USER,
    password: envConfig.PG_NEW_PASS,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function runMigration() {
    try {
        console.log('🔄 Starting 02_sqlite_tables migration...');
        console.log('   PG_NEW_HOST:', envConfig.PG_NEW_HOST);
        console.log('   PG_NEW_PORT:', envConfig.PG_NEW_PORT);
        console.log('   PG_NEW_DB:', envConfig.PG_NEW_DB);
        console.log('   PG_NEW_USER:', envConfig.PG_NEW_USER);
        console.log(`   Connecting to ${envConfig.PG_NEW_HOST}:${envConfig.PG_NEW_PORT}/${envConfig.PG_NEW_DB}`);
        
        // Test connection first
        await engPool.query('SELECT 1');
        console.log('✅ Database connection successful');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'init', '02_sqlite_tables.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Remove comments
        sql = sql.replace(/--[\s\S]*?\n/g, '\n');
        
        // Split by semicolons but handle $$ blocks properly
        // First, replace $$ ... $$ blocks with placeholders
        const dollarBlocks = [];
        sql = sql.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
            const index = dollarBlocks.length;
            dollarBlocks.push(match);
            return `__DOLLAR_BLOCK_${index}__`;
        });
        
        // Now split by semicolons
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
            let statement = statements[i];
            
            // Restore dollar blocks
            statement = statement.replace(/__DOLLAR_BLOCK_(\d+)__/g, (match, index) => {
                return dollarBlocks[parseInt(index)];
            });
            
            try {
                await engPool.query(statement);
                if (i % 5 === 0 || i === statements.length - 1) {
                    console.log(`   Executed ${i + 1}/${statements.length} statements`);
                }
            } catch (err) {
                // Ignore "already exists" errors
                if (err.code === '42P07' || 
                    err.message.includes('already exists') ||
                    err.message.includes('already')) {
                    console.log(`   ⚠️  Skipping (already exists): ${statement.substring(0, 50)}...`);
                } else {
                    console.error(`   ❌ Error at statement ${i + 1}:`, err.message);
                    console.error(`   SQL: ${statement.substring(0, 200)}...`);
                    throw err;
                }
            }
        }
        
        console.log('✅ Migration completed successfully!');
        
        // Verify tool_dwg_request table exists
        const verifyRes = await engPool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tool_dwg_request' 
            ORDER BY ordinal_position
        `);
        
        if (verifyRes.rows.length > 0) {
            console.log('✅ tool_dwg_request table verified with columns:');
            verifyRes.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type}`);
            });
        } else {
            console.log('⚠️  tool_dwg_request table not found');
        }
        
        // Verify tooling_inspect table exists
        const inspectRes = await engPool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tooling_inspect' 
            ORDER BY ordinal_position
        `);
        
        if (inspectRes.rows.length > 0) {
            console.log('✅ tooling_inspect table verified with columns:');
            inspectRes.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type}`);
            });
        } else {
            console.log('⚠️  tooling_inspect table not found');
        }
        
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await engPool.end();
        console.log('👋 Database connection closed');
        process.exit(0);
    }
}

runMigration();
