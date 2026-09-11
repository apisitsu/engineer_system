const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const xlsx = require('xlsx');
const { engPool } = require('../instance/eng_db');

// The 33 Leader skills mapped in exact order from Evaluation Form for ENG-2026.xlsx
const LEADER_SKILL_DEFINITIONS = [
    // 1. General Drawing Control (Rows 13-33, step 2)
    { key: 'me10_basic', category: 'general_drawing', label: 'ME10 Program using (Drafting Basics)', desc: 'Basic ME10 commands, drafting interface, navigation' },
    { key: 'jig_fixture_concept', category: 'general_drawing', label: 'Jig & Fixture Comprehension & Advisory', desc: 'Understanding jig/fixture principles, operational guidance' },
    { key: 'drawing_symbols', category: 'general_drawing', label: 'Drawing Symbols & Basics Comprehension', desc: 'Comprehending engineering symbols, tolerances, and notations' },
    { key: 'drawing_database', category: 'general_drawing', label: 'General Drawing Database Operations', desc: 'Accessing drawing database, status logging, revision tracking' },
    { key: 'teaching_me10', category: 'general_drawing', label: 'Teaching ME10 to Newcomers', desc: 'Training junior technicians on CAD and drafting procedures' },
    { key: 'handling_situations', category: 'general_drawing', label: 'Handling Situations During Work', desc: 'Troubleshooting drafting issues, resolving unexpected hurdles' },
    { key: 'jig_fixture_design', category: 'general_drawing', label: 'Jig & Fixture Design & Material Guidance', desc: 'Designing fixtures, material selection, mechanical feasibility' },
    { key: 'target_delivery', category: 'general_drawing', label: 'Responsibility & On-Time Target Delivery', desc: 'Delivering drafting deliverables reliably according to schedule' },
    { key: 'prioritization', category: 'general_drawing', label: 'Work Prioritization Under High Volume', desc: 'Managing heavy queue, urgent task triage, milestone planning' },
    { key: 'drawing_drafting', category: 'general_drawing', label: 'Drawing Drafting Fundamentals', desc: 'Drafting principles, projection views, engineering compliance' },
    { key: 'external_communication', category: 'general_drawing', label: 'External Stakeholder Communication', desc: 'Coordinating with clients, suppliers, and external parties' },

    // 2. Tooling Inspector (Rows 35-55, step 2)
    { key: 'purchase_tooling_sys', category: 'tooling_inspector', label: 'Purchase + Tooling Center Workflow', desc: 'Understanding procurement flow and tooling inventory systems' },
    { key: 'read_drawing_symbols', category: 'tooling_inspector', label: 'Read Drawings & Understand Symbols', desc: 'Reading inspection drawings and understanding GD&T symbols' },
    { key: 'instrument_selection', category: 'tooling_inspector', label: 'Measurement Instrument Selection', desc: 'Selecting appropriate gauge and instrument for tolerance requirements' },
    { key: 'basic_instruments', category: 'tooling_inspector', label: 'Vernier Caliper / Micrometer / Digimatic', desc: 'Proficient usage of standard manual measurement equipment' },
    { key: 'contour_projector', category: 'tooling_inspector', label: 'Contour & Optical Projector Operation', desc: 'Operating profile projectors and contour measurement machines' },
    { key: 'cmm_operation', category: 'tooling_inspector', label: 'CMM (Coordinate Measuring Machine)', desc: 'Programming and operating 3D CMM inspection systems' },
    { key: 'dimensional_reporting', category: 'tooling_inspector', label: 'Workpiece Measurement & Report Accuracy', desc: 'Accurate workpiece inspection and defect recording' },
    { key: 'out_of_spec_action', category: 'tooling_inspector', label: 'Out-of-Spec Decision & Initial Action', desc: 'Actioning non-conforming parts and dispositioning findings' },
    { key: 'tooling_purpose', category: 'tooling_inspector', label: 'Tooling Purpose Comprehension', desc: 'Comprehending tooling function to determine key inspection points' },
    { key: 'target_return_otd', category: 'tooling_inspector', label: 'OTD Return to Purchase Target', desc: 'Meeting delivery commitment dates for returned tooling' },
    { key: 'tooling_advisory', category: 'tooling_inspector', label: 'Tooling Inspection Advisory & Consultation', desc: 'Providing technical advice on tooling inspection and quality' },

    // 3. Drawing Verification (Rows 57-77, step 2)
    { key: 'wi_dv_compliance', category: 'drawing_verification', label: 'WI-DV-EN-000001 Verification Compliance', desc: 'Checking drawings and travelers strictly against WI-DV-EN-000001' },
    { key: 'lot_release_priority', category: 'drawing_verification', label: 'Lot Prioritization & Release', desc: 'Triage and release prioritization when traveler volume is heavy' },
    { key: 'troubleshooting', category: 'drawing_verification', label: 'Preemptive Problem Solving in Verification', desc: 'Foreseeing issues during verification and applying remedies' },
    { key: 'excel_reporting', category: 'drawing_verification', label: 'Excel Data Recording & Traceability', desc: 'Logging inspection data in Excel for full audit traceability' },
    { key: 'anomaly_detection', category: 'drawing_verification', label: 'Zero Defect Escape & Anomaly Detection', desc: 'Detecting subtle anomalies on traveler sheets and drawings' },
    { key: 'training_wi_dv', category: 'drawing_verification', label: 'Training Others on WI-DV-EN-000001', desc: 'Training staff and newcomers on verification procedures' },
    { key: 'anomaly_action', category: 'drawing_verification', label: 'Traveler Anomaly Classification & Action', desc: 'Categorizing discrepancies and initiating corrective workflow' },
    { key: 'continuous_improvement', category: 'drawing_verification', label: 'Continuous Improvement & Innovation', desc: 'Proposing process optimizations and new verification methods' },
    { key: 'otd_traveler_pc', category: 'drawing_verification', label: 'OTD Traveler & Drawing Distribution to PC', desc: 'Returning travelers to Production Control on schedule (OTD)' },
    { key: 'computer_mrp', category: 'drawing_verification', label: 'Computer, Website, MRP & Drawing Systems', desc: 'Proficiently using MRP and web portals to retrieve drawings' },
    { key: 'ot_planning', category: 'drawing_verification', label: 'Overtime & Capacity Planning', desc: 'Planning overtime and workload when incoming traveler queue spikes' }
];

