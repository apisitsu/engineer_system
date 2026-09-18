import { GAS_EMAIL_WEBAPP } from '../constance/constance';

/**
 * Fire a notification email built by the backend (see toolRequestController.js's
 * `emailNotification` field) at the GAS_EMAIL_WEBAPP Apps Script.
 *
 * Must run from the browser, not the backend: an anonymous server-side call to a
 * script.google.com webapp is blocked by the Workspace admin (verified live
 * 2026-09-18 — same restriction documented for GAS_TI_CSV_URL in
 * .claude/rules/backend-gotchas.md). A GET fired as a real page navigation (the
 * hidden iframe below) carries the signed-in user's own Google session, so the
 * script — deployed "Execute as: User accessing the web app" — sends as that
 * real person instead of a fixed script-owner/service account. A `fetch()` POST
 * does not carry that session (no `credentials:'include'`, and Apps Script does
 * not answer CORS for it anyway), which is why this mirrors test_mail.html's
 * "GET (URL Ping)" button rather than its POST one.
 *
 * `payload.details`, being an object, is JSON-stringified — the Apps Script
 * expects the same shape test_mail.html's GET path sends.
 *
 * @param {{url?: string, payload?: object}} emailNotification - as returned by
 *   the backend; a null/missing url or payload is a no-op (e.g. no recipients
 *   configured for that stage, or GAS_EMAIL_WEBAPP unset).
 */
export function sendGasTemplateEmail(emailNotification) {
  const url = emailNotification?.url || GAS_EMAIL_WEBAPP;
  const payload = emailNotification?.payload;
  if (!url || !payload) return;

  const queryParams = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    queryParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  const targetUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`;

  const iframe = document.createElement('iframe');
  iframe.src = targetUrl;
  iframe.style.cssText = 'display:none;position:absolute;left:-9999px;width:0;height:0;';
  iframe.title = 'gas-template-email';
  document.body.appendChild(iframe);

  setTimeout(() => {
    try { document.body.removeChild(iframe); } catch { /* already removed */ }
  }, 10000);
}
