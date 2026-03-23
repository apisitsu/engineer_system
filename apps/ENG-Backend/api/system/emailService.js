const { google } = require('googleapis');
// ดึงค่าจากไฟล์ config.js โดยตรง (ตรวจสอบ Path ให้ถูกต้องตามโครงสร้างไฟล์ของคุณ)
const config = require('./config'); 

const sendEmail = async (to, subject, htmlContent) => {
    const oAuth2Client = new google.auth.OAuth2(
        config.GMAIL_CLIENT_ID,
        config.GMAIL_CLIENT_SECRET,
        config.GMAIL_REDIRECT_URI
    );

    oAuth2Client.setCredentials({ 
        refresh_token: config.GMAIL_REFRESH_TOKEN 
    });

    try {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        
        const str = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${subject}`,
            '',
            htmlContent
        ].join('\n');

        const encodedMail = Buffer.from(str)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

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

module.exports = { sendEmail };