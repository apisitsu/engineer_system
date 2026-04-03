const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBubyI6ImFkbWluIiwibmFtZSI6IkFkbWluIiwicm9sZSI6IkFEIiwiaWF0IjoxNzczMTg5MjY4LCJleHAiOjE3NzMxOTEwNjh9.JN_0pAgAcoMYRJo2hzflkeJUN-olT13skj-u8fRO1uI';

const request = (path, method = 'GET', body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 2005,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        let postData;
        if (body) {
            postData = JSON.stringify(body);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error("Parse error: " + data));
                    }
                } else {
                    reject(new Error(`Failed with ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (postData) req.write(postData);
        req.end();
    });
};

const runTests = async () => {
    try {
        console.log("1. Fetching schema...");
        const res1 = await request('/api/system/user-management/schema');
        console.log(`Schema cols: ${res1.data?.length}`);

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
        console.log(`Users fetched: ${res4.data?.length}, Total: ${res4.total}`);

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
