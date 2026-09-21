import React from 'react';
import { Button, notification } from 'antd';
import { GAS_EMAIL_WEBAPP } from '../constance/constance';

/**
 * Fire a notification email built by the backend (see toolRequestController.js's
 * `emailNotification` field) at the GAS_EMAIL_WEBAPP Apps Script.
 *
 * Must run from the browser, not the backend: an anonymous server-side call to a
 * script.google.com webapp is blocked by the Workspace admin (verified live
 * 2026-09-18 — same restriction documented for GAS_TI_CSV_URL in
 * .claude/rules/backend-gotchas.md). A GET fired as a real page navigation carries
 * the signed-in user's own Google session, so the script — deployed "Execute as:
 * User accessing the web app" — sends as that real person.
 *
 * FIRST USE PER PERSON: that deployment mode makes every user grant the script
 * access once, on a Google consent page, and that page cannot render inside a
 * hidden iframe — the request just silently does nothing. So, exactly like
 * useEmail() in services/centralEmailService.js, a browser that has not completed
 * the flow yet opens a small popup (which can show the consent page); after that
 * it sends silently through a hidden iframe. Found when a first-time approver's
 * notification never arrived.
 *
 * `payload.details`, being an object, is JSON-stringified — the script expects the
 * same shape test_mail.html's GET path sends.
 *
 * @param {{url?: string, payload?: object}} emailNotification - as returned by
 *   the backend; a null/missing url or payload is a no-op (e.g. no recipients
 *   configured for that stage, or GAS_EMAIL_WEBAPP unset).
 */

// Own key: authorization is per script, and centralEmailService's flag is for a different one.
const AUTH_KEY = 'gas_email_webapp_authorized';

const readAuthorized = () => {
  try { return localStorage.getItem(AUTH_KEY) === 'true'; } catch { return false; }
};
const markAuthorized = () => {
  try { localStorage.setItem(AUTH_KEY, 'true'); } catch { /* storage blocked: popup each time */ }
};

const isGoogleOrigin = (origin = '') =>
  origin.includes('google.com') || origin.includes('googleusercontent.com');

function buildUrl(baseUrl, payload) {
  const queryParams = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    queryParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  queryParams.append('t', Date.now());   // never let a cached response stand in for a send
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;
}

function sendSilently(url) {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = 'display:none;position:absolute;left:-9999px;width:0;height:0;';
  iframe.title = 'gas-template-email';
  document.body.appendChild(iframe);
  setTimeout(() => {
    try { document.body.removeChild(iframe); } catch { /* already removed */ }
  }, 10000);
}

/** Returns false when the browser blocked the popup. */
function openAuthPopup(url) {
  const width = 600;
  const height = 650;
  const left = (window.innerWidth / 2) - (width / 2) + window.screenX;
  const top = (window.innerHeight / 2) - (height / 2) + window.screenY;
  const popup = window.open(
    url,
    'GAS_Email_Notifier',
    `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,scrollbars=yes`
  );
  if (!popup) return false;

  const onMessage = (event) => {
    if (!isGoogleOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== 'GAS_MAIL_RESULT') return;
    cleanup();
    if (data.status === 'success') {
      markAuthorized();
      try { if (!popup.closed) popup.close(); } catch { /* cross-origin close is best effort */ }
    } else {
      notification.error({
        message: 'Notification email failed',
        description: data.message || 'The mail script reported an error.',
      });
    }
  };
  // The script closes its own window on success and may not post a message at all;
  // the person finishing the Google prompt and closing it is the other signal that
  // the one-time step is done, so the next send can go silent.
  const poll = setInterval(() => {
    if (popup.closed) {
      cleanup();
      markAuthorized();
    }
  }, 1000);
  function cleanup() {
    window.removeEventListener('message', onMessage);
    clearInterval(poll);
  }
  window.addEventListener('message', onMessage);
  return true;
}

export function sendGasTemplateEmail(emailNotification) {
  const baseUrl = emailNotification?.url || GAS_EMAIL_WEBAPP;
  const payload = emailNotification?.payload;
  if (!baseUrl || !payload) return;

  const url = buildUrl(baseUrl, payload);

  if (readAuthorized()) {
    sendSilently(url);
    return;
  }

  if (!openAuthPopup(url)) {
    // Popups blocked — offer a button, whose click is the user gesture a popup needs.
    const key = `gas-email-${Date.now()}`;
    notification.warning({
      key,
      duration: 0,
      message: 'Notification email not sent yet',
      description: 'Your browser blocked the Google window needed to send the notification email. Click below, then allow it in Google if asked.',
      btn: React.createElement(
        Button,
        {
          type: 'primary',
          size: 'small',
          onClick: () => {
            if (openAuthPopup(url)) notification.destroy(key);
          },
        },
        'Send notification email'
      ),
    });
  }
}
