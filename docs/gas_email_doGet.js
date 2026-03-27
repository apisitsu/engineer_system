/**
 * Google Apps Script – Email Notification Endpoint (doGet)
 * 
 * DEPLOYMENT SETTINGS:
 *   Execute as: Me (your_email@minebea.co.th)
 *   Who has access: Anyone
 * 
 * HOW IT WORKS:
 *   React renders a hidden <iframe src="GAS_URL?funct=sendNotificationEmail&cn=XXX">
 *   → Browser GETs the URL (proxy auth handled transparently)
 *   → GAS doGet(e) routes to sendNotificationEmail()
 *   → Email is sent via GmailApp from deployer's account
 *   → Returns "Success" text to prevent empty response errors
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
            default:
                break;
        }

        // Instead of Plain text, we MUST return HTML that executes a script to send postMessage to the parent window (React frontend)
        var htmlSuccess = "<script>" +
            "try {" +
            "    if (window.top.opener) {" + // กรณีเปิดแบบ Popup
            "        window.top.opener.postMessage({ type: 'GAS_MAIL_RESULT', status: 'success' }, '*');" +
            "        window.top.close();" +
            "    } else if (window.top !== window) {" + // กรณีเปิดแบบ Iframe (ซ่อน)
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

// --- Send Email ---
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
