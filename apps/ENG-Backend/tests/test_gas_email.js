/**
 * Test Script: Verify Backend → Google Apps Script email connection
 * 
 * Usage:
 *   node tests/test_gas_email.js
 * 
 * This sends a test email directly via the GAS endpoint
 * to verify the connection works independently of the frontend.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const tunnel = require('tunnel');

const GAS_URL = process.env.GAS_EMAIL_URL;

async function testGASEmail() {
    console.log('🔄 Testing GAS Email connection...');
    console.log(`📍 GAS URL: ${GAS_URL}`);
    console.log('');

    const payload = {
        to: 'nanthiwa.k@minebea.co.th',  // ← Change to your test email
        subject: '✅ Test Email from Node.js via GAS',
        htmlContent: `
            <h2>Hello from Engineering System!</h2>
            <p>This is a test email sent via Google Apps Script middleware.</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
            <hr>
            <p style="color: #888; font-size: 12px;">This email was sent by the automated test script (test_gas_email.js)</p>
        `
    };

    try {
        console.log('📧 Sending test email to:', payload.to);

        // Corporate proxy agent for HTTPS tunneling
        let agent = undefined;
        if (process.env.PROXY_HOST) {
            agent = tunnel.httpsOverHttp({
                proxy: {
                    host: process.env.PROXY_HOST,
                    port: parseInt(process.env.PROXY_PORT) || 8080,
                    proxyAuth: `${process.env.PROXY_USER}:${process.env.PROXY_PASS}`
                }
            });
            console.log('🔌 Proxy configured via tunnel:', `${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
        } else {
            console.log('🔌 Proxy: None');
        }

        const response = await axios.post(GAS_URL, payload, {
            httpAgent: agent,
            httpsAgent: agent,
            proxy: false,
            maxRedirects: 5,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log('');
        console.log('✅ SUCCESS! Response:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
        console.log('📬 Check your inbox at:', payload.to);
    } catch (error) {
        console.log('');
        console.error('❌ FAILED!');
        console.error('Status:', error.response?.status);
        console.error('Data:', error.response?.data || error.message);
    }
}

testGASEmail();
