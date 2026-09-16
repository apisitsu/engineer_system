/**
 * ==============================================================================
 * 🚀 Google Apps Script – Enterprise Reusable Email Notification Engine
 * ==============================================================================
 * 
 * DESCRIPTION:
 *   High-performance Google Apps Script Web App for sending enterprise HTML emails
 *   from client-side web apps (React / Vue / HTML) where corporate firewall prevents
 *   on-premise backend servers from sending external outbound emails directly.
 * 
 * SUPPORTS:
 *   1. ECNT V2 (11-Block Engineering Change Management System)
 *   2. Generic Modular Template System (Kanban, SDS, Tooling, Materials, etc.)
 * 
 * DEPLOYMENT INSTRUCTIONS:
 *   1. Create a new Google Apps Script project at https://script.google.com/
 *   2. Replace the contents of Code.gs with this entire file.
 *   3. Click [ Deploy ] > [ New deployment ]
 *   4. Select type: [ Web app ]
 *      - Description: "Enterprise Email Engine V2"
 *      - Execute as: "Me (your_email@minebea.co.th)"
 *      - Who has access: "Anyone"
 *   5. Click [ Deploy ], authorize the required Gmail permissions.
 *   6. Copy the generated Web App URL and paste it into the ECNT V2 System Settings
 *      panel (or set as GAS_WEBAPP_URL).
 * ==============================================================================
 */

// Global Config
var SYSTEM_NAME = "MinebeaMitsumi Engineering System";
var BRAND_PRIMARY_COLOR = "#1890ff";
var BRAND_DARK_COLOR = "#001529";

/**
 * HTTP GET handler (supports hidden iframe / image ping / query string triggers)
 */
function doGet(e) {
    try {
        var params = e && e.parameter ? e.parameter : {};
        var result = dispatchEmailAction(params);

        var htmlOutput = "<script>" +
            "try {" +
            "  if (window.top.opener) {" +
            "    window.top.opener.postMessage({ type: 'GAS_MAIL_RESULT', status: 'success' }, '*');" +
            "    window.top.close();" +
            "  } else if (window.top !== window) {" +
            "    window.top.postMessage({ type: 'GAS_MAIL_RESULT', status: 'success' }, '*');" +
            "  } else {" +
            "    document.write('✅ Email dispatched successfully.');" +
            "  }" +
            "} catch(err) { document.write('✅ Dispatched'); }" +
            "</script>";

        return HtmlService.createHtmlOutput(htmlOutput)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    } catch (err) {
        var htmlErr = "<script>" +
            "try {" +
            "  if (window.top.opener) {" +
            "    window.top.opener.postMessage({ type: 'GAS_MAIL_RESULT', status: 'error', message: " + JSON.stringify(err.toString()) + " }, '*');" +
            "    window.top.close();" +
            "  } else if (window.top !== window) {" +
            "    window.top.postMessage({ type: 'GAS_MAIL_RESULT', status: 'error', message: " + JSON.stringify(err.toString()) + " }, '*');" +
            "  } else {" +
            "    document.write('❌ Error: ' + " + JSON.stringify(err.toString()) + ");" +
            "  }" +
            "} catch(e) { document.write('❌ Error'); }" +
            "</script>";

        return HtmlService.createHtmlOutput(htmlErr)
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
}

/**
 * HTTP POST handler (supports fetch() with JSON body)
 */
function doPost(e) {
    var response = { success: false, message: "" };
    try {
        var data = {};
        if (e && e.postData && e.postData.contents) {
            data = JSON.parse(e.postData.contents);
        } else if (e && e.parameter) {
            data = e.parameter;
        }

        var result = dispatchEmailAction(data);
        response.success = true;
        response.message = result;
    } catch (err) {
        response.success = false;
        response.error = err.toString();
    }

    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Route email dispatch by function name
 */
function dispatchEmailAction(data) {
    var funct = data.funct || "sendEcntEmail";

    switch (funct) {
        case "sendEcntEmail":
            return sendEcntEmail(data);
        case "sendTemplateEmail":
            return sendGenericTemplateEmail(data);
        case "sendErrorReport":
            return sendErrorReport(data);
        default:
            return sendGenericTemplateEmail(data);
    }
}

// ============================================================================
// 1. ECNT V2 Workflow Email Dispatcher
// ============================================================================
function sendEcntEmail(params) {
    var recipients = params.recipients || params.user_to || params.to;
    if (!recipients) {
        throw new Error("Missing email recipients (recipients parameter is required)");
    }

    var docType = params.doc_type || "ECR";
    var docNo = params.doc_no || (docType + " #" + (params.doc_id || "N/A"));
    var titleOfChange = params.title || params.title_of_change || "Engineering Change Document";
    var customer = params.customer || "N/A";
    var department = params.department || "ENG";
    var requester = params.requester || params.request_by_name || "Staff";
    var stageTitle = params.stage_title || params.stage || "Review Stage";
    var actionRequired = params.action_required || "Please review and take appropriate action on this document.";
    var notes = params.notes || params.comment || params.reason || "";
    var directUrl = params.direct_url || params.action_url || "http://localhost:3000/eng/process_eng/ecnt_v2";
    var priority = params.priority || "NORMAL";
    var isRework = (params.is_rework === "true" || params.is_rework === true);

    // Subject
    var subjectPrefix = isRework ? "⚠️ [REWORK / CLARIFICATION REQUIRED]" : "📋 [ACTION REQUIRED]";
    var subject = subjectPrefix + " " + docNo + " - " + stageTitle + " (" + customer + ")";

    // HTML Email Generation
    var badgeColor = isRework ? "#fa8c16" : "#1890ff";
    var headerBg = isRework ? "linear-gradient(135deg, #d46b08 0%, #fa8c16 100%)" : "linear-gradient(135deg, #002766 0%, #1890ff 100%)";

    var htmlBody = "" +
    "<!DOCTYPE html>" +
    "<html>" +
    "<head>" +
    "<meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
    "<style>" +
    "  body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }" +
    "  .container { max-width: 620px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e8e8e8; }" +
    "  .header { background: " + headerBg + "; padding: 24px 30px; color: #ffffff; text-align: left; }" +
    "  .header-tag { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }" +
    "  .header-title { font-size: 20px; font-weight: 700; margin: 0; line-height: 1.3; }" +
    "  .header-sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }" +
    "  .content { padding: 28px 30px; }" +
    "  .action-callout { background: " + (isRework ? "#fff7e6" : "#e6f7ff") + "; border-left: 4px solid " + badgeColor + "; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 22px; }" +
    "  .action-title { font-size: 14px; font-weight: 700; color: " + (isRework ? "#d46b08" : "#0050b3") + "; margin-bottom: 4px; }" +
    "  .action-text { font-size: 13px; color: #262626; line-height: 1.5; margin: 0; }" +
    "  .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }" +
    "  .details-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }" +
    "  .details-table td.label { width: 34%; font-weight: 600; color: #595959; background-color: #fafafa; border-right: 1px solid #f0f0f0; }" +
    "  .details-table td.val { color: #262626; }" +
    "  .notes-box { background: #fafafa; border: 1px dashed #d9d9d9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #595959; }" +
    "  .btn-wrapper { text-align: center; margin: 28px 0 10px 0; }" +
    "  .btn-action { display: inline-block; background-color: " + badgeColor + "; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 3px 8px rgba(24,144,255,0.3); letter-spacing: 0.3px; }" +
    "  .footer { background: #fafafa; border-top: 1px solid #f0f0f0; padding: 18px 30px; text-align: center; font-size: 11px; color: #8c8c8c; line-height: 1.6; }" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<div class='container'>" +
    "  <div class='header'>" +
    "    <span class='header-tag'>" + docType + " WORKFLOW NOTIFICATION</span>" +
    "    <h1 class='header-title'>" + docNo + "</h1>" +
    "    <div class='header-sub'>" + titleOfChange + "</div>" +
    "  </div>" +
    "  <div class='content'>" +
    "    <div class='action-callout'>" +
    "      <div class='action-title'>" + (isRework ? "⚠️ Action Required: Revision / Clarification" : "👉 Required Action: " + stageTitle) + "</div>" +
    "      <p class='action-text'>" + actionRequired + "</p>" +
    "    </div>" +
    "    <table class='details-table'>" +
    "      <tr><td class='label'>Document No:</td><td class='val'><strong>" + docNo + "</strong></td></tr>" +
    "      <tr><td class='label'>Title of Change:</td><td class='val'>" + titleOfChange + "</td></tr>" +
    "      <tr><td class='label'>Customer:</td><td class='val'>" + customer + "</td></tr>" +
    "      <tr><td class='label'>Initiated By:</td><td class='val'>" + requester + " (" + department + ")</td></tr>" +
    "      <tr><td class='label'>Current Stage:</td><td class='val'><strong>" + stageTitle + "</strong></td></tr>" +
    "      <tr><td class='label'>Priority:</td><td class='val'><span style='color:" + (priority === "URGENT" ? "#f5222d" : "#52c41a") + ";font-weight:600;'>" + priority + "</span></td></tr>" +
    "    </table>" +
    (notes ? ("    <div class='notes-box'><strong>Notes / Clarification Request:</strong><br>" + notes + "</div>") : "") +
    "    <div class='btn-wrapper'>" +
    "      <a href='" + directUrl + "' class='btn-action' target='_blank'>🔗 Open Document in ECNT System</a>" +
    "    </div>" +
    "  </div>" +
    "  <div class='footer'>" +
    "    <strong>" + SYSTEM_NAME + "</strong><br>" +
    "    This is an automated operational notification. You can click the button above to navigate directly to the document and complete your required action.<br>" +
    "    Timestamp: " + new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }) + " (Bangkok Time)" +
    "  </div>" +
    "</div>" +
    "</body>" +
    "</html>";

    MailApp.sendEmail({
        to: recipients,
        subject: subject,
        htmlBody: htmlBody
    });

    return "ECNT notification sent to " + recipients;
}

