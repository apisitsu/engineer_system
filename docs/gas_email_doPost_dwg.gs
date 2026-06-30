/**
 * Google Apps Script – Email Endpoint for the General DWG Request system (doPost)
 *
 * The backend (api/system/emailService.js → sendEmailViaAS) POSTs JSON:
 *   { user_to, subject, body, from_name?, reply_to? }
 *
 * WHY THIS UPDATE
 *   MailApp/GmailApp always send FROM the script owner ("Execute as: Me"), so
 *   recipients used to see the script author as the sender. We can't change the
 *   From *address* to an arbitrary user without Google Workspace admin setup
 *   (domain-wide delegation or a "Send mail as" alias), but we CAN:
 *     • set the From DISPLAY NAME to the real sender  → MailApp option `name`
 *     • route replies to the real sender             → MailApp option `replyTo`
 *   So the recipient now sees e.g.  "สมชาย (General DWG Request) <script-owner@…>"
 *   and replying reaches สมชาย, not the script owner.
 *
 * DEPLOYMENT
 *   Execute as: Me (the shared/sender account)
 *   Who has access: Anyone
 *   Deploy as Web app, then keep the SAME /exec URL in GAS_EMAIL_URL (.env). If a
 *   new deployment changes the URL, update GAS_EMAIL_URL.
 *
 * TRUE "send as the real user" (optional, needs admin):
 *   Use a Google Cloud service account with domain-wide delegation and the Gmail
 *   API users.messages.send while impersonating the sender's mailbox. That makes
 *   the From address genuinely the user. This script intentionally stays on the
 *   no-admin path (display name + Reply-To).
 */

function doPost(e) {
  var out = { status: 'success' };
  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter; // tolerate form-encoded fallback
    }

    var to = params.user_to;
    if (!to) throw new Error('user_to is required');

    var options = {
      htmlBody: params.body || '',          // body is HTML
    };
    if (params.from_name) options.name = params.from_name;     // From display name
    if (params.reply_to) options.replyTo = params.reply_to;    // replies → real sender

    MailApp.sendEmail(to, params.subject || '(no subject)', '', options);
    Logger.log('Email sent to %s from_name=%s reply_to=%s', to, params.from_name, params.reply_to);
  } catch (err) {
    out = { status: 'error', message: err.toString() };
    Logger.log('doPost error: ' + err);
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
