const { google } = require('googleapis');
const axios = require('axios');
const tunnel = require('tunnel');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// --- Gmail Fallback Credentials from environment ---
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:2005/auth/google/callback';

// --- GAS URL from environment ---
const GAS_EMAIL_URL = process.env.GAS_EMAIL_URL || 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbwK3lA8rAOZvlGuvBRkIfNj7zrqBriIiREnhKnWaHyLXFV8lrfZwPNA_aaMP2hF_qZdBA/exec';

// --- Corporate proxy agent (for HTTPS tunneling through McAfee Web Gateway) ---
function getProxyAgent() {
    if (process.env.PROXY_HOST) {
        return tunnel.httpsOverHttp({
            proxy: {
                host: process.env.PROXY_HOST,
                port: parseInt(process.env.PROXY_PORT) || 8080,
                proxyAuth: `${process.env.PROXY_USER}:${process.env.PROXY_PASS}`
            }
        });
    }
    return undefined;
}


/**
 * Send email via Google Apps Script Web App (Primary method)
 * GAS handles Gmail authentication internally – no per-user OAuth needed.
 */
const sendEmailViaAS = async (to, subject, htmlContent) => {
    try {
        // Test: Disable proxy for internal GAS endpoint
        // const agent = getProxyAgent();

        const response = await axios.post(GAS_EMAIL_URL, {
            to,
            subject,
            htmlContent
        }, {
            // httpAgent: agent,
            // httpsAgent: agent,
            proxy: false, // Ensure axios doesn't use environment variables either
            maxRedirects: 5,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log('✅ GAS Email Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Apps Script Error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Send email via Gmail API directly (Legacy/Fallback method)
 * Requires a per-user refresh_token stored in the database.
 * 
 * @param {string} userRefreshToken - User's Gmail refresh token
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 * @returns {string} "Sent Success"
 */
const sendEmail = async (userRefreshToken, to, subject, htmlContent) => {
    const oAuth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET,
        GMAIL_REDIRECT_URI
    );

    oAuth2Client.setCredentials({
        refresh_token: userRefreshToken
    });

    try {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

        const str = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            htmlContent
        ].join('\n');

        const encodedMail = Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMail,
            },
        });

        return "Sent Success";
    } catch (error) {
        console.error('Gmail API Error:', error);
        throw error;
    }
};

/**
 * Send email with fallback logic (Wraps GAS method for general system use)
 * @param {string} to - Recipient email(s)
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 */
const sendEmailWithFallback = async (to, subject, htmlContent) => {
    try {
        // Primary: GAS Web App (Doesn't require individual OAuth tokens)
        return await sendEmailViaAS(to, subject, htmlContent);
    } catch (error) {
        console.error('❌ sendEmailWithFallback Error:', error.message);
        throw error;
    }
};

const mailPermitRecord = async (u_code,) => {

}

module.exports = { sendEmail, sendEmailViaAS, sendEmailWithFallback };