// ============================================================================
// 2. Generic Reusable Template Email Dispatcher (For Other Systems)
// ============================================================================
function sendGenericTemplateEmail(params) {
    var recipients = params.recipients || params.user_to || params.to;
    if (!recipients) {
        throw new Error("Missing email recipients");
    }

    var appName = params.app_name || "EngineerSystem";
    var subject = params.subject || ("[" + appName + "] Notification");
    var title = params.title || subject;
    var message = params.message || params.body || "You have a new update in the system.";
    var details = params.details || {};
    if (typeof details === "string") {
        try { details = JSON.parse(details); } catch(e) { details = {}; }
    }

    var actionUrl = params.action_url || params.direct_url || "";
    var actionButtonText = params.action_button_text || "View in System";
    var themeColor = params.theme_color || BRAND_PRIMARY_COLOR;

    // Build details table rows
    var detailsRows = "";
    for (var key in details) {
        if (details.hasOwnProperty(key)) {
            detailsRows += "<tr><td style='padding:8px 12px;font-weight:600;color:#595959;background:#fafafa;border:1px solid #f0f0f0;width:35%;'>" + key + "</td><td style='padding:8px 12px;color:#262626;border:1px solid #f0f0f0;'>" + details[key] + "</td></tr>";
        }
    }

    var htmlBody = "" +
    "<!DOCTYPE html>" +
    "<html>" +
    "<head><meta charset='utf-8'></head>" +
    "<body style='margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,sans-serif;'>" +
    "<div style='max-width:600px;margin:20px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e8e8e8;box-shadow:0 3px 12px rgba(0,0,0,0.05);'>" +
    "  <div style='background:" + themeColor + ";padding:20px 24px;color:#fff;'>" +
    "    <div style='font-size:11px;letter-spacing:0.5px;opacity:0.85;text-transform:uppercase;margin-bottom:4px;'>" + appName + "</div>" +
    "    <h2 style='margin:0;font-size:18px;font-weight:700;'>" + title + "</h2>" +
    "  </div>" +
    "  <div style='padding:24px;'>" +
    "    <p style='font-size:14px;color:#262626;line-height:1.6;margin-top:0;'>" + message + "</p>" +
    (detailsRows ? ("<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;'>" + detailsRows + "</table>") : "") +
    (actionUrl ? ("<div style='text-align:center;margin:24px 0;'><a href='" + actionUrl + "' style='display:inline-block;background:" + themeColor + ";color:#ffffff!important;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;'>" + actionButtonText + "</a></div>") : "") +
    "  </div>" +
    "  <div style='background:#fafafa;border-top:1px solid #f0f0f0;padding:14px 24px;text-align:center;font-size:11px;color:#8c8c8c;'>" +
    "    " + SYSTEM_NAME + " • Automated Notification • " + new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }) +
    "  </div>" +
    "</div>" +
    "</body>" +
    "</html>";

    MailApp.sendEmail({
        to: recipients,
        subject: subject,
        htmlBody: htmlBody
    });

    return "Generic template email sent to " + recipients;
}

// ============================================================================
// 3. Error Report Dispatcher
// ============================================================================
function sendErrorReport(params) {
    var recipients = params.recipients || "nanthiwa.k@minebea.co.th";
    var subject = "🚨 " + (params.subject || "System Error Report");
    var errorMsg = params.error_msg || "Unknown Error";

    var body = "SYSTEM ERROR REPORT\n" +
        "Action: " + (params.action || "N/A") + "\n" +
        "Status: " + (params.status || "N/A") + "\n" +
        "Error: " + errorMsg + "\n" +
        "User: " + (params.user || "N/A") + "\n" +
        "Time: " + new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    MailApp.sendEmail(recipients, subject, body);
    return "Error report sent to " + recipients;
}
