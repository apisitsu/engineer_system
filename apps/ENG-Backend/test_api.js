const axios = require('axios');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBubyI6ImFkbWluIiwibmFtZSI6IkFkbWluIiwicm9sZSI6IkFEIiwiaWF0IjoxNzczMTg5MjY4LCJleHAiOjE3NzMxOTEwNjh9.JN_0pAgAcoMYRJo2hzflkeJUN-olT13skj-u8fRO1uI';

// Disable proxy for localhost
axios.defaults.proxy = false;

const runTests = async () => {
    try {
        const headers = { Authorization: `Bearer ${token}` };

        console.log("1. Fetching schema...");
        const res1 = await axios.get('http://127.0.0.1:2005/api/system/user-management/schema', { headers });
        console.log(`Schema cols: ${res1.data.data.length}`);

        console.log("\n2. Adding column 'test_api_col'...");
        await axios.post('http://127.0.0.1:2005/api/system/user-management/schema/add-column', {
            columnName: 'test_api_col',
            dataType: 'VARCHAR(255)',
            defaultValue: 'N/A'
        }, { headers });
        console.log("Column added successfully!");

        console.log("\n3. Fetching schema again...");
        const res3 = await axios.get('http://127.0.0.1:2005/api/system/user-management/schema', { headers });
        const hasCol = res3.data.data.some(c => c.column_name === 'test_api_col');
        console.log(`Schema has 'test_api_col': ${hasCol}`);

        console.log("\n4. Fetching users...");
        const res4 = await axios.get('http://127.0.0.1:2005/api/system/user-management/users?search=&page=1&pageSize=5', { headers });
        console.log(`Users fetched: ${res4.data.data.length}, Total: ${res4.data.total}`);

        console.log("\n5. Dropping column 'test_api_col'...");
        await axios.post('http://127.0.0.1:2005/api/system/user-management/schema/drop-column', {
            columnName: 'test_api_col'
        }, { headers });
        console.log("Column dropped successfully!");

        console.log("\nAll tests passed successfully.");
    } catch (err) {
        console.error("Test failed:", err.message);
        if (err.response) {
            console.error("Data:", err.response.data);
        }
    }
};

runTests();
