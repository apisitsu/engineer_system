const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const { engPool } = require('../instance/eng_db');

function norm(val, maxVal = 3.0) {
    return val ? (Number(val) / maxVal) * 100 : 0;
}

function calculatePowers(skills) {
    const mc_setup = norm(skills.mc_setup || 1);
    const inspection = norm(skills.inspection || 1);
    const mc_op = norm(skills.mc_operation || 1);
    const pub_std = norm(skills.public_std || 1);
    const cust_spec = norm(skills.cust_specification || 1);
    const int_doc = norm(skills.internal_document || 1);
    const cad = norm(skills.cad || 1);
    const prog = norm(skills.programming || 1);
    const ms = norm(skills.microsoft || 1);
    const detail = norm(skills.detail_oriented || 1);
    const crit = norm(skills.critical_thinking || 1);
    const proc = norm(skills.process_comprehension || 1);
    const time_m = norm(skills.time_management || 1);
    const collab = norm(skills.collaboration || 1);
    const leader = norm(skills.leadership || 1);

    const atk = Math.round(0.35 * mc_setup + 0.35 * mc_op + 0.20 * inspection + 0.10 * detail);
    const def = Math.round(0.25 * pub_std + 0.30 * cust_spec + 0.25 * int_doc + 0.10 * inspection + 0.10 * detail);
    const hp = Math.round(0.35 * time_m + 0.35 * collab + 0.20 * leader + 0.10 * proc);
    const mp = Math.round(0.35 * prog + 0.30 * cad + 0.15 * ms + 0.20 * crit);

    return { atk, def, hp, mp };
}

async function migrate() {
    const client = await engPool.connect();
    try {
        console.log('🚀 Starting Skills and User Profile Migration...');
        await client.query('BEGIN');

        // 1. Create m_user_skills table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS m_user_skills (
                id SERIAL PRIMARY KEY,
                u_code VARCHAR(50) NOT NULL UNIQUE REFERENCES m_user_profile(u_code) ON DELETE CASCADE,
                
                -- 15 Core Engineering Skills (1-3)
                mc_setup INTEGER DEFAULT 1,
                inspection INTEGER DEFAULT 1,
                mc_operation INTEGER DEFAULT 1,
                public_std INTEGER DEFAULT 1,
                cust_specification INTEGER DEFAULT 1,
                internal_document INTEGER DEFAULT 1,
                cad INTEGER DEFAULT 1,
                programming INTEGER DEFAULT 1,
                microsoft INTEGER DEFAULT 1,
                detail_oriented INTEGER DEFAULT 1,
                critical_thinking INTEGER DEFAULT 1,
                process_comprehension INTEGER DEFAULT 1,
                time_management INTEGER DEFAULT 1,
                collaboration INTEGER DEFAULT 1,
                leadership INTEGER DEFAULT 1,
                
                total_score INTEGER DEFAULT 15,
                atk INTEGER DEFAULT 33,
                def INTEGER DEFAULT 33,
                hp INTEGER DEFAULT 33,
                mp INTEGER DEFAULT 33,
                
                qualifications JSONB DEFAULT '{}'::jsonb,
                evaluation_details JSONB DEFAULT '{}'::jsonb,
                eval_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_m_user_skills_ucode ON m_user_skills(u_code);
        `);
        console.log('✅ Created or verified m_user_skills table.');

        // 2. Ensure missing users from Excel exist in m_user_profile
        const defaultHash = await bcrypt.hash('Eng12345', 10);
        const newUsers = [
            {
                u_code: 'LE685',
                u_name: 'Ittiwat Jantarawongsa',
                u_nickname: 'Aom',
                position: 'Special Engineer',
                u_department: 'ENG',
                user_group: 'ENG',
                role: 'STAFF',
                element: 'Wind',
                theme: 'Light',
                section: 1
            },
            {
                u_code: 'LE679',
                u_name: 'Sataporn Hadsai',
                u_nickname: 'Arm',
                position: 'Process Engineer',
                u_department: 'ENG',
                user_group: 'PROC',
                role: 'STAFF',
                element: 'Water',
                theme: 'Light',
                section: 1
            },
            {
                u_code: 'LE682',
                u_name: 'Jenjira Phonprajak',
                u_nickname: 'Jan',
                position: 'Tooling Engineer',
                u_department: 'ENG',
                user_group: 'MTC',
                role: 'STAFF',
                element: 'Fire',
                theme: 'Light',
                section: 1
            }
        ];

        for (const nu of newUsers) {
            const check = await client.query('SELECT u_code FROM m_user_profile WHERE u_code = $1', [nu.u_code]);
            if (check.rows.length === 0) {
                await client.query(`
                    INSERT INTO m_user_profile 
                    (u_code, u_name, u_nickname, u_pass, position, u_department, user_group, role, element, theme, section, u_status, u_authority, atk, def, hp, mp, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, 4, 33, 33, 33, 33, NOW(), NOW())
                `, [nu.u_code, nu.u_name, nu.u_nickname, defaultHash, nu.position, nu.u_department, nu.user_group, nu.role, nu.element, nu.theme, nu.section]);
                console.log(`👤 Inserted new user into m_user_profile: ${nu.u_code} (${nu.u_name})`);
            }
        }

        // 3. Read File 2: Qualification List of Design Development work
        const file2Path = path.resolve(__dirname, '../../ENG-Frontend/src/components/engineer/system_eng/user_management/skill_managment/Qualification List of Design Development work [Updated Jul 2026].xlsx');
        const wb2 = xlsx.readFile(file2Path);
        const ws2 = wb2.Sheets['Qualified person'];
        const rows2 = xlsx.utils.sheet_to_json(ws2, { header: 1, defval: null });

        const skillKeys = [
            'mc_setup', 'inspection', 'mc_operation',
            'public_std', 'cust_specification', 'internal_document',
            'cad', 'programming', 'microsoft',
            'detail_oriented', 'critical_thinking', 'process_comprehension',
            'time_management', 'collaboration', 'leadership'
        ];

        console.log('📂 Parsing File 2: Design Development Qualifications...');
        for (let r = 4; r < rows2.length; r++) {
            const row = rows2[r];
            if (!row || !row[1]) continue;
            let u_code = String(row[1]).trim();
            const u_name = row[0] ? String(row[0]).trim() : '';

            // Handle LE945 in Excel mapping to LE495 in DB
            if (u_code === 'LE945') {
                const check495 = await client.query('SELECT u_code FROM m_user_profile WHERE u_code = $1', ['LE495']);
                if (check495.rows.length > 0) {
                    u_code = 'LE495';
                }
            }

            // Verify user exists in m_user_profile
            const userCheck = await client.query('SELECT u_code FROM m_user_profile WHERE u_code = $1', [u_code]);
            if (userCheck.rows.length === 0) {
                console.warn(`⚠️ User ${u_code} (${u_name}) not found in m_user_profile, skipping...`);
                continue;
            }

            // Skills are in columns 16 to 30 (0-indexed: 16 = Col Q = M/C setup)
            const skills = {};
            let total_score = 0;
            for (let i = 0; i < skillKeys.length; i++) {
                const key = skillKeys[i];
                let val = Number(row[16 + i]);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 3) val = 3;
                skills[key] = val;
                total_score += val;
            }

            const powers = calculatePowers(skills);

            // Qualifications in columns 5 to 15 (0-indexed)
            const quals = {
                date_entered: row[3] || null,
                experience_text: row[4] || null,
                aerospace_commercial: {
                    new_model: {
                        draw_prepare: row[5] === '★' || row[5] === '*',
                        check: row[6] === '★' || row[6] === '*'
                    },
                    revise: {
                        draw_prepare: row[7] === '★' || row[7] === '*',
                        check: row[8] === '★' || row[8] === '*'
                    }
                },
                tooling: {
                    new: {
                        draw_prepare: row[9] === '★' || row[9] === '*',
                        check: row[10] === '★' || row[10] === '*'
                    },
                    revise: {
                        draw_prepare: row[11] === '★' || row[11] === '*',
                        check: row[12] === '★' || row[12] === '*'
                    }
                },
                others_specification: {
                    review: row[13] === '★' || row[13] === '*',
                    check: row[14] === '★' || row[14] === '*',
                    approval: row[15] === '★' || row[15] === '*'
                }
            };

            // Upsert into m_user_skills
            await client.query(`
                INSERT INTO m_user_skills (
                    u_code, mc_setup, inspection, mc_operation,
                    public_std, cust_specification, internal_document,
                    cad, programming, microsoft,
                    detail_oriented, critical_thinking, process_comprehension,
                    time_management, collaboration, leadership,
                    total_score, atk, def, hp, mp,
                    qualifications, evaluation_details, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, NOW()
                )
                ON CONFLICT (u_code) DO UPDATE SET
                    mc_setup = EXCLUDED.mc_setup,
                    inspection = EXCLUDED.inspection,
                    mc_operation = EXCLUDED.mc_operation,
                    public_std = EXCLUDED.public_std,
                    cust_specification = EXCLUDED.cust_specification,
                    internal_document = EXCLUDED.internal_document,
                    cad = EXCLUDED.cad,
                    programming = EXCLUDED.programming,
                    microsoft = EXCLUDED.microsoft,
                    detail_oriented = EXCLUDED.detail_oriented,
                    critical_thinking = EXCLUDED.critical_thinking,
                    process_comprehension = EXCLUDED.process_comprehension,
                    time_management = EXCLUDED.time_management,
                    collaboration = EXCLUDED.collaboration,
                    leadership = EXCLUDED.leadership,
                    total_score = EXCLUDED.total_score,
                    atk = EXCLUDED.atk,
                    def = EXCLUDED.def,
                    hp = EXCLUDED.hp,
                    mp = EXCLUDED.mp,
                    qualifications = EXCLUDED.qualifications,
                    updated_at = NOW()
            `, [
                u_code,
                skills.mc_setup, skills.inspection, skills.mc_operation,
                skills.public_std, skills.cust_specification, skills.internal_document,
                skills.cad, skills.programming, skills.microsoft,
                skills.detail_oriented, skills.critical_thinking, skills.process_comprehension,
                skills.time_management, skills.collaboration, skills.leadership,
                total_score, powers.atk, powers.def, powers.hp, powers.mp,
                JSON.stringify(quals), JSON.stringify({})
            ]);

            // Update m_user_profile
            await client.query(`
                UPDATE m_user_profile 
                SET atk = $1, def = $2, hp = $3, mp = $4, updated_at = NOW()
                WHERE u_code = $5
            `, [powers.atk, powers.def, powers.hp, powers.mp, u_code]);

            console.log(`  ✓ ${u_code.padEnd(6)} | Total: ${String(total_score).padStart(2)} | ATK: ${String(powers.atk).padStart(3)} DEF: ${String(powers.def).padStart(3)} HP: ${String(powers.hp).padStart(3)} MP: ${String(powers.mp).padStart(3)}`);
        }

        // 4. Read File 1: Evaluation Form for ENG-2026 (SECTION OVERALL)
        console.log('\n📂 Parsing File 1: Evaluation Form 2026 (SECTION OVERALL)...');
        const file1Path = path.resolve(__dirname, '../../ENG-Frontend/src/components/engineer/system_eng/user_management/skill_managment/Evaluation Form for ENG-2026.xlsx');
        const wb1 = xlsx.readFile(file1Path);
        const ws1 = wb1.Sheets['SECTION OVERALL'];
        const rows1 = xlsx.utils.sheet_to_json(ws1, { header: 1, defval: null });

        // Column indices for the 4 users (0-indexed)
        // Col 4 = L6121, Col 5 = F1754, Col 6 = LE216, Col 7 = LE511
        const file1UserCols = [
            { col: 4, u_code: 'L6121', name: 'Suranat Naka' },
            { col: 5, u_code: 'F1754', name: 'Kanjana Janyim' },
            { col: 6, u_code: 'LE216', name: 'Wirayut Phlaikhong' },
            { col: 7, u_code: 'LE511', name: 'Kanyarat Juyjaroen' }
        ];

        // Gather all 33 questions and scores
        for (const u of file1UserCols) {
            const userCheck = await client.query('SELECT u_code FROM m_user_profile WHERE u_code = $1', [u.u_code]);
            if (userCheck.rows.length === 0) continue;

            const evalDetails = {
                sections: {
                    general_drawing_control: [],
                    drawing_verification: [],
                    tooling_inspector: []
                }
            };

            for (let r = 6; r <= 70; r += 2) {
                const row = rows1[r];
                if (!row) continue;
                const qText = row[3];
                const score = Number(row[u.col]) || 0;
                if (!qText) continue;

                if (r <= 26) {
                    evalDetails.sections.general_drawing_control.push({ question: qText, score });
                } else if (r <= 48) {
                    evalDetails.sections.drawing_verification.push({ question: qText, score });
                } else {
                    evalDetails.sections.tooling_inspector.push({ question: qText, score });
                }
            }

            // Map each user's specific performance profile to the 15 skills
            let skills = {};
            if (u.u_code === 'L6121') { // Tooling Inspector / Draftman
                skills = {
                    mc_setup: 3, inspection: 3, mc_operation: 2,
                    public_std: 2, cust_specification: 2, internal_document: 3,
                    cad: 3, programming: 1, microsoft: 2,
                    detail_oriented: 3, critical_thinking: 2, process_comprehension: 3,
                    time_management: 3, collaboration: 3, leadership: 3
                };
            } else if (u.u_code === 'F1754') { // Clerk / Drawing Verification Lead
                skills = {
                    mc_setup: 1, inspection: 1, mc_operation: 1,
                    public_std: 3, cust_specification: 3, internal_document: 3,
                    cad: 1, programming: 1, microsoft: 3,
                    detail_oriented: 3, critical_thinking: 2, process_comprehension: 3,
                    time_management: 3, collaboration: 3, leadership: 3
                };
            } else if (u.u_code === 'LE216') { // Machine Program / Tooling Inspector
                skills = {
                    mc_setup: 3, inspection: 3, mc_operation: 3,
                    public_std: 2, cust_specification: 2, internal_document: 2,
                    cad: 2, programming: 3, microsoft: 2,
                    detail_oriented: 3, critical_thinking: 2, process_comprehension: 3,
                    time_management: 3, collaboration: 3, leadership: 2
                };
            } else if (u.u_code === 'LE511') { // Operator / Traveler Verification
                skills = {
                    mc_setup: 1, inspection: 1, mc_operation: 2,
                    public_std: 2, cust_specification: 2, internal_document: 3,
                    cad: 1, programming: 1, microsoft: 2,
                    detail_oriented: 3, critical_thinking: 2, process_comprehension: 2,
                    time_management: 3, collaboration: 2, leadership: 1
                };
            }

            let total_score = 0;
            for (const k of skillKeys) total_score += (skills[k] || 1);

            const powers = calculatePowers(skills);

            await client.query(`
                INSERT INTO m_user_skills (
                    u_code, mc_setup, inspection, mc_operation,
                    public_std, cust_specification, internal_document,
                    cad, programming, microsoft,
                    detail_oriented, critical_thinking, process_comprehension,
                    time_management, collaboration, leadership,
                    total_score, atk, def, hp, mp,
                    qualifications, evaluation_details, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, NOW()
                )
                ON CONFLICT (u_code) DO UPDATE SET
                    mc_setup = EXCLUDED.mc_setup,
                    inspection = EXCLUDED.inspection,
                    mc_operation = EXCLUDED.mc_operation,
                    public_std = EXCLUDED.public_std,
                    cust_specification = EXCLUDED.cust_specification,
                    internal_document = EXCLUDED.internal_document,
                    cad = EXCLUDED.cad,
                    programming = EXCLUDED.programming,
                    microsoft = EXCLUDED.microsoft,
                    detail_oriented = EXCLUDED.detail_oriented,
                    critical_thinking = EXCLUDED.critical_thinking,
                    process_comprehension = EXCLUDED.process_comprehension,
                    time_management = EXCLUDED.time_management,
                    collaboration = EXCLUDED.collaboration,
                    leadership = EXCLUDED.leadership,
                    total_score = EXCLUDED.total_score,
                    atk = EXCLUDED.atk,
                    def = EXCLUDED.def,
                    hp = EXCLUDED.hp,
                    mp = EXCLUDED.mp,
                    evaluation_details = EXCLUDED.evaluation_details,
                    updated_at = NOW()
            `, [
                u.u_code,
                skills.mc_setup, skills.inspection, skills.mc_operation,
                skills.public_std, skills.cust_specification, skills.internal_document,
                skills.cad, skills.programming, skills.microsoft,
                skills.detail_oriented, skills.critical_thinking, skills.process_comprehension,
                skills.time_management, skills.collaboration, skills.leadership,
                total_score, powers.atk, powers.def, powers.hp, powers.mp,
                JSON.stringify({}), JSON.stringify(evalDetails)
            ]);

            await client.query(`
                UPDATE m_user_profile 
                SET atk = $1, def = $2, hp = $3, mp = $4, updated_at = NOW()
                WHERE u_code = $5
            `, [powers.atk, powers.def, powers.hp, powers.mp, u.u_code]);

            console.log(`  ✓ ${u.u_code.padEnd(6)} | Total: ${String(total_score).padStart(2)} | ATK: ${String(powers.atk).padStart(3)} DEF: ${String(powers.def).padStart(3)} HP: ${String(powers.hp).padStart(3)} MP: ${String(powers.mp).padStart(3)}`);
        }

        // 5. Insert baseline for remaining users in m_user_profile
        const remaining = await client.query(`
            INSERT INTO m_user_skills (
                u_code, mc_setup, inspection, mc_operation,
                public_std, cust_specification, internal_document,
                cad, programming, microsoft,
                detail_oriented, critical_thinking, process_comprehension,
                time_management, collaboration, leadership,
                total_score, atk, def, hp, mp
            )
            SELECT 
                u_code, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 15,
                COALESCE(NULLIF(atk, 0), 33),
                COALESCE(NULLIF(def, 0), 33),
                COALESCE(NULLIF(hp, 0), 33),
                COALESCE(NULLIF(mp, 0), 33)
            FROM m_user_profile
            WHERE u_code NOT IN (SELECT u_code FROM m_user_skills)
            ON CONFLICT (u_code) DO NOTHING
        `);
        if (remaining.rowCount > 0) {
            console.log(`\n✨ Added baseline skill records for ${remaining.rowCount} other users.`);
        }

        await client.query('COMMIT');
        console.log('\n🎉 Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('💥 Migration error:', err);
        throw err;
    } finally {
        client.release();
        await engPool.end();
    }
}

migrate();
