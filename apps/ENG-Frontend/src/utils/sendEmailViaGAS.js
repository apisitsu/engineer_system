/**
 * sendEmailViaGAS.js
 * 
 * Standalone utility for sending emails via Google Apps Script (GAS).
 * Works WITHOUT React hooks — can be called from Zustand store, event handlers, etc.
 * 
 * Uses hidden iframe injection (same approach as useGASEmail hook)
 * but wrapped as a simple callable function.
 * 
 * Usage:
 *   import { sendErrorReport, sendKanbanNotification, sendEmailViaGAS } from './sendEmailViaGAS';
 *   
 *   // Quick error report
 *   sendErrorReport('deleteAttachment', err, { cardId: 25, user: 'LE031' });
 *   
 *   // Custom email
 *   sendEmailViaGAS({ funct: 'sendNotificationEmail', cn: 'ECR-001', process: 'Stamping', rev: 'A' });
 */

import { GAS_WEBAPP_URL } from '../constance/constance';

// ─── Core: Fire-and-forget iframe email sender ───────────────────
const sendEmailViaGAS = (params = {}) => {
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

// ─── Template: Error Report ──────────────────────────────────────
/**
 * Send an error report email to the admin.
 * @param {string} action   - What the user was trying to do (e.g., 'deleteAttachment')
 * @param {Error|object} error - The error object
 * @param {object} context  - Additional context (cardId, boardId, user, etc.)
 */
const sendErrorReport = (action, error, context = {}) => {
    const errMsg = error?.response?.data?.error || error?.message || String(error);
    const status = error?.response?.status || 'N/A';
    const user = context.user || context.uCode || 'Unknown';

    // Build a detailed body for the GAS function
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

    sendEmailViaGAS({
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

// ─── Template: Kanban Notification ───────────────────────────────
/**
 * Send a Kanban activity notification.
 * @param {string} type     - Notification type (e.g., 'card_assigned', 'comment_mentioned')
 * @param {object} details  - { cardName, boardName, projectName, userFrom, userTo, message }
 */
const sendKanbanNotification = (type, details = {}) => {
    sendEmailViaGAS({
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

export { sendEmailViaGAS, sendErrorReport, sendKanbanNotification };
export default sendEmailViaGAS;
