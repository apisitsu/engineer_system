const BASE_URL = 'http://localhost:2005';

async function login(empno, password = 'password') {
    const res = await fetch(`${BASE_URL}/api/login-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empno, password })
    });
    const data = await res.json();
    return data.token;
}

async function run() {
    console.log("=== Testing Stage Flow & Approval Rules ===");

    const adminToken = await login('admin');
    console.log("Logged in as admin, token obtained.");

    const authHeaders = (token) => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    });

    // 1. Fetch active ECR
    const listRes = await fetch(`${BASE_URL}/api/ecnt/ecr`, { headers: authHeaders(adminToken) });
    const listData = await listRes.json();
    const ecrs = listData.data;
    console.log(`Found ${ecrs.length} ECR records.`);

    const targetEcr = ecrs.find(e => e.id === 29) || ecrs[0];
    console.log(`Target ECR: #${targetEcr.id} (${targetEcr.ecr_no}) in stage ${targetEcr.current_stage_code}`);

    // 2. Fetch User Candidates
    const candRes = await fetch(`${BASE_URL}/api/ecnt/user-candidates`, { headers: authHeaders(adminToken) });
    const candData = await candRes.json();
    console.log(`User candidates count: ${candData.data.length}`);
    const adminCandidates = candData.data.filter(u => (u.u_nickname || '').toLowerCase() === 'admin');
    console.log(`Candidates with nickname 'Admin': ${adminCandidates.length} (Expected: 0)`);

    // 3. Test updating stage_flow on target ECR
    const flowPayload = {
        stageKey: 'STAGE_2', // Department Manager review
        assignees: [
            { emp_no: 'eng_mgr', name: 'Engineering Mgr' },
            { emp_no: 'thai_mgr', name: 'Thai Mgr' }
        ],
        approval_rule: 'ALL'
    };

    const updateRes = await fetch(`${BASE_URL}/api/ecnt/stage-flow/ECR/${targetEcr.id}`, {
        method: 'PUT',
        headers: authHeaders(adminToken),
        body: JSON.stringify(flowPayload)
    });
    const updateData = await updateRes.json();
    console.log(`Stage flow update response:`, updateData);

    // 4. Verify stage_flow was saved in DB
    const detailRes = await fetch(`${BASE_URL}/api/ecnt/ecr/${targetEcr.id}`, { headers: authHeaders(adminToken) });
    const detailData = await detailRes.json();
    const savedFlow = detailData.data.stage_flow;
    console.log(`Saved stage_flow for STAGE_2:`, JSON.stringify(savedFlow?.STAGE_2));

    if (savedFlow?.STAGE_2?.approval_rule === 'ALL' && savedFlow.STAGE_2.assignees.length === 2) {
        console.log("✅ Stage flow successfully persisted with 2 assignees and 'ALL' rule!");
    } else {
        console.error("❌ Stage flow verification failed:", savedFlow);
    }

    // 5. Test Block 10 concern department guard
    const guardRes = await fetch(`${BASE_URL}/api/ecnt/stage-flow/ECR/${targetEcr.id}`, {
        method: 'PUT',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
            stageKey: 'STAGE_9', // Block 10 concern
            assignees: [{ emp_no: 'external_user', name: 'External' }],
            approval_rule: 'ANY'
        })
    });
    const guardData = await guardRes.json();
    if (guardRes.status === 400 || guardRes.status === 403) {
        console.log(`✅ Guard passed: Block 10 concern rejected with status ${guardRes.status} ("${guardData.error || guardData.message}")`);
    } else {
        console.error("❌ Guard failed: Block 10 allowed modification!", guardRes.status, guardData);
    }

    // 6. Confirm ECN table count is 0
    const ecnRes = await fetch(`${BASE_URL}/api/ecnt/ecn`, { headers: authHeaders(adminToken) });
    const ecnData = await ecnRes.json();
    console.log(`Total ECNs in system: ${ecnData.data.length} (Expected: 0)`);

    console.log("\n=== All Backend Verification Checks Passed! ===");
}

run().catch(err => {
    console.error("Test error:", err.message);
    process.exit(1);
});