const norm4 = (v) => (Number(v || 0) / 4.0) * 100;

function calculateLeaderPowers(skills) {
    // ATK (Machining & Tooling Inspection)
    const atk = Math.round(
        0.15 * norm4(skills.basic_instruments) +
        0.15 * norm4(skills.contour_projector) +
        0.20 * norm4(skills.cmm_operation) +
        0.15 * norm4(skills.instrument_selection) +
        0.15 * norm4(skills.dimensional_reporting) +
        0.10 * norm4(skills.jig_fixture_design) +
        0.10 * norm4(skills.jig_fixture_concept)
    );

    // DEF (Standards, Quality & Verification)
    const def = Math.round(
        0.25 * norm4(skills.wi_dv_compliance) +
        0.20 * norm4(skills.anomaly_detection) +
        0.15 * norm4(skills.anomaly_action) +
        0.15 * norm4(skills.read_drawing_symbols) +
        0.15 * norm4(skills.drawing_symbols) +
        0.10 * norm4(skills.out_of_spec_action)
    );

    // HP (Leadership, Execution & Time)
    const hp = Math.round(
        0.20 * norm4(skills.target_delivery) +
        0.20 * norm4(skills.otd_traveler_pc) +
        0.15 * norm4(skills.prioritization) +
        0.15 * norm4(skills.training_wi_dv) +
        0.10 * norm4(skills.teaching_me10) +
        0.10 * norm4(skills.external_communication) +
        0.10 * norm4(skills.ot_planning)
    );

    // MP (Software, CAD & Systems)
    const mp = Math.round(
        0.30 * norm4(skills.me10_basic) +
        0.25 * norm4(skills.drawing_drafting) +
        0.20 * norm4(skills.drawing_database) +
        0.15 * norm4(skills.computer_mrp) +
        0.10 * norm4(skills.excel_reporting)
    );

    return { atk, def, hp, mp };
}

