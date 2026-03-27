import React, { useState } from 'react';
import { Button, message, Tooltip } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../constance/constance';
import { useTheme } from '../../theme';

/**
 * SendEmailButton – Reusable component for sending emails via Google Apps Script.
 *
 * Props:
 * @param {string}   to          - Recipient email address
 * @param {string}   subject     - Email subject
 * @param {string}   htmlContent - Email body (HTML)
 * @param {string}   buttonText  - Custom button label (default: "Send Email")
 * @param {function} onSuccess   - Callback on successful send
 * @param {function} onError     - Callback on error
 * @param {object}   style       - Additional style overrides
 * @param {string}   size        - Ant Design button size ('small' | 'middle' | 'large')
 * @param {boolean}  disabled    - Disable the button
 */
const SendEmailButton = ({
    to,
    subject,
    htmlContent,
    buttonText = 'Send Email',
    onSuccess,
    onError,
    style = {},
    size = 'middle',
    disabled = false,
}) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleSendEmail = async () => {
        if (!to || !subject) {
            message.warning('Recipient (to) and subject are required.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                server.ECR_REQUIRE_SEND_EMAIL,
                { to, subject, htmlContent },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            message.success(res.data.message || 'Email sent successfully!');
            if (onSuccess) onSuccess(res.data);
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message;
            message.error(errMsg || 'Failed to send email.');
            if (onError) onError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip title={`Send to: ${to || '(not set)'}`}>
            <Button
                type="primary"
                icon={<MailOutlined />}
                loading={loading}
                onClick={handleSendEmail}
                size={size}
                disabled={disabled || !to || !subject}
                style={{
                    background: loading ? undefined : theme.colors.accent,
                    borderColor: loading ? undefined : theme.colors.accent,
                    ...style,
                }}
            >
                {buttonText}
            </Button>
        </Tooltip>
    );
};

export default SendEmailButton;
