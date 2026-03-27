const { sendEmailViaAS } = require('./emailService');
const { engPool } = require('../../instance/eng_db');

const handleSendEmail = async (req, res) => {
    const { to, subject, htmlContent } = req.body;

    if (!to || !subject) {
        return res.status(400).json({ message: 'Missing required fields: to, subject' });
    }

    try {
        // Get the authenticated user's empno from JWT
        const userId = req.user?.empno;
        if (!userId) {
            return res.status(401).json({ message: 'UNAUTHORIZED' });
        }

        console.log(`📧 User ${userId} sending email to: ${to}`);

        // Send email via Google Apps Script
        const result = await sendEmailViaAS(to, subject, htmlContent || '');

        // Optionally log success in database
        try {
            await engPool.query(
                `UPDATE m_user_profile SET gmail_email = COALESCE(gmail_email, $1), updated_at = NOW() WHERE u_code = $2`,
                [to, userId]
            );
        } catch (dbErr) {
            console.warn('⚠️ Could not update email log in DB:', dbErr.message);
        }

        res.status(200).json({
            message: 'Email sent successfully!',
            data: result
        });

    } catch (error) {
        console.error('❌ Send email error:', error.response?.data || error.message);
        res.status(500).json({
            message: 'Failed to send email',
            error: error.response?.data || error.message
        });
    }
};

const getGmailStatus = async (req, res) => {
    try {
        const userId = req.user?.empno;
        if (!userId) {
            return res.status(401).json({ message: 'UNAUTHORIZED' });
        }

        // With GAS, the service is always available for authenticated users
        const { rows } = await engPool.query(
            'SELECT gmail_email FROM m_user_profile WHERE u_code = $1',
            [userId]
        );

        const user = rows[0];

        res.json({
            connected: true, // GAS is always connected
            method: 'apps_script',
            gmail_email: user?.gmail_email || null
        });

    } catch (error) {
        console.error('❌ Gmail status error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    handleSendEmail,
    getGmailStatus
};