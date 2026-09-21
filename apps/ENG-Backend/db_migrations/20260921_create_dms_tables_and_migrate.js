/**
 * Migration & Data Seeding: Document Management System (DMS)
 * Creates dms_document_types and dms_documents tables,
 * seeds initial document types, and migrates all 86 records from DOCUMENTS.xlsx.
 */
const path = require('path');
const xlsx = require('xlsx');
const { engPool } = require('../instance/eng_db');

const EXCEL_PATH = path.resolve(__dirname, '../../ENG-Frontend/src/components/engineer/newprod_eng/document/DOCUMENTS.xlsx');

async function runMigration() {
    const client = await engPool.connect();
    try {
        console.log('--- Starting DMS Migration ---');
        await client.query('BEGIN');

        // 1. Create dms_document_types table
        console.log('Creating table: dms_document_types...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS dms_document_types (
                id SERIAL PRIMARY KEY,
                prefix VARCHAR(30) UNIQUE NOT NULL,
                name VARCHAR(150) NOT NULL,
                category VARCHAR(50),
                current_number INT NOT NULL DEFAULT 0,
                digit_length INT NOT NULL DEFAULT 6,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Create dms_documents table
        console.log('Creating table: dms_documents...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS dms_documents (
                id SERIAL PRIMARY KEY,
                document_no VARCHAR(50) UNIQUE NOT NULL,
                type_id INT REFERENCES dms_document_types(id) ON DELETE RESTRICT,
                prefix VARCHAR(30) NOT NULL,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(50),
                part VARCHAR(50),
                document_link TEXT,
                link_innovator TEXT,
                seq_no VARCHAR(50),
                note TEXT,
                created_by VARCHAR(100) DEFAULT 'System Migration',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ DEFAULT NULL
            );
        `);

        // Indexes for high performance querying
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_no ON dms_documents(document_no);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_type ON dms_documents(type_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_prefix ON dms_documents(prefix);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_category ON dms_documents(category);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_part ON dms_documents(part);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_title ON dms_documents(title);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_dms_docs_deleted ON dms_documents(deleted_at);`);

        // 3. Seed default document types
        console.log('Seeding default document types...');
        const defaultTypes = [
            { prefix: 'PID', name: 'Process Identification Document', category: 'PID', digit_length: 6, current_number: 2 },
            { prefix: 'PDR', name: 'Process Design Review', category: 'PDR', digit_length: 6, current_number: 10 },
            { prefix: 'PFD', name: 'Process Flow Diagram', category: 'PFD', digit_length: 6, current_number: 25 },
            { prefix: 'PFMEA', name: 'Process Failure Mode & Effects Analysis', category: 'PFMEA', digit_length: 6, current_number: 25 },
            { prefix: 'CP', name: 'Control Plan', category: 'Control Plan', digit_length: 6, current_number: 24 }
        ];

        for (const t of defaultTypes) {
            await client.query(`
                INSERT INTO dms_document_types (prefix, name, category, digit_length, current_number)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (prefix) DO UPDATE 
                SET name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    digit_length = EXCLUDED.digit_length,
                    current_number = GREATEST(dms_document_types.current_number, EXCLUDED.current_number),
                    updated_at = NOW();
            `, [t.prefix, t.name, t.category, t.digit_length, t.current_number]);
        }

        // Fetch type mapping
        const typesRes = await client.query(`SELECT id, prefix FROM dms_document_types`);
        const typeMap = {};
        typesRes.rows.forEach(r => { typeMap[r.prefix] = r.id; });

        // 4. Read Excel and migrate documents
        console.log(`Reading Excel file from: ${EXCEL_PATH}`);
        const wb = xlsx.readFile(EXCEL_PATH);
        let totalImported = 0;
        let totalSkipped = 0;

        // Map sheet names to type prefixes
        const sheetPrefixMap = {
            'PID': 'PID',
            'PDR': 'PDR',
            'PFD': 'PFD',
            'PFMEA': 'PFMEA',
            'Control Plan': 'CP'
        };

        for (const sheetName of wb.SheetNames) {
            const prefix = sheetPrefixMap[sheetName];
            if (!prefix || !typeMap[prefix]) {
                console.warn(`Skipping unrecognized sheet: ${sheetName}`);
                continue;
            }

            const typeId = typeMap[prefix];
            const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
            console.log(`Migrating sheet [${sheetName}] -> Prefix [${prefix}]: ${rows.length} rows...`);

            for (const r of rows) {
                const docNo = (r['DOC No.'] || r['Suffix Number'] || '').trim();
                const title = (r['Title'] || '').trim();
                if (!docNo || !title) continue;

                const category = (r['Category'] || sheetName).trim();
                const part = r['Part'] ? String(r['Part']).trim() : null;
                const link = r['Link'] ? String(r['Link']).trim() : null;
                const linkInnovator = r['Link_Innovator'] ? String(r['Link_Innovator']).trim() : null;
                const seqNo = r['Seq No.'] ? String(r['Seq No.']).trim() : null;
                const note = r['Note'] ? String(r['Note']).trim() : null;

                const res = await client.query(`
                    INSERT INTO dms_documents 
                    (document_no, type_id, prefix, title, category, part, document_link, link_innovator, seq_no, note, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (document_no) DO UPDATE
                    SET title = EXCLUDED.title,
                        category = EXCLUDED.category,
                        part = EXCLUDED.part,
                        document_link = COALESCE(EXCLUDED.document_link, dms_documents.document_link),
                        link_innovator = COALESCE(EXCLUDED.link_innovator, dms_documents.link_innovator),
                        seq_no = COALESCE(EXCLUDED.seq_no, dms_documents.seq_no),
                        note = COALESCE(EXCLUDED.note, dms_documents.note),
                        updated_at = NOW()
                    RETURNING id;
                `, [docNo, typeId, prefix, title, category, part, link, linkInnovator, seqNo, note, 'DOCUMENTS.xlsx']);

                if (res.rowCount > 0) totalImported++;
                else totalSkipped++;
            }
        }

        await client.query('COMMIT');
        console.log(`✅ DMS Migration completed successfully! Total imported/updated: ${totalImported}, Skipped: ${totalSkipped}`);
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
