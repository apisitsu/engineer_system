const path = require('path');
const envPath = path.resolve(__dirname, 'apps/ENG-Backend/.env');
require('dotenv').config({ path: envPath, override: true });

const { engPool } = require('./apps/ENG-Backend/instance/eng_db');
const { maqPool } = require('./apps/ENG-Backend/instance/maq_db');
const { pool: rodpcPool } = require('./apps/ENG-Backend/instance/instance');

/**
 * Utility to convert control_no (e.g. C23-00647) to cn (e.g. 230647)
 */
function cnToItemNo(cn) {
    if (!cn) return null;
    const match = cn.match(/^[CA](\d{2})-0(\d{4})$/);
    if (match) {
        return match[1] + match[2];
    }
    return null;
}

/**
 * Utility to identify process type (OD/ID)
 */
function getProcessType(name, eng) {
    const combined = (name + ' ' + eng).toUpperCase();
    if (combined.includes('SPHERE') || combined.includes('SPH')) return 'OD';
    const isOD = ['OD', 'OUTER', 'OUTSIDE', 'CYLINDRICAL'].some(k => combined.includes(k));
    const isID = ['ID', 'INNER', 'INSIDE'].some(k => combined.includes(k));
    if (isOD) return 'OD';
    if (isID) return 'ID';
    return null;
}

