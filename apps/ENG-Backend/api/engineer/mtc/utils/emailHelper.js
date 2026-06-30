/**
 * MTC Email Helper
 * Wraps GAS email with Gmail API fallback — self-contained within MTC domain.
 * Does NOT modify api/system/emailService.js.
 */
const { google } = require('googleapis');
const axios = require('axios');

// GAS web-app endpoint (same one api/system/emailService.js uses). Kept here so
// the MTC sender (with from_name/reply_to) stays self-contained and does NOT
// modify the shared system emailService.
const GAS_EMAIL_URL = process.env.GAS_EMAIL_URL || 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbyYClLnCqAPKU6Vq42VcG5bNYGILRXfSxZy-gQEROfig9mt3AYacW4wrwDMQ4Dv8EZKLA/exec';

// Strip JS-style quoting if .env was formatted as: KEY = 'value';
function cleanEnv(key) {
    const val = process.env[key] || '';
    return val.replace(/^['"\s]+/, '').replace(/['"\s;]+$/, '');
}

/**
 * Send via the GAS web app, forwarding the real sender's name + reply address so
 * the updated GAS (docs/gas_email_doPost_dwg.gs) can set MailApp `name`/`replyTo`.
 * Mirrors emailService.sendEmailViaAS's request config (no proxy) but adds the
 * from_name/reply_to fields — without touching the shared system service.
 */
async function sendViaGAS(to, subject, htmlContent, opts = {}) {
    const response = await axios.post(GAS_EMAIL_URL, {
        user_to: to,
        subject: subject,
        body: htmlContent,
        from_name: opts.fromName || undefined,
        reply_to: opts.replyTo || undefined,
    }, {
        proxy: false,
        maxRedirects: 5,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });
    return response.data;
}

// RFC 2047 encode a header value that may contain non-ASCII (e.g. Thai names).
function encodeHeaderWord(value) {
    return `=?utf-8?B?${Buffer.from(String(value)).toString('base64')}?=`;
}

// The Gmail API sends as the authenticated account — the From address can't be an
// arbitrary user, but we CAN attach the real sender's name as the From display
// name. Resolve (and cache) the account address so we can build that header.
let _senderAddr = null;
async function getSenderAddress(gmail) {
    if (_senderAddr) return _senderAddr;
    try {
        const p = await gmail.users.getProfile({ userId: 'me' });
        _senderAddr = p.data.emailAddress || null;
    } catch (_) { _senderAddr = null; }
    return _senderAddr;
}

/**
 * Send via Gmail API (fallback path).
 * @param {{fromName?: string, replyTo?: string}} [opts] — fromName sets the From
 *   display name (address stays the system account); replyTo routes replies to
 *   the real sender so recipients no longer reply to the script/OAuth owner.
 */
async function sendViaGmailApi(to, subject, htmlContent, opts = {}) {
    const refreshToken = cleanEnv('GMAIL_REFRESH_TOKEN');
    if (!refreshToken) throw new Error('GMAIL_REFRESH_TOKEN not configured');

    const oAuth2Client = new google.auth.OAuth2(
        cleanEnv('GMAIL_CLIENT_ID'),
        cleanEnv('GMAIL_CLIENT_SECRET'),
        cleanEnv('GMAIL_REDIRECT_URI')
    );
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const utf8Subject = encodeHeaderWord(subject);

    const headers = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
    ];
    if (opts.fromName) {
        const senderAddr = await getSenderAddress(gmail);
        if (senderAddr) headers.push(`From: ${encodeHeaderWord(opts.fromName)} <${senderAddr}>`);
    }
    if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);

    const raw = Buffer.from([...headers, '', htmlContent].join('\n'))
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
 * @param {{fromName?: string, replyTo?: string}} [opts] — real-sender identity;
 *   threaded to both GAS (name/replyTo) and the Gmail API fallback.
 */
async function sendMtcEmail(to, subject, htmlContent, opts = {}) {
    try {
        const result = await sendViaGAS(to, subject, htmlContent, opts);
        console.log('✅ [MTC Email] Sent via GAS');
        return result;
    } catch (gasError) {
        console.warn('⚠️ [MTC Email] GAS failed, falling back to Gmail API:', gasError.message);
        return await sendViaGmailApi(to, subject, htmlContent, opts);
    }
}

module.exports = { sendMtcEmail, sendViaGmailApi };
