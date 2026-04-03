const { google } = require('googleapis');
const axios = require('axios');
const tunnel = require('tunnel');
const config = require('./config');

require('dotenv').config();

<<<<<<< HEAD
// --- GAS URL from environment ---
const GAS_EMAIL_URL = process.env.GAS_EMAIL_URL || 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbwK3lA8rAOZvlGuvBRkIfNj7zrqBriIiREnhKnWaHyLXFV8lrfZwPNA_aaMP2hF_qZdBA/exec';
=======
// --- GAS URL + Secret Key from environment ---
const GAS_EMAIL_URL     = process.env.GAS_EMAIL_URL;
const GAS_EMAIL_URL_NEW = process.env.GAS_EMAIL_URL_NEW;
const GAS_SECRET        = process.env.GAS_SECRET_KEY || 'ENG_DWG_2026';
>>>>>>> old-work-backup

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
<<<<<<< HEAD
const sendEmailViaAS = async (to, subject, htmlContent) => {
    try {
        const agent = getProxyAgent();

        const response = await axios.post(GAS_EMAIL_URL, {
=======
const sendEmailViaAS = async (to, subject, htmlContent, url = GAS_EMAIL_URL) => {
    try {
        const agent = getProxyAgent();

        const response = await axios.post(url, {
            secret: GAS_SECRET,
>>>>>>> old-work-backup
            to,
            subject,
            htmlContent
        }, {
            httpAgent: agent,
            httpsAgent: agent,
            proxy: false, // Disable axios built-in proxy (we use agent instead)
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
        config.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT_SECRET,
        config.GMAIL_REDIRECT_URI
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

<<<<<<< HEAD
const mailPermitRecord = async (u_code,) => {

}

module.exports = { sendEmail, sendEmailViaAS };
=======
/**
 * Send email with automatic fallback:
 *   1st: Google Apps Script (GAS) relay
 *   2nd: Gmail API using GMAIL_REFRESH_TOKEN from .env
 */
const sendEmailWithFallback = async (to, subject, htmlContent) => {
    // ลอง GAS URL ใหม่ก่อน (ถ้ามี)
    if (GAS_EMAIL_URL_NEW) {
        try {
            return await sendEmailViaAS(to, subject, htmlContent, GAS_EMAIL_URL_NEW);
        } catch (err) {
            console.warn('⚠️  GAS (new URL) failed:', err.response?.status || err.message);
        }
    }
    // Fallback → GAS URL เก่า
    try {
        return await sendEmailViaAS(to, subject, htmlContent, GAS_EMAIL_URL);
    } catch (gasErr) {
        console.warn('⚠️  GAS (old URL) failed, falling back to Gmail API:', gasErr.response?.status || gasErr.message);
        const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
        if (!refreshToken) throw new Error('No GMAIL_REFRESH_TOKEN in env; cannot fall back.');
        return await sendEmail(refreshToken, to, subject, htmlContent);
    }
};

module.exports = { sendEmail, sendEmailViaAS, sendEmailWithFallback };
>>>>>>> old-work-backup