async function run() {
    const client = await engPool.connect();
    try {
        console.log('--- Starting Leader Skills & Yearly History Migration ---');
        await client.query('BEGIN');

        // 1. Ensure m_user_skills has necessary columns
        await client.query(`
            ALTER TABLE m_user_skills 
            ADD COLUMN IF NOT EXISTS evaluation_type VARCHAR(20) DEFAULT 'staff',
            ADD COLUMN IF NOT EXISTS leader_skills JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS evaluation_history JSONB DEFAULT '[]'::jsonb;
        `);
        console.log('✅ Verified m_user_skills schema.');

        // 2. Load Evaluation Form for ENG-2026.xlsx
        const excelPath = path.resolve(
            __dirname,
            '../../ENG-Frontend/src/components/engineer/system_eng/user_management/skill_managment/Evaluation Form for ENG-2026.xlsx'
        );
        const wb = xlsx.readFile(excelPath);

        const leaderSheets = ['L6121', 'F1754', 'LE216', 'LE511'];

        for (const u_code of leaderSheets) {
            const ws = wb.Sheets[u_code];
            if (!ws) {
                console.warn(`⚠️ Sheet ${u_code} not found, skipping.`);
                continue;
            }

            const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

            const years = data[9] || [];
            const quarters = data[10] || [];
            const months = data[11] || [];

            // Build timeline columns
            let currentYear = '';
            const timeline = [];
            for (let c = 2; c < quarters.length; c++) {
                if (years[c] && String(years[c]).trim()) {
                    currentYear = String(years[c]).trim();
                }
                const q = quarters[c] ? String(quarters[c]).trim() : '';
                const m = months[c] ? String(months[c]).trim() : '';
                if (currentYear && q) {
                    timeline.push({
                        col: c,
                        fiscal_year: currentYear,
                        quarter: q,
                        month: m,
                        label: `${currentYear} ${q} (${m})`
                    });
                }
            }

            console.log(`\nProcessing ${u_code} with ${timeline.length} quarterly timeline entries...`);

            // Extract rows for 33 skills
            // In the sheet, General Drawing Control: rows 13-33 (step 2)
            // Tooling Inspector: rows 35-55 (step 2)
            // Drawing Verification: rows 57-77 (step 2)
            const skillRowMap = [];
            let skillIdx = 0;

            // General Drawing Control (11 skills)
            for (let r = 12; r <= 32; r += 2) {
                if (skillIdx < 11) {
                    skillRowMap.push({ row: r, def: LEADER_SKILL_DEFINITIONS[skillIdx++] });
                }
            }
            // Tooling Inspector (11 skills)
            for (let r = 34; r <= 54; r += 2) {
                if (skillIdx < 22) {
                    skillRowMap.push({ row: r, def: LEADER_SKILL_DEFINITIONS[skillIdx++] });
                }
            }
            // Drawing Verification (11 skills)
            for (let r = 56; r <= 76; r += 2) {
                if (skillIdx < 33) {
                    skillRowMap.push({ row: r, def: LEADER_SKILL_DEFINITIONS[skillIdx++] });
                }
            }

            // Extract evaluation history for each quarter
            const history = [];
            for (const t of timeline) {
                const quarterSkills = {};
                let hasAnyScore = false;

                for (const s of skillRowMap) {
                    const rawVal = data[s.row] ? data[s.row][t.col] : 0;
                    const val = Number(rawVal) || 0;
                    quarterSkills[s.def.key] = val;
                    if (val > 0) hasAnyScore = true;
                }

                const quarterPowers = calculateLeaderPowers(quarterSkills);
                const totalScore = Object.values(quarterSkills).reduce((a, b) => a + b, 0);

                history.push({
                    fiscal_year: t.fiscal_year,
                    quarter: t.quarter,
                    month: t.month,
                    label: t.label,
                    has_data: hasAnyScore,
                    total_score: totalScore,
                    powers: quarterPowers,
                    skills: quarterSkills
                });
            }

            // Find latest active quarter
            const activeQuarters = history.filter(h => h.has_data);
            const latest = activeQuarters.length > 0 ? activeQuarters[activeQuarters.length - 1] : history[history.length - 1];

            console.log(`  -> Latest Quarter: ${latest.label} | Total: ${latest.total_score}/132`);
            console.log(`  -> Powers: ATK=${latest.powers.atk}, DEF=${latest.powers.def}, HP=${latest.powers.hp}, MP=${latest.powers.mp}`);

            // Ensure user exists in m_user_profile with role = 'LEADER'
            await client.query(`
                UPDATE m_user_profile 
                SET role = 'LEADER',
                    atk = $1, def = $2, hp = $3, mp = $4,
                    updated_at = NOW()
                WHERE u_code = $5;
            `, [latest.powers.atk, latest.powers.def, latest.powers.hp, latest.powers.mp, u_code]);

            // Upsert into m_user_skills
            await client.query(`
                INSERT INTO m_user_skills (
                    u_code, evaluation_type, leader_skills, evaluation_history,
                    atk, def, hp, mp, total_score, updated_at
                )
                VALUES ($1, 'leader', $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (u_code) DO UPDATE SET
                    evaluation_type = 'leader',
                    leader_skills = EXCLUDED.leader_skills,
                    evaluation_history = EXCLUDED.evaluation_history,
                    atk = EXCLUDED.atk,
                    def = EXCLUDED.def,
                    hp = EXCLUDED.hp,
                    mp = EXCLUDED.mp,
                    total_score = EXCLUDED.total_score,
                    updated_at = NOW();
            `, [
                u_code,
                JSON.stringify(latest.skills),
                JSON.stringify(history),
                latest.powers.atk,
                latest.powers.def,
                latest.powers.hp,
                latest.powers.mp,
                latest.total_score
            ]);

            console.log(`✅ Upserted Leader skills & history for ${u_code}`);
        }

        await client.query('COMMIT');
        console.log('🎉 Leader migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration error:', err);
        throw err;
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
