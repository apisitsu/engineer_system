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
    style = {},
    size = 'middle',
    disabled = false,
}) => {
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
    );
};

export default SendEmailButton;
