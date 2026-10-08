/**
 * uploadFileToDrive.js — Universal Google Drive Upload via Google Apps Script (GAS)
 *
 * Supports both:
 * 1. Kanban System Attachments (legacy: projectId, boardId, cardId)
 * 2. ECNT (ECR / ECN) System Attachments (new: system: 'ecnt', ecrNo, ecnNo)
 *
 * Dual Mode Execution:
 * - Uses a Popup window when provided (avoids popup blockers if opened on user gesture)
 * - Automatically falls back to a hidden iframe if popup is blocked or not provided.
 */

import { GAS_DRIVE_URL } from '../constance/constance';

export function cleanGasUrl(url = GAS_DRIVE_URL) {
    // Preserve the exact Google Workspace URL (/a/macros/minebea.co.th/s/.../exec)
    // Stripping this causes a 302 redirect that turns POST into GET and drops the payload.
    return url || '';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Opens Google Apps Script Auth / Permission window for user authorization
 */
export function openGoogleDriveAuthWindow() {
    if (!GAS_DRIVE_URL) return null;
    const authUrl = cleanGasUrl(GAS_DRIVE_URL);
    return window.open(authUrl, 'gas_auth', 'width=540,height=620,left=300,top=100');
}

function requestUserGesturePopup(fileName) {
    return new Promise((resolve) => {
        // If an overlay is already present, remove it
        const existing = document.getElementById('gas_popup_block_overlay');
        if (existing) {
            try { document.body.removeChild(existing); } catch(e){}
        }

        const overlay = document.createElement('div');
        overlay.id = 'gas_popup_block_overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:9999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';
        
        const box = document.createElement('div');
        box.style.cssText = 'background:white;border-radius:14px;padding:28px 24px;width:420px;max-width:90vw;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15);border:1px solid #e2e8f0;';
        
        box.innerHTML = `
            <div style="font-size:42px;margin-bottom:12px;">🛡️</div>
            <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;font-weight:700;">เบราว์เซอร์บล็อกหน้าต่าง Pop-up</h3>
            <p style="color:#64748b;font-size:13px;margin:0 0 16px;line-height:1.5;">
                ระบบจำเป็นต้องใช้หน้าต่างนำส่งไฟล์ไปยัง Google Drive สำหรับไฟล์:<br>
                <b style="color:#1e293b;word-break:break-all;">${(fileName || 'file').replace(/</g, '&lt;')}</b>
            </p>
            <button id="gas_popup_action_btn" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer;width:100%;box-shadow:0 2px 4px rgba(37,99,235,0.25);transition:background 0.2s;">
                🚀 คลิกเพื่อเปิดหน้าต่างและอัปโหลดทันที
            </button>
            <p style="color:#94a3b8;font-size:11px;margin:14px 0 0;line-height:1.4;">
                💡 ทริก: คุณสามารถคลิกไอคอน 🚫 ที่มุมขวาของแถบ URL ของ Chrome แล้วเลือก <b>"อนุญาตป็อปอัปเสมอ"</b> เพื่อให้อัปโหลดอัตโนมัติในครั้งถัดไป
            </p>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const btn = box.querySelector('#gas_popup_action_btn');
        btn.onmouseover = () => { btn.style.background = '#1d4ed8'; };
        btn.onmouseout = () => { btn.style.background = '#2563eb'; };
        btn.onclick = () => {
            const p = window.open('about:blank', 'gas_upload', 'width=460,height=420,left=350,top=150');
            try { document.body.removeChild(overlay); } catch(e){}
            resolve(p);
        };
    });
}

/**
 * Upload file to Google Drive (Kanban or ECNT)
 * Uses an auto-closing helper popup window by default to ensure first-party Google Workspace cookie transmission.
 * Falls back to hidden iframe only if popup is blocked or not supported.
 *
 * @param {File} file
 * @param {object} meta - { projectId, boardId, cardId } OR { system: 'ecnt', ecrNo, ecnNo, blockNumber, fieldName }
 * @param {object} options - { popup: Window, usePopup: boolean, timeout: number }
 */
export async function uploadFileToDrive(file, meta = {}, options = {}) {
    const timeout = options.timeout || 120000;
    if (!GAS_DRIVE_URL) throw new Error('GAS_DRIVE_URL is not configured in constance.js');
    const targetGasUrl = cleanGasUrl(GAS_DRIVE_URL);

    const isEcnt = meta.system === 'ecnt' || Boolean(meta.ecrNo || meta.ecnNo);

    console.log('%c[GAS Drive Upload] 🚀 Start upload', 'color:#0284c7;font-weight:bold;font-size:12px;', {
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileType: file.type || 'unknown',
        system: isEcnt ? 'ecnt' : 'kanban',
        meta,
        targetUrl: targetGasUrl
    });

    const escapedUrl = targetGasUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // Helper popup window: MUST be opened synchronously before any async await
    let popup = options.popup;
    if (options.usePopup !== false && (!popup || popup.closed)) {
        try {
            popup = window.open('about:blank', 'gas_upload', 'width=460,height=420,left=350,top=150');
            console.log('%c[GAS Drive Upload] 🪟 Helper popup opened synchronously', 'color:#0284c7;');
        } catch (e) {
            console.warn('%c[GAS Drive Upload] ⚠️ Failed to open popup directly', 'color:#eab308;', e);
            popup = null;
        }

        // If browser blocked synchronous popup, show user gesture prompt button
        if (!popup || popup.closed) {
            console.warn('%c[GAS Drive Upload] ⚠️ Popup blocked by browser. Showing user gesture prompt...', 'color:#eab308;');
            popup = await requestUserGesturePopup(file.name);
        }
    } else if (popup && !popup.closed) {
        console.log('%c[GAS Drive Upload] 🪟 Reusing caller-provided popup', 'color:#0284c7;');
    }

    const usePopup = Boolean(popup && !popup.closed);

    if (usePopup) {
        try {
            popup.document.open();
            popup.document.write(`<!DOCTYPE html><html><head><title>Google Drive Upload</title></head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f8fafc;margin:0;">
<div style="background:white;border-radius:12px;padding:32px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:360px;margin:auto;border:1px solid #e2e8f0;">
<div style="font-size:36px;margin-bottom:12px;">📤</div>
<h3 style="margin:0 0 8px;color:#0f172a;font-size:16px;">กำลังเตรียมไฟล์...</h3>
<p style="color:#64748b;font-size:13px;margin:0 0 12px;word-break:break-all;"><b>${(file.name || 'File').replace(/</g, '&lt;')}</b></p>
<p style="color:#94a3b8;font-size:11px;margin:0;">ระบบกำลังแปลงข้อมูลและนำส่ง Google Drive...</p>
</div></body></html>`);
            popup.document.close();
        } catch (err) {
            console.warn('[uploadFileToDrive] Popup pre-write warning:', err);
        }
    }

    const base64Data = await fileToBase64(file);
    console.log('%c[GAS Drive Upload] 📦 Base64 conversion complete:', 'color:#0284c7;', `${(base64Data.length / 1024).toFixed(1)} KB`);

    const payloadObj = {
        action: 'upload',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
    };

    if (isEcnt) {
        payloadObj.system = 'ecnt';
        let ecrNo = (meta.ecrNo || '').trim();
        let ecnNo = (meta.ecnNo || '').trim();
        if (!ecrNo && !ecnNo) ecrNo = 'ECNT_General';
        payloadObj.ecrNo = ecrNo;
        payloadObj.ecnNo = ecnNo;
        if (meta.blockNumber) payloadObj.blockNumber = meta.blockNumber;
        if (meta.fieldName) payloadObj.fieldName = meta.fieldName;
    } else {
        payloadObj.system = 'kanban';
        payloadObj.projectId = String(meta.projectId || 0);
        payloadObj.boardId = String(meta.boardId || 0);
        payloadObj.cardId = String(meta.cardId || 0);
    }

    const payloadStr = JSON.stringify(payloadObj);
    window.__gasPayload = payloadStr;
    console.log('%c[GAS Drive Upload] 📋 Payload stored in window.__gasPayload (length: ' + payloadStr.length + ')', 'color:#0284c7;');

    const makeError = (msg) => {
        const err = new Error(msg);
        const lower = String(msg || '').toLowerCase();
        if (
            lower.includes('auth') || 
            lower.includes('permission') || 
            lower.includes('timed out') || 
            lower.includes('timeout') ||
            lower.includes('สิทธิ์') ||
            lower.includes('unauthorized') ||
            lower.includes('access_denied')
        ) {
            err.isAuthRequired = true;
        }
        return err;
    };

    return new Promise((resolve, reject) => {
        let cleanupDone = false;
        let iframe = null;
        let form = null;

        function cleanup() {
            if (cleanupDone) return;
            cleanupDone = true;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            delete window.__gasPayload;
            if (usePopup) {
                try { if (popup && !popup.closed) popup.close(); } catch { }
            }
            if (iframe && iframe.parentNode) {
                try { document.body.removeChild(iframe); } catch { }
            }
            if (form && form.parentNode) {
                try { document.body.removeChild(form); } catch { }
            }
        }

        const handler = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && data._gasUploadResponse) {
                    console.log('%c[GAS Drive Upload] 📨 postMessage received successfully from:', 'color:#16a34a;font-weight:bold;', event.origin, data);
                    cleanup();
                    if (data.success) {
                        resolve(data);
                    } else {
                        console.error('%c[GAS Drive Upload] ❌ GAS responded with error:', 'color:#ef4444;font-weight:bold;', data.error);
                        reject(makeError(data.error || 'GAS upload failed'));
                    }
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('message', handler);

        const timer = setTimeout(() => {
            cleanup();
            console.error('%c[GAS Drive Upload] ⏱️ Timeout after ' + (timeout / 1000) + 's', 'color:#ef4444;font-weight:bold;');
            reject(makeError('GAS upload timed out. ระบบอาจจำเป็นต้องเปิดหน้าต่างยืนยันสิทธิ์ Google Apps Script ก่อน'));
        }, timeout);

        const submitViaIframe = () => {
            console.log('%c[GAS Drive Upload] 📦 Executing upload via hidden iframe fallback...', 'color:#eab308;');
            const iframeName = `gas-up-${Date.now()}`;
            iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

            form = document.createElement('form');
            form.method = 'POST';
            form.action = targetGasUrl;
            form.target = iframeName;
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'payload';
            input.value = payloadStr;
            form.appendChild(input);

            document.body.appendChild(iframe);
            document.body.appendChild(form);
            form.submit();
            console.log('%c[GAS Drive Upload] 🚀 Iframe form submitted to:', 'color:#eab308;', targetGasUrl);
        };

        if (usePopup) {
            try {
                console.log('%c[GAS Drive Upload] 🪟 Preparing popup with self-executing form submit...', 'color:#0284c7;');
                const doc = popup.document;
                doc.open();
                doc.write(`<!DOCTYPE html><html><head><title>Google Drive Upload</title></head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f8fafc;margin:0;">
<div style="background:white;border-radius:12px;padding:32px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:360px;margin:auto;border:1px solid #e2e8f0;">
<div style="font-size:36px;margin-bottom:12px;">📤</div>
<h3 style="margin:0 0 8px;color:#0f172a;font-size:16px;">กำลังนำส่งไฟล์ไปยัง Google Drive</h3>
<p style="color:#64748b;font-size:13px;margin:0 0 12px;word-break:break-all;"><b>${(file.name || 'File').replace(/</g, '&lt;')}</b></p>
<p style="color:#94a3b8;font-size:11px;margin:0;">กรุณารอสักครู่ หน้าต่างนี้จะปิดอัตโนมัติเมื่อเสร็จสิ้น...</p>
</div>
<form id="gf" method="POST" action="${escapedUrl}">
<input type="hidden" name="payload" id="pl"/>
</form>
<script>
(function() {
    console.log('[GAS Popup Window] 🌐 Window loaded, initiating POST to GAS...');
    try {
        var openerRef = window.opener || (window.top && window.top.opener);
        var payload = openerRef ? openerRef.__gasPayload : null;
        if (!payload) {
            console.error('[GAS Popup Window] ❌ opener.__gasPayload not found!');
            return;
        }
        var inp = document.getElementById('pl');
        var form = document.getElementById('gf');
        if (!inp || !form) {
            console.error('[GAS Popup Window] ❌ Form elements not found!');
            return;
        }
        inp.value = payload;
        console.log('[GAS Popup Window] 🚀 Submitting form POST to:', form.action);
        form.submit();
        console.log('[GAS Popup Window] ✅ Form submitted successfully!');
    } catch (e) {
        console.error('[GAS Popup Window] ❌ Exception submitting form:', e);
    }
})();
</script>
</body></html>`);
                doc.close();
                console.log('%c[GAS Drive Upload] ✅ Popup HTML and script injected successfully', 'color:#0284c7;');
            } catch (pErr) {
                console.warn('%c[GAS Drive Upload] ⚠️ Popup write error, falling back to iframe:', 'color:#eab308;', pErr);
                submitViaIframe();
            }
        } else {
            submitViaIframe();
        }
    });
}

/**
 * Dedicated helper for ECNT files
 */
export async function uploadEcntFileToDrive(file, { ecrNo, ecnNo, blockNumber, fieldName } = {}, options = {}) {
    return uploadFileToDrive(file, {
        system: 'ecnt',
        ecrNo: ecrNo || '',
        ecnNo: ecnNo || '',
        blockNumber: blockNumber || null,
        fieldName: fieldName || null
    }, options);
}

/**
 * Sync / Rename ECNT folder once ECN number is assigned
 */
export function syncEcntDriveFolder({ ecrNo, ecnNo }) {
    return new Promise((resolve) => {
        if (!GAS_DRIVE_URL || !ecrNo || !ecnNo) {
            return resolve({ success: true, bypassed: true });
        }

        const targetGasUrl = cleanGasUrl(GAS_DRIVE_URL);
        const iframeName = `gas-sync-${Date.now()}`;
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = targetGasUrl;
        form.target = iframeName;
        form.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify({
            action: 'sync_folder',
            system: 'ecnt',
            ecrNo: String(ecrNo).trim(),
            ecnNo: String(ecnNo).trim()
        });
        form.appendChild(input);

        document.body.appendChild(iframe);
        document.body.appendChild(form);

        let cleanupDone = false;
        function cleanup() {
            if (cleanupDone) return;
            cleanupDone = true;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            try { document.body.removeChild(iframe); } catch { }
            try { document.body.removeChild(form); } catch { }
        }

        const handler = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && data._gasUploadResponse) {
                    cleanup();
                    resolve(data);
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('message', handler);

        const timer = setTimeout(() => {
            cleanup();
            resolve({ success: false, timeout: true });
        }, 20000);

        form.submit();
    });
}

/**
 * Delete file(s) from Google Drive via GAS
 * Executes silently in background via hidden iframe (NO POPUP).
 * Popup is only utilized if options.forcePopup is true.
 *
 * @param {string|string[]} fileIdOrIds - Single Drive file ID or array of Drive file IDs
 * @param {object} options - { popup: Window, forcePopup: boolean, timeout: number }
 */
export function deleteFileFromDrive(fileIdOrIds, options = {}) {
    return new Promise((resolve) => {
        if (!GAS_DRIVE_URL || !fileIdOrIds) {
            return resolve({ success: true, bypassed: true });
        }

        const ids = Array.isArray(fileIdOrIds)
            ? fileIdOrIds.filter(Boolean)
            : [fileIdOrIds].filter(Boolean);

        if (ids.length === 0) {
            return resolve({ success: true, bypassed: true });
        }

        const timeout = options.timeout || 25000;
        const targetGasUrl = cleanGasUrl(GAS_DRIVE_URL);

        // Helper popup window for first-party cookie transmission
        let popup = options.popup;
        if (options.usePopup !== false && (!popup || popup.closed)) {
            try {
                popup = window.open('about:blank', 'gas_delete', 'width=420,height=300,left=350,top=150');
            } catch (e) {
                popup = null;
            }
        }

        const usePopup = Boolean(popup && !popup.closed);
        let iframe = null;
        let form = null;
        let cleanupDone = false;

        const payloadObj = {
            action: 'delete',
            fileId: ids[0],
            fileIds: ids
        };
        const payloadStr = JSON.stringify(payloadObj);
        window.__gasDeletePayload = payloadStr;

        function cleanup() {
            if (cleanupDone) return;
            cleanupDone = true;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            delete window.__gasDeletePayload;
            if (usePopup) {
                try { if (popup && !popup.closed) popup.close(); } catch { }
            }
            if (iframe && iframe.parentNode) {
                try { document.body.removeChild(iframe); } catch { }
            }
            if (form && form.parentNode) {
                try { document.body.removeChild(form); } catch { }
            }
        }

        const handler = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && data._gasUploadResponse) {
                    cleanup();
                    if (data.success) {
                        resolve(data);
                    } else {
                        console.warn('[deleteFileFromDrive] GAS reported delete error:', data.error);
                        resolve({ success: false, error: data.error || 'GAS delete failed' });
                    }
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('message', handler);

        const timer = setTimeout(() => {
            cleanup();
            console.warn('[deleteFileFromDrive] Timed out waiting for GAS delete confirmation');
            resolve({ success: false, timeout: true });
        }, timeout);

        const submitViaIframe = () => {
            const iframeName = `gas-del-${Date.now()}`;
            iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

            form = document.createElement('form');
            form.method = 'POST';
            form.action = targetGasUrl;
            form.target = iframeName;
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'payload';
            input.value = payloadStr;
            form.appendChild(input);

            document.body.appendChild(iframe);
            document.body.appendChild(form);
            form.submit();
        };

        const escapedUrl = targetGasUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        if (usePopup) {
            try {
                console.log('%c[GAS Drive Delete] 🪟 Preparing popup with self-executing delete script...', 'color:#ef4444;');
                const doc = popup.document;
                doc.open();
                doc.write(`<!DOCTYPE html><html><head><title>Google Drive Delete</title></head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f8fafc;margin:0;">
<div style="background:white;border-radius:12px;padding:32px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:340px;margin:auto;border:1px solid #e2e8f0;">
<div style="font-size:36px;margin-bottom:12px;">🗑️</div>
<h3 style="margin:0 0 8px;color:#0f172a;font-size:16px;">กำลังลบไฟล์จาก Google Drive</h3>
<p style="color:#94a3b8;font-size:11px;margin:0;">หน้าต่างนี้จะปิดอัตโนมัติเมื่อเสร็จสิ้น...</p>
</div>
<form id="gf" method="POST" action="${escapedUrl}">
<input type="hidden" name="payload" id="pl"/>
</form>
<script>
(function() {
    console.log('[GAS Popup Delete] 🌐 Window loaded, initiating POST delete...');
    try {
        var openerRef = window.opener || (window.top && window.top.opener);
        var payload = openerRef ? openerRef.__gasDeletePayload : null;
        if (!payload) {
            console.error('[GAS Popup Delete] ❌ opener.__gasDeletePayload not found!');
            return;
        }
        var inp = document.getElementById('pl');
        var form = document.getElementById('gf');
        if (inp && form) {
            inp.value = payload;
            console.log('[GAS Popup Delete] 🚀 Submitting delete form to:', form.action);
            form.submit();
        }
    } catch(e) {
        console.error('[GAS Popup Delete] ❌ Error submitting delete form:', e);
    }
})();
</script>
</body></html>`);
                doc.close();
            } catch (err) {
                console.error('[deleteFileFromDrive] Popup write error:', err);
                submitViaIframe();
            }
        } else {
            submitViaIframe();
        }
    });
}

export default uploadFileToDrive;
