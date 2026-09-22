/**
 * 20260922_upgrade_pdf_watermarks.js
 *
 * Database migration for PDF Hub Watermarks:
 * 1. Adds is_system, is_public, layer, category columns to tt_pdf_watermarks.
 * 2. Creates indexes for high-performance filtering.
 * 3. Seeds 8 enterprise standard watermark presets for manufacturing operations.
 */
const { engPool } = require('../instance/eng_db');

async function migrate() {
    console.log('🚀 Starting PDF Watermarks Upgrade Migration...');
    const client = await engPool.connect();

    try {
        await client.query('BEGIN');

        // 1. Add columns if not exist
        console.log('📦 Updating schema for tt_pdf_watermarks...');
        await client.query(`
            ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
            ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
            ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS layer VARCHAR(20) DEFAULT 'overlay';
            ALTER TABLE tt_pdf_watermarks ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
        `);

        // 2. Add indexes
        console.log('⚡ Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pdf_watermarks_system ON tt_pdf_watermarks(is_system);
            CREATE INDEX IF NOT EXISTS idx_pdf_watermarks_public ON tt_pdf_watermarks(is_public);
            CREATE INDEX IF NOT EXISTS idx_pdf_watermarks_category ON tt_pdf_watermarks(category);
        `);

        // 3. Check existing system presets
        const existingSystem = await client.query(`SELECT COUNT(*) FROM tt_pdf_watermarks WHERE is_system = true`);
        const count = parseInt(existingSystem.rows[0].count, 10);

        if (count === 0) {
            console.log('🌱 Seeding 8 enterprise system watermark presets...');
            const presets = [
                {
                    name: 'CONFIDENTIAL (เอกสารลับ)',
                    text: 'CONFIDENTIAL - FOR INTERNAL USE ONLY',
                    color: '#D32F2F',
                    opacity: 0.32,
                    font_size: 46,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'center',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'overlay',
                    category: 'Security'
                },
                {
                    name: 'FOR REFERENCE ONLY (สำหรับอ้างอิง)',
                    text: 'HARD COPY IS UNCONTROLLED - FOR REFERENCE ONLY',
                    color: '#F57C00',
                    opacity: 0.38,
                    font_size: 32,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'center',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'underlay',
                    category: 'Quality'
                },
                {
                    name: 'APPROVED FOR PRODUCTION (อนุมัติเพื่อการผลิต)',
                    text: 'APPROVED FOR PRODUCTION - VERIFY REVISION',
                    color: '#2E7D32',
                    opacity: 0.85,
                    font_size: 16,
                    angle: 0,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'footer',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'overlay',
                    category: 'Production'
                },
                {
                    name: 'SAMPLE ONLY (ชิ้นงานตัวอย่าง)',
                    text: 'SAMPLE / PROTOTYPE ONLY - NOT FOR MASS PRODUCTION',
                    color: '#1976D2',
                    opacity: 0.35,
                    font_size: 36,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'center',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'underlay',
                    category: 'Development'
                },
                {
                    name: 'DRAFT / PRELIMINARY (แบบร่าง)',
                    text: 'DRAFT - PRELIMINARY DRAWING NOT FOR CONSTRUCTION',
                    color: '#757575',
                    opacity: 0.28,
                    font_size: 38,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'normal',
                    font_style: 'normal',
                    position_preset: 'diagonal',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'underlay',
                    category: 'Draft'
                },
                {
                    name: 'CONTROLLED COPY (สำเนาควบคุม)',
                    text: 'CONTROLLED COPY - DO NOT ALTER OR REDISTRIBUTE',
                    color: '#0288D1',
                    opacity: 0.85,
                    font_size: 14,
                    angle: 0,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'header',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'overlay',
                    category: 'Quality'
                },
                {
                    name: 'SUPERSEDED / OBSOLETE (ยกเลิก / แทนที่แล้ว)',
                    text: 'SUPERSEDED - OBSOLETE DRAWING DO NOT USE',
                    color: '#B71C1C',
                    opacity: 0.45,
                    font_size: 44,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: false,
                    repeat_gap: 100,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'center',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'overlay',
                    category: 'Status'
                },
                {
                    name: 'DO NOT DUPLICATE (ห้ามทำซ้ำ - Tiled)',
                    text: 'DO NOT DUPLICATE',
                    color: '#C62828',
                    opacity: 0.14,
                    font_size: 40,
                    angle: 45,
                    owner_empno: 'SYSTEM',
                    repeat_mode: true,
                    repeat_gap: 120,
                    font_family: 'Helvetica',
                    font_weight: 'bold',
                    font_style: 'normal',
                    position_preset: 'center',
                    repeat_style: 'full',
                    is_system: true,
                    is_public: true,
                    layer: 'underlay',
                    category: 'Security'
                }
            ];

            for (const p of presets) {
                await client.query(`
                    INSERT INTO tt_pdf_watermarks 
                    (name, text, color, opacity, font_size, angle, owner_empno, repeat_mode, repeat_gap, font_family, font_weight, font_style, position_preset, repeat_style, is_system, is_public, layer, category)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                `, [
                    p.name, p.text, p.color, p.opacity, p.font_size, p.angle, p.owner_empno,
                    p.repeat_mode, p.repeat_gap, p.font_family, p.font_weight, p.font_style,
                    p.position_preset, p.repeat_style, p.is_system, p.is_public, p.layer, p.category
                ]);
            }
            console.log(`✅ Successfully seeded ${presets.length} presets.`);
        } else {
            console.log(`ℹ️ System presets already exist (${count} items). Skipping seed.`);
        }

        await client.query('COMMIT');
        console.log('🎉 PDF Watermarks Upgrade Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
