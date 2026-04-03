<<<<<<< HEAD
import React, { useEffect } from 'react';
import { Button, message, Tooltip } from 'antd';
import { App } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import useGASEmail from '../../hooks/useGASEmail';
import { useTheme } from '../../theme';

/**
 * SendEmailButton – Sends email notifications via a hidden iframe → GAS doGet.
 *
 * The browser handles corporate proxy auth transparently.
 * No CORS, no backend proxy, no OAuth needed.
 *
 * Props:
 * @param {string}   funct      - GAS function name (default: 'sendNotificationEmail')
 * @param {string}   cn         - Change Number (C/N)
 * @param {string}   process    - Process name
 * @param {string}   rev        - Revision
 * @param {string}   to         - Optional recipient override (if GAS supports it)
 * @param {string}   subject    - Optional subject override (if GAS supports it)
 * @param {string}   buttonText - Custom button label (default: "Send Notification")
 * @param {function} onSuccess  - Callback fired after iframe loads (email sent)
 * @param {object}   style      - Additional style overrides
 * @param {string}   size       - Ant Design button size ('small' | 'middle' | 'large')
 * @param {boolean}  disabled   - Disable the button
 */
// const SendEmailButton = ({
//     funct = 'sendNotificationEmail',
//     cn,
//     process: processName,
//     rev,
//     to,
//     subject,
//     buttonText = 'Send Notification',
//     onSuccess,
//     style = {},
//     size = 'middle',
//     disabled = false,
// }) => {
//     const { theme } = useTheme();
//     const { triggerEmail, isSending, IframeRenderer } = useGASEmail((result) => {
//         if (result.status === 'success') {
//             message.success({ content: 'Notification sent!', key: 'gas-email' });
//             if (onSuccess) onSuccess(result);
//         } else {
//             message.error({ content: `Failed: ${result.message}`, key: 'gas-email' });
//             if (onError) onError(result);
//         }
//     });

//     // Cleanup timeout on unmount
//     useEffect(() => {
//         return cleanup;
//     }, [cleanup]);

//     const handleClick = () => {
//         const params = { funct, cn, process: processName, rev, to, subject };

//         message.loading({ content: 'Sending notification...', key: 'gas-email', duration: 0 });
//         triggerEmail(params);
//     };
//     return (
//         <>
//             <Tooltip title={cn ? `Notify: C/N ${cn}` : 'Send notification email'}>
//                 <Button
//                     type="primary"
//                     icon={<MailOutlined />}
//                     loading={isSending}
//                     onClick={handleClick}
//                     size={size}
//                     disabled={disabled || isSending}
//                     style={{
//                         background: isSending ? undefined : theme.colors.accent,
//                         borderColor: isSending ? undefined : theme.colors.accent,
//                         ...style,
//                     }}
//                 >
//                     {buttonText}
//                 </Button>
//             </Tooltip>

//             {/* Hidden iframe – renders only while sending */}
//             <IframeRenderer />
//         </>
//     );
// };

const SendEmailButton = ({
    funct = 'sendNotificationEmail',
    cn,
    process: processName,
    rev,
    to,
    subject,
    buttonText = 'Send Notification',
    onSuccess,
    onError, // เพิ่ม: รับ onError เข้ามาจาก Props [cite: 11]
=======
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
>>>>>>> old-work-backup
    style = {},
    size = 'middle',
    disabled = false,
}) => {
<<<<<<< HEAD
    const { message } = App.useApp();
    const { theme } = useTheme(); // ใช้ useTheme ตามแผนงาน 

    // ดึงตัวแปรทั้งหมดออกจาก Hook รวมถึง cleanup ด้วย
    const { triggerEmail, isSending, IframeRenderer, cleanup } = useGASEmail((result) => {
        console.log('[SendEmailButton] Received result from useGASEmail:', result);
        if (result.status === 'success') {
            message.success({ content: 'Notification sent!', key: 'gas-email' });
            if (onSuccess) onSuccess(result);
        } else {
            message.error({ content: `Failed: ${result.message}`, key: 'gas-email' });
            if (onError) onError(result); // ตอนนี้ onError จะไม่ undefined แล้ว
        }
    });

    useEffect(() => {
        console.log('[SendEmailButton] Mounted/Rendered');
        return () => {
            console.log('[SendEmailButton] Component unmounting, calling cleanup');
            cleanup();
        }; // เรียกใช้ cleanup เมื่อ Component ถูกทำลาย 
    }, [cleanup]);

    const handleClick = () => {
        const params = { funct, cn, process: processName, rev, to, subject };
        console.log('[SendEmailButton] handleClick triggered with params:', params);
        message.loading({ content: 'Sending notification...', key: 'gas-email', duration: 0 });
        triggerEmail(params);
    };

    return (
        <>
            <Tooltip title={cn ? `Notify: C/N ${cn}` : 'Send notification email'}>
                <Button
                    type="primary"
                    loading={isSending}
                    onClick={handleClick}
                    icon={<MailOutlined />}
                    size={size}
                    disabled={disabled || isSending}
                    style={{
                        background: isSending ? undefined : theme.colors.accent,
                        borderColor: isSending ? undefined : theme.colors.accent,
                        ...style,
                    }}
                >
                    {buttonText}
                </Button>
            </Tooltip>
            <IframeRenderer />
        </>
=======
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
>>>>>>> old-work-backup
    );
};

export default SendEmailButton;
