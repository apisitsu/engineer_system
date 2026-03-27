const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBubyI6ImFkbWluIiwibmFtZSI6IkFkbWluIiwicm9sZSI6IkFEIiwiaWF0IjoxNzczMTg5MjY4LCJleHAiOjE3NzMxOTEwNjh9.JN_0pAgAcoMYRJo2hzflkeJUN-olT13skj-u8fRO1uI';

const request = async (url, method = 'GET', body = null) => {
    const res = await fetch(`http://localhost:2005${url}`, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
};

const runTests = async () => {
    try {
        console.log("1. Fetching schema...");
        const res1 = await request('/api/system/user-management/schema');
        console.log(`Schema cols: ${res1.data.length}`);

        console.log("\n2. Adding column 'test_api_col'...");
        await request('/api/system/user-management/schema/add-column', 'POST', {
            columnName: 'test_api_col',
            dataType: 'VARCHAR(255)',
            defaultValue: 'N/A'
        });
        console.log("Column added successfully!");

        console.log("\n3. Fetching schema again...");
        const res3 = await request('/api/system/user-management/schema');
        const hasCol = res3.data.some(c => c.column_name === 'test_api_col');
        console.log(`Schema has 'test_api_col': ${hasCol}`);

        console.log("\n4. Fetching users...");
        const res4 = await request('/api/system/user-management/users?search=&page=1&pageSize=5');
        console.log(`Users fetched: ${res4.data.length}, Total: ${res4.total}`);

        console.log("\n5. Dropping column 'test_api_col'...");
        await request('/api/system/user-management/schema/drop-column', 'POST', {
            columnName: 'test_api_col'
        });
        console.log("Column dropped successfully!");

        console.log("\nAll tests passed successfully.");
    } catch (err) {
        console.error("Test failed:", err.message);
    }
};

runTests();
