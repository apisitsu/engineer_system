require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const URL = require('url');

const GAS_URL = process.env.GAS_EMAIL_URL;

async function testNativeProxy() {
    console.log('🔄 Testing Pure Node.js HTTPS Proxy connection with Manual Auth Header...');
    console.log(`📍 GAS URL: ${GAS_URL}`);

    const payload = JSON.stringify({
        to: 'nanthiwa.k@minebea.co.th',
        subject: '✅ Test via Native HTTPS Request',
        htmlContent: '<p>Testing pure Node.js proxy connection.</p>'
    });

    let agent;
    const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    };

    if (process.env.PROXY_HOST) {
        // Corporate proxy url WITHOUT credentials (we'll send them in standard header)
        const proxyUrl = `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT || 8080}`;
        console.log('🔌 Proxy:', `${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);

        // Manually inject Proxy-Authorization for Basic Auth into the CONNECT request
        const authString = Buffer.from(`${process.env.PROXY_USER}:${process.env.PROXY_PASS}`).toString('base64');
        const proxyAuthHeader = `Basic ${authString}`;

        agent = new HttpsProxyAgent(proxyUrl, {
            headers: {
                'Proxy-Authorization': proxyAuthHeader
            }
        });
    }

    const { hostname, pathname, search } = new URL.URL(GAS_URL);

    const options = {
        hostname: hostname,
        port: 443,
        path: pathname + search,
        method: 'POST',
        headers: headers,
        agent: agent
    };

    const req = https.request(options, (res) => {
        console.log(`\nStatus Code: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('\n✅ Response Body:');
            console.log(data);
        });
    });

    req.on('error', (e) => {
        console.error(`\n❌ Problem with request: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

testNativeProxy();
