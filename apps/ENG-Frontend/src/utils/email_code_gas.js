/**
 * Google Apps Script – Email Notification Endpoint (doGet)
 * 
 * UPDATED: Now supports multiple email templates via the `funct` parameter.
 * 
 * DEPLOYMENT SETTINGS:
 *   Execute as: Me (your_email@minebea.co.th)
 *   Who has access: Anyone
 * 
 * SUPPORTED FUNCTIONS:
 *   - sendNotificationEmail   → Original ECR/Drawing notification
 *   - sendErrorReport         → Kanban system error report
 *   - sendKanbanNotification  → Kanban activity notification (card assigned, etc.)
 * 
 * URL: https://script.google.com/a/macros/minebea.co.th/s/AKfycbxvX4smuNCm8k5x-fkAcurKRG2OfXB0wID0OKzATCreHHIn1BZu0kQDZzFvSfaYoHjCvw/exec
 */

// --- Router ---
function doGet(e) {
    try {
        var funct = e.parameter.funct;

        switch (funct) {
            case "sendNotificationEmail":
                sendNotificationEmail(e.parameter);
                break;
            case "sendErrorReport":
                sendErrorReport(e.parameter);
                break;
            case "sendKanbanNotification":
                sendKanbanNotification(e.parameter);
                break;
            default:
                break;
        }

        // Return HTML with postMessage for iframe/popup communication
        var htmlSuccess = "<script>" +
            "try {" +
            "    if (window.top.opener) {" +
            "        window.top.opener.postMessage({ type: 'GAS_MAIL_RESULT', status: 'success' }, '*');" +
            "        window.top.close();" +
            "    } else if (window.top !== window) {" +
            "        window.top.postMessage({ type: 'GAS_MAIL_RESULT', status: 'success' }, '*');" +
            "    } else {" +
            "        document.write('✅ Success! Notification sent.');" +
            "    }" +
            "} catch(e) { document.write('✅ Success!'); }" +
            "</script>";

        return HtmlService.createHtmlOutput(htmlSuccess)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    } catch (err) {
        var htmlError = "<script>" +
            "try {" +
            "    if (window.top.opener) {" +
            "        window.top.opener.postMessage({ type: 'GAS_MAIL_RESULT', status: 'error', message: " + JSON.stringify(err.toString()) + " }, '*');" +
            "        window.top.close();" +
            "    } else if (window.top !== window) {" +
            "        window.top.postMessage({ type: 'GAS_MAIL_RESULT', status: 'error', message: " + JSON.stringify(err.toString()) + " }, '*');" +
            "    } else {" +
            "        document.write('❌ Error: ' + " + JSON.stringify(err.toString()) + ");" +
            "    }" +
            "} catch(e) { document.write('❌ Error'); }" +
            "</script>";

        return HtmlService.createHtmlOutput(htmlError)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
}

// ============================================================
//  Template 1: Original Drawing/ECR Notification
// ============================================================
function sendNotificationEmail(params) {
    var recipients = "nanthiwa.k@minebea.co.th";
    var subject = "⚠️ POC: Drawing Accessed - C/N: " + (params.cn || "N/A");

    var body = "มีคนเปิด drawing จ้ะ\n\n"
        + "C/N: " + (params.cn || "N/A") + "\n"
        + "Process: " + (params.process || "N/A") + "\n"
        + "Rev: " + (params.rev || "N/A");

    try {
        MailApp.sendEmail(recipients, subject, body);
        console.log("Email sent successfully to: " + recipients);
    } catch (e) {
        console.error("Failed to send email: " + e.toString());
    }
}

// ============================================================
//  Template 2: Kanban Error Report
// ============================================================
function sendErrorReport(params) {
    var recipients = "nanthiwa.k@minebea.co.th";
    var subject = params.subject || "🚨 Kanban System Error";

    var body = "═══════════════════════════════════════\n"
        + "  🚨 KANBAN ERROR REPORT\n"
        + "═══════════════════════════════════════\n\n"
        + "🔹 Action:  " + (params.action || "N/A") + "\n"
        + "🔹 Status:  " + (params.status || "N/A") + "\n"
        + "🔹 Error:   " + (params.error_msg || "N/A") + "\n"
        + "🔹 User:    " + (params.user || "N/A") + "\n"
        + "🔹 Time:    " + new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) + "\n\n"
        + "─── Context ───────────────────────────\n"
        + (params.context || "{}") + "\n\n"
        + "─── Body ──────────────────────────────\n"
        + (params.body || "No additional details") + "\n";

    try {
        MailApp.sendEmail(recipients, subject, body);
        console.log("[ErrorReport] Sent to: " + recipients);
    } catch (e) {
        console.error("[ErrorReport] Failed: " + e.toString());
    }
}

// ============================================================
//  Template 3: Kanban Activity Notification
// ============================================================
function sendKanbanNotification(params) {
    var recipients = params.user_to || "nanthiwa.k@minebea.co.th";
    var type = params.notification_type || "general";

    var subjectMap = {
        "card_assigned": "📋 คุณถูกมอบหมายงาน: " + (params.card_name || ""),
        "comment_mentioned": "💬 คุณถูกแท็กในคอมเมนต์: " + (params.card_name || ""),
        "card_due_soon": "⏰ การ์ดใกล้ถึงกำหนด: " + (params.card_name || ""),
        "general": "📌 Kanban Notification: " + (params.card_name || ""),
    };

    var subject = subjectMap[type] || subjectMap["general"];

    var body = "═══════════════════════════════════════\n"
        + "  📌 KANBAN NOTIFICATION\n"
        + "═══════════════════════════════════════\n\n"
        + "🔹 ประเภท:    " + type + "\n"
        + "🔹 การ์ด:     " + (params.card_name || "N/A") + "\n"
        + "🔹 บอร์ด:     " + (params.board_name || "N/A") + "\n"
        + "🔹 โปรเจค:    " + (params.project_name || "N/A") + "\n"
        + "🔹 จาก:       " + (params.user_from || "N/A") + "\n"
        + "🔹 ข้อความ:   " + (params.message || "-") + "\n"
        + "🔹 เวลา:      " + new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) + "\n";

    try {
        MailApp.sendEmail(recipients, subject, body);
        console.log("[KanbanNotif] Sent to: " + recipients + " type: " + type);
    } catch (e) {
        console.error("[KanbanNotif] Failed: " + e.toString());
    }
}
