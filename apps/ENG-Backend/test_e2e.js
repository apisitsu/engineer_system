const axios = require('axios');
axios.defaults.proxy = false;

const API_BASE = 'http://localhost:2005/api/ecr';
const USER_NAME = 'Admin ECR';
const USER_ROLE = 'AD';

async function runE2ETest() {
    console.log("=== Starting ECR E2E API Test ===");
    try {
        // 1. Create ECR
        console.log("\n[1] Creating ECR...");
        const createPayload = {
            request_by: USER_NAME,
            department: "Engineering",
            require_date: "2026-04-10",
            due_date: "2026-04-20",
            objective: "Reduce cycle",
            is_drawing: true,
            is_tooling: false,
            is_program: false,
            is_usage: false,
            part_no_drawing: "P-1234",
            cn_drawing: "CN-001",
            rev_drawing: "A",
            drawing_before_change: "10mm",
            drawing_after_change: "20mm"
        };
        const createRes = await axios.post(`${API_BASE}/create`, createPayload);
        console.log("Create Response:", createRes.data.message);
        const recordId = createRes.data.id;
        console.log("Generated Document ID:", recordId);

        // 2. Fetch List to verify it exists
        console.log(`\n[2] Fetching ECR List to verify ${recordId}...`);
        const listRes = await axios.get(`${API_BASE}/getlist`);
        const found = listRes.data.data.some(doc => doc.id === recordId);
        console.log("Found in list?", found);

        // 3. Step 3.1: Dept Mgr Approval
        console.log(`\n[3] Submitting Step 3.1 for ${recordId}...`);
        await axios.put(`${API_BASE}/${recordId}/status`, {
            step_number: "3.1",
            action_by: USER_NAME,
            action_role: USER_ROLE,
            action_status: "Approve",
            comments: "Looks good to proceed.",
            details: {}
        });
        console.log("Step 3.1 Success");

        // 4. Step 3.2: Impact Assessment
        console.log(`\n[4] Submitting Step 3.2 for ${recordId}...`);
        await axios.put(`${API_BASE}/${recordId}/status`, {
            step_number: "3.2",
            action_by: USER_NAME,
            action_role: USER_ROLE,
            action_status: "Approve",
            comments: "Impact Assessed",
            details: { impact_Traceability: true, traceability_lot_no: "LOT-999" }
        });
        console.log("Step 3.2 Success");

        // 5. Fetch Details to verify logs are appending
        console.log(`\n[5] Fetching Details for ${recordId}...`);
        const detailRes = await axios.get(`${API_BASE}/${recordId}`);
        console.log(`Status: ${detailRes.data.data.process_status}`);
        console.log(`Log Count: ${detailRes.data.logs.length}`);

        // 6. Final Close ECN
        console.log(`\n[6] Submitting Step 4.0 (Close ECN) for ${recordId}...`);
        await axios.put(`${API_BASE}/${recordId}/status`, {
            step_number: "4.0",
            action_by: USER_NAME,
            action_role: USER_ROLE,
            action_status: "Close",
            comments: "Closed officially",
            details: { confirm_dwg: true }
        });
        console.log("Step 4.0 Success");

        // 7. Final Verification
        const finalDetail = await axios.get(`${API_BASE}/${recordId}`);
        console.log(`\n[7] Final Verify... Status is now: ${finalDetail.data.data.process_status}`);
        console.log(`Total Logs recorded: ${finalDetail.data.logs.length}`);

        console.log("\n=== E2E Test Completed Successfully! ===");

    } catch (err) {
        console.error("E2E Test Failed:", err.response ? err.response.data : err.message);
    }
}

runE2ETest();
