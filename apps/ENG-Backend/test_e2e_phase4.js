// E2E API Test for ECR/ECN Workflow - Phase 4 Verification
// Tests: Create ECR → Step 3.1-3.6 Approve → Close
const http = require('http');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:2005';
const JWT_SECRET = 'ENG_SYSTEM_SECRET_KEY';

// Generate a valid test token
const token = jwt.sign(
    { empno: 'admin', name: 'Admin', role: 'AD' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTest() {
    console.log('=== ECR/ECN E2E API Test (Phase 4 - with Auth) ===\n');

    // 1. Create ECR
    console.log('1. Creating ECR...');
    const createRes = await makeRequest('POST', '/api/ecr/create', {
        request_by: 'Admin ECR Test',
        department: 'Admin',
        require_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'Permanent',
        objective: 'Reduce cycle',
        is_drawing: true,
        is_tooling: false,
        is_program: true,
        is_usage: false,
        part_no_drawing: 'PN-TEST-001',
        cn_drawing: 'CN-001',
        rev_drawing: 'A',
        drawing_before_change: 'Old drawing spec',
        drawing_after_change: 'New drawing spec',
        process_status: 'Pending Dept Mgr',
    });
    console.log('   Create response:', JSON.stringify(createRes.body));
    const ecrId = createRes.body.id;
    if (!ecrId) { console.log('   ❌ Failed to create ECR!'); return; }
    console.log(`   ✅ Created ECR with id=${ecrId}`);

    // 2. Verify ECR in list
    console.log('\n2. Verifying ECR in list...');
    const listRes = await makeRequest('GET', '/api/ecr/getlist');
    const listData = listRes.body.data || listRes.body;
    const found = Array.isArray(listData) ? listData.find(e => e.id === ecrId) : null;
    if (found) {
        console.log(`   ✅ Found in list. process_status="${found.process_status}", is_drawing=${found.is_drawing} (type: ${typeof found.is_drawing})`);
    } else {
        console.log('   ❌ Not found in list! Response:', JSON.stringify(listRes.body).substring(0, 200));
    }

    // 3. Walk through all workflow steps
    const steps = [
        { step: '3.1', nextStatus: 'Impact Assessment', action: 'Approve', comment: 'Dept Mgr approved' },
        { step: '3.2', nextStatus: 'Pending ECN Approval', action: 'Approve', comment: 'Impact Assessment Completed' },
        { step: '3.3', nextStatus: 'Top Mgmt Approval', action: 'Issue ECN', comment: 'ECN Issued' },
        { step: '3.4', nextStatus: 'DWG Suspension', action: 'Approve', comment: 'Top Mgmt approved' },
        { step: '3.45', nextStatus: 'ECN Execution', action: 'Confirm DWG Suspend', comment: 'DWG suspended' },
        { step: '3.5', nextStatus: 'FAI Process', action: 'Approve', comment: 'Execution Plan saved' },
        { step: '3.6', nextStatus: 'Closed', action: 'Approve', comment: 'FAI Summary submitted' },
    ];

    let allStepsPassed = true;
    for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        console.log(`\n${i + 3}. Step ${s.step}: ${s.action}...`);
        const payload = {
            step_number: s.step,
            action_by: 'Admin ECR Test',
            action_role: 'AD',
            action_status: s.action,
            comments: s.comment,
            details: { test: true },
        };
        const res = await makeRequest('PUT', `/api/ecr/${ecrId}/status`, payload);
        console.log(`   Response: ${JSON.stringify(res.body)}`);

        // Verify process_status updated
        const detailRes = await makeRequest('GET', `/api/ecr/${ecrId}`);
        const currentStatus = detailRes.body.data.process_status;
        const logCount = detailRes.body.logs.length;
        if (currentStatus === s.nextStatus) {
            console.log(`   ✅ process_status="${currentStatus}" (expected "${s.nextStatus}"), logs=${logCount}`);
        } else {
            console.log(`   ❌ process_status="${currentStatus}" (expected "${s.nextStatus}"), logs=${logCount}`);
            allStepsPassed = false;
        }
    }

    // Final verification
    console.log('\n\n=== FINAL VERIFICATION ===');
    const finalRes = await makeRequest('GET', `/api/ecr/${ecrId}`);
    const finalData = finalRes.body.data;
    const finalLogs = finalRes.body.logs;
    console.log(`ECR ${finalData.ecr_no}:`);
    console.log(`  process_status: ${finalData.process_status}`);
    console.log(`  is_drawing: ${finalData.is_drawing} (type: ${typeof finalData.is_drawing})`);
    console.log(`  is_program: ${finalData.is_program} (type: ${typeof finalData.is_program})`);
    console.log(`  Total approval logs: ${finalLogs.length}`);
    console.log(`\n  Log summary:`);
    finalLogs.forEach(log => {
        console.log(`    Step ${log.step_number}: ${log.action_status} by ${log.action_by}`);
    });

    const allPassed = finalData.process_status === 'Closed' && finalLogs.length === 7 && typeof finalData.is_drawing === 'boolean' && allStepsPassed;
    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    // Test Deny scenario
    console.log('\n\n=== BONUS: Test Deny Scenario ===');
    const createRes2 = await makeRequest('POST', '/api/ecr/create', {
        request_by: 'Test Deny User',
        department: 'QA',
        require_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'Temporary',
        objective: 'Test denial',
        is_drawing: false,
        is_tooling: true,
        is_program: false,
        is_usage: true,
        process_status: 'Pending Dept Mgr',
    });
    const denyId = createRes2.body.id;
    console.log(`   Created test ECR id=${denyId}`);

    const denyRes = await makeRequest('PUT', `/api/ecr/${denyId}/status`, {
        step_number: '3.1',
        action_by: 'Test Manager',
        action_role: 'MGR',
        action_status: 'Deny',
        comments: 'Insufficient justification',
    });
    console.log(`   Deny response: ${JSON.stringify(denyRes.body)}`);

    const denyCheck = await makeRequest('GET', `/api/ecr/${denyId}`);
    const denyStatus = denyCheck.body.data.process_status;
    console.log(`   ${denyStatus === 'Denied' ? '✅' : '❌'} process_status="${denyStatus}" (expected "Denied")`);
}

runTest().catch(err => console.error('Test failed:', err));
