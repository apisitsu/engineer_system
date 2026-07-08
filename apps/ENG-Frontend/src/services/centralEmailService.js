import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GAS_WEBAPP_URL } from '../constance/constance';

// ============================================================================
// Core: Low-level GAS trigger (Silent iframe injection, no response tracking)
// ============================================================================
export const sendEmailSilent = (params = {}) => {
    if (!params.funct) params.funct = 'sendNotificationEmail';

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
        }
    });
    queryParams.append('t', Date.now());

    const url = `${GAS_WEBAPP_URL}?${queryParams.toString()}`;

    // Create hidden iframe, inject, and auto-cleanup
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'display:none;position:absolute;left:-9999px;width:0;height:0;';
    iframe.title = 'gas-email-silent';

    document.body.appendChild(iframe);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* already removed */ }
    }, 10000);
};

// ============================================================================
// Templates: Pre-built email payloads
// ============================================================================

export const sendErrorReport = (action, error, context = {}) => {
    const errMsg = error?.response?.data?.error || error?.message || String(error);
    const status = error?.response?.status || 'N/A';
    const user = context.user || context.uCode || 'Unknown';

    const subject = `🚨 Kanban Error: ${action} (${status})`;
    const body = [
        `Action: ${action}`,
        `Status: ${status}`,
        `Error: ${errMsg}`,
        `User: ${user}`,
        `Context: ${JSON.stringify(context)}`,
        `Time: ${new Date().toLocaleString('th-TH')}`,
        `URL: ${window.location.href}`,
    ].join('\n');

    sendEmailSilent({
        funct: 'sendErrorReport',
        subject,
        body,
        action,
        status: String(status),
        error_msg: errMsg,
        user,
        context: JSON.stringify(context),
    });
};

export const sendKanbanNotification = (type, details = {}) => {
    sendEmailSilent({
        funct: 'sendKanbanNotification',
        notification_type: type,
        card_name: details.cardName || '',
        board_name: details.boardName || '',
        project_name: details.projectName || '',
        user_from: details.userFrom || '',
        user_to: details.userTo || '',
        message: details.message || '',
    });
};

// ============================================================================
// React Hook: Interactive Email (Popup / Hidden Iframe with Auth)
// ============================================================================

export const useEmail = (onResult) => {
    const [isSending, setIsSending] = useState(false);
    const [iframeUrl, setIframeUrl] = useState(null);
    const popupRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const handleMessage = (event) => {
            if (!event.origin.includes("google.com") && !event.origin.includes("googleusercontent.com")) {
                return;
            }

            const data = event.data;
            if (data && data.type === 'GAS_MAIL_RESULT') {
                setIsSending(false);
                setIframeUrl(null);

                if (timeoutRef.current) clearTimeout(timeoutRef.current);

                if (data.status === 'success') {
                    localStorage.setItem('gas_email_authorized', 'true');
                }

                if (onResult) onResult(data);

                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onResult]);

    const triggerEmail = useCallback((params = {}) => {
        if (isSending) return;
        if (!params.funct) params.funct = 'sendNotificationEmail';

        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });
        queryParams.append('t', Date.now());

        const url = `${GAS_WEBAPP_URL}?${queryParams.toString()}`;
        setIsSending(true);

        const isAuthorized = localStorage.getItem('gas_email_authorized') === 'true';

        if (isAuthorized) {
            setIframeUrl(url);
            timeoutRef.current = setTimeout(() => {
                localStorage.removeItem('gas_email_authorized');
                setIsSending(false);
                setIframeUrl(null);
                if (onResult) {
                    onResult({ status: 'error', message: 'Session expired. Please click again to authorize.' });
                }
            }, 8000);
        } else {
            const width = 600;
            const height = 650;
            const left = (window.innerWidth / 2) - (width / 2) + window.screenX;
            const top = (window.innerHeight / 2) - (height / 2) + window.screenY;

            popupRef.current = window.open(
                url,
                "GAS_Email_Notifier",
                `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,scrollbars=yes`
            );

            const checkClosedInterval = setInterval(() => {
                if (popupRef.current && popupRef.current.closed) {
                    clearInterval(checkClosedInterval);
                    setIsSending((prevSending) => {
                        if (prevSending) {
                            if (onResult) {
                                onResult({ status: 'error', message: 'Authorization window was closed before completion.' });
                            }
                            return false;
                        }
                        return prevSending;
                    });
                }
            }, 1000);
        }
    }, [isSending, onResult]);

    const cleanup = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
        }
    }, []);

    const IframeRenderer = () => {
        if (!iframeUrl) return null;
        return (
            <iframe
                src={iframeUrl}
                title="gas-email-notifier-hidden"
                style={{ display: 'none', position: 'absolute', left: '-9999px' }}
            />
        );
    };

    return {
        triggerEmail,
        isSending,
        IframeRenderer,
        cleanup,
    };
};