async function initSpecProcess() {
    try {
        console.log('--- STARTING SPEC_PROCESS INITIALIZATION ---');

        // 1. Ensure table exists and CN is unique
        await engPool.query(`
            CREATE TABLE IF NOT EXISTS spec_process (
                id SERIAL PRIMARY KEY,
                cn VARCHAR(20),
                od_aft NUMERIC,
                id_aft NUMERIC,
                w_aft NUMERIC,
                sd NUMERIC,
                yball VARCHAR(2),
                process VARCHAR(20),
                type VARCHAR(50),
                update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure unique constraint on cn, but first clean up duplicates if any
        console.log('Cleaning up duplicate CNs...');
        await engPool.query(`
            DELETE FROM spec_process a USING spec_process b 
            WHERE a.id < b.id AND a.cn = b.cn
        `);

        try {
            await engPool.query('ALTER TABLE spec_process ADD CONSTRAINT spec_process_cn_unique UNIQUE (cn)');
            console.log('- Ensured unique constraint on CN.');
        } catch (e) {
            // Might already exist
        }

        // Function for upsert-like behavior
        const upsertSpec = async (cn, data) => {
            const check = await engPool.query('SELECT id FROM spec_process WHERE cn = $1', [cn]);
            if (check.rows.length > 0) {
                // UPDATE
                const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
                await engPool.query(`UPDATE spec_process SET ${fields} WHERE cn = $1`, [cn, ...Object.values(data)]);
            } else {
                // INSERT
                const cols = ['cn', ...Object.keys(data)].join(', ');
                const vals = ['$1', ...Object.keys(data).map((_, i) => `$${i + 2}`)].join(', ');
                await engPool.query(`INSERT INTO spec_process (${cols}) VALUES (${vals})`, [cn, ...Object.values(data)]);
            }
        };

        // 2. Import from lpb.eng_race
        console.log('1/4: Importing Race data...');
        const resRace = await maqPool.query('SELECT control_no, od, id, width FROM lpb.eng_race');
        for (const row of resRace.rows) {
            const itemNo = cnToItemNo(row.control_no);
            if (!itemNo) continue;
            await upsertSpec(itemNo, { od_aft: row.od, id_aft: row.id, w_aft: row.width });
        }
        console.log(`- Processed ${resRace.rows.length} Race items.`);

        // 3. Import from lpb.eng_ball
        console.log('2/4: Importing Ball data...');
        const resBallData = await maqPool.query('SELECT control_no, ball_dia, in_dia, width, shoulder_dia FROM lpb.eng_ball');
        for (const row of resBallData.rows) {
            const itemNo = cnToItemNo(row.control_no);
            if (!itemNo) continue;
            await upsertSpec(itemNo, { od_aft: row.ball_dia, id_aft: row.in_dia, w_aft: row.width, sd: row.shoulder_dia });
        }
        console.log(`- Processed ${resBallData.rows.length} Ball items.`);

        // 4. Update yball flags
        console.log('3/4: Updating yball flags...');
        await engPool.query("UPDATE spec_process SET yball = 'Y' WHERE cn LIKE '35%'");
        await engPool.query("UPDATE spec_process SET yball = 'N' WHERE cn LIKE '3%' AND cn NOT LIKE '35%' AND (yball IS NULL OR yball = '')");
        console.log('- yball flags updated.');

        // 5. Update process sequence (OD=>ID, ID=>OD)
        console.log('4/4: Updating process sequences (Sphere = OD)...');
        
        // Fetch masters
        const masterRes = await rodpcPool.query('SELECT process_code, process_name, process_eng FROM rodpc.kzwmaq_eng_process');
        const processMaster = new Map();
        masterRes.rows.forEach(r => {
            processMaster.set(r.process_code, getProcessType(r.process_name, r.process_eng));
        });

        // Fetch all process info (Batch)
        const allProcRes = await maqPool.query('SELECT process_plan_no, process_code, seq_no, process_seqno FROM lpb.eng_process_info');
        const procGroupByCn = new Map();
        allProcRes.rows.forEach(r => {
            if (!procGroupByCn.has(r.process_plan_no)) procGroupByCn.set(r.process_plan_no, []);
            procGroupByCn.get(r.process_plan_no).push(r);
        });

        // Mapping for indirect CNs
        const itemMapRes = await maqPool.query('SELECT control_no, process_plan_no FROM lpb.eng_r_pi_item');
        const itemToPlan = new Map();
        itemMapRes.rows.forEach(r => {
            itemToPlan.set(r.control_no, r.process_plan_no);
        });

        // Get all CNs to process
        const specRes = await engPool.query('SELECT cn FROM spec_process');
        let procUpdateCount = 0;

        for (const r of specRes.rows) {
            const itemNo = r.cn;
            const prefix = itemNo.startsWith('3') ? 'C' : itemNo.startsWith('2') ? 'C' : 'A';
            const fullCn = `${prefix}${itemNo.slice(0, 2)}-0${itemNo.slice(2)}`;

            let myProcs = procGroupByCn.get(fullCn) || [];
            if (myProcs.length === 0 && itemToPlan.has(fullCn)) {
                myProcs = procGroupByCn.get(itemToPlan.get(fullCn)) || [];
            }

            if (myProcs.length === 0) continue;

            myProcs.sort((a, b) => (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0) || (parseInt(a.process_seqno) || 0) - (parseInt(b.process_seqno) || 0));

            let firstOD = Infinity, firstID = Infinity;
            myProcs.forEach((p, idx) => {
                const type = processMaster.get(p.process_code);
                if (type === 'OD' && firstOD === Infinity) firstOD = idx;
                if (type === 'ID' && firstID === Infinity) firstID = idx;
            });

            let status = null;
            if (firstOD !== Infinity && firstID !== Infinity) status = firstOD < firstID ? 'OD=>ID' : 'ID=>OD';
            else if (firstOD !== Infinity) status = 'OD Only';
            else if (firstID !== Infinity) status = 'ID Only';

            if (status) {
                await engPool.query('UPDATE spec_process SET process = $1 WHERE cn = $2', [status, itemNo]);
                procUpdateCount++;
            }
        }
        console.log(`- Updated ${procUpdateCount} process sequences.`);

        console.log('\n--- INITIALIZATION COMPLETED SUCCESSFULLY ---');

    } catch (err) {
        console.error('Initialization failed:', err);
    } finally {
        await engPool.end();
        await maqPool.end();
        await rodpcPool.end();
    }
}

initSpecProcess();
