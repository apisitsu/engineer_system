const axios = require('axios');

async function testAPI() {
    try {
        console.log('Testing API endpoint...');
        
        // First, get a token (you may need to replace this with a valid token)
        const response = await axios.get('http://plbmp118:2005/api/tooling_inspect/dwg_require_getlist', {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBubyI6ImFkbWluIiwibmFtZSI6IkFkbWluIE11bmsiLCJkZXBhcnRtZW50IjoiQUQiLCJncm91cCI6IkFEIiwicm9sZSI6IkFEIiwiaWF0IjoxNzc1MTA5Nzc5LCJleHAiOjE3NzUxMTY5Nzl9.BqhUFBBOxZ7blWbpCkDF4ZXUcYr-hr-VdXSRhoj3WL4'
            }
        });
        
        console.log('✅ API Response successful!');
        console.log('Data:', response.data);
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
    }
}

testAPI();
