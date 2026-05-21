/**
 * MTC Email Helper
 * Wraps GAS email with Gmail API fallback — self-contained within MTC domain.
 * Does NOT modify api/system/emailService.js.
 */
const { google } = require('googleapis');
const { sendEmailViaAS } = require('../../../system/emailService');

// Strip JS-style quoting if .env was formatted as: KEY = 'value';
function cleanEnv(key) {
    const val = process.env[key] || '';
    return val.replace(/^['"\s]+/, '').replace(/['"\s;]+$/, '');
}

async function sendViaGmailApi(to, subject, htmlContent) {
    const refreshToken = cleanEnv('GMAIL_REFRESH_TOKEN');
    if (!refreshToken) throw new Error('GMAIL_REFRESH_TOKEN not configured');

    const oAuth2Client = new google.auth.OAuth2(
        cleanEnv('GMAIL_CLIENT_ID'),
        cleanEnv('GMAIL_CLIENT_SECRET'),
        cleanEnv('GMAIL_REDIRECT_URI')
    );
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const raw = Buffer.from([
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        htmlContent,
    ].join('\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    console.log('✅ [MTC Email] Sent via Gmail API');
    return 'Sent via Gmail API';
}

/**
 * Send email: GAS first, Gmail API as fallback.
 */
async function sendMtcEmail(to, subject, htmlContent) {
    try {
        const result = await sendEmailViaAS(to, subject, htmlContent);
        console.log('✅ [MTC Email] Sent via GAS');
        return result;
    } catch (gasError) {
        console.warn('⚠️ [MTC Email] GAS failed, falling back to Gmail API:', gasError.message);
        return await sendViaGmailApi(to, subject, htmlContent);
    }
}

module.exports = { sendMtcEmail, sendViaGmailApi };
