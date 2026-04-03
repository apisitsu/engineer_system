const { sendEmailViaAS } = require('./emailService');
const { engPool } = require('../../instance/eng_db');

<<<<<<< HEAD
const handleSendEmail = async (req, res) => {
=======
/**
 * POST /api/send-email
 * Sends an email via Google Apps Script on behalf of the authenticated user.
 * Requires JWT authentication (req.user.empno must be populated).
 * Body: { to, subject, htmlContent }
 */
exports.handleSendEmail = async (req, res) => {
>>>>>>> old-work-backup
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

<<<<<<< HEAD
const getGmailStatus = async (req, res) => {
=======
/**
 * GET /api/gmail-status
 * Returns the email service status for the authenticated user.
 * With GAS approach, the service is always "connected" as long as the user is authenticated.
 */
exports.getGmailStatus = async (req, res) => {
>>>>>>> old-work-backup
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
<<<<<<< HEAD
};

module.exports = {
    handleSendEmail,
    getGmailStatus
=======
>>>>>>> old-work-backup
};