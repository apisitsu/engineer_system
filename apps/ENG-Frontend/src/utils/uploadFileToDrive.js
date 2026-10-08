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
    return window.open(GAS_DRIVE_URL, 'gas_auth', 'width=540,height=620,left=300,top=100');
}

/**
 * Upload file to Google Drive (Kanban or ECNT)
 * Default: Silent background execution via hidden iframe (NO POPUP)
 * Popup is only utilized if options.forcePopup is true or an active popup window is explicitly provided.
 *
 * @param {File} file
 * @param {object} meta - { projectId, boardId, cardId } OR { system: 'ecnt', ecrNo, ecnNo, blockNumber, fieldName }
 * @param {object} options - { popup: Window, forcePopup: boolean, timeout: number, onStatusChange: Function }
 */
export async function uploadFileToDrive(file, meta = {}, options = {}) {
    const timeout = options.timeout || 120000;
    if (!GAS_DRIVE_URL) throw new Error('GAS_DRIVE_URL is not configured in constance.js');

    const isEcnt = meta.system === 'ecnt' || Boolean(meta.ecrNo || meta.ecnNo);

    // Use popup window (Required for Google Workspace authentication cookies)
    let popup = options.popup;
    if (options.usePopup !== false && (!popup || popup.closed)) {
        try {
            popup = window.open('about:blank', 'gas_upload', 'width=460,height=380,left=300,top=120');
        } catch (e) {
            popup = null;
        }
    }

    const usePopup = Boolean(popup && !popup.closed);

    if (usePopup) {
        popup.document.write(`<!DOCTYPE html><html><head><title>Google Drive Upload</title></head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;text-align:center;padding:40px 20px;background:#f8fafc;margin:0;">
<div style="background:white;border-radius:12px;padding:32px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-width:360px;margin:auto;border:1px solid #e2e8f0;">
<div style="font-size:36px;margin-bottom:12px;">📤</div>
<h3 style="margin:0 0 8px;color:#0f172a;font-size:16px;">กำลังอัปโหลดไปยัง Google Drive</h3>
<p style="color:#64748b;font-size:13px;margin:0 0 12px;word-break:break-all;"><b>${file.name}</b></p>
<p style="color:#94a3b8;font-size:11px;margin:0;">หน้าต่างนี้จะปิดอัตโนมัติเมื่อเสร็จสิ้น...</p>
</div></body></html>`);
        popup.document.close();
    }

    const base64Data = await fileToBase64(file);

    const payloadObj = {
        action: 'upload',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
    };

    if (isEcnt) {
        payloadObj.system = 'ecnt';
        payloadObj.ecrNo = (meta.ecrNo || '').trim();
        payloadObj.ecnNo = (meta.ecnNo || '').trim();
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
                    cleanup();
                    if (data.success) {
                        resolve(data);
                    } else {
                        reject(makeError(data.error || 'GAS upload failed'));
                    }
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('message', handler);

        const timer = setTimeout(() => {
            cleanup();
            reject(makeError('GAS upload timed out. ระบบอาจจำเป็นต้องเปิดหน้าต่างยืนยันสิทธิ์ Google Apps Script ก่อน'));
        }, timeout);

        if (usePopup) {
            const escapedUrl = GAS_DRIVE_URL.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            popup.document.open();
            popup.document.write(`<!DOCTYPE html><html><head><title>Google Drive Upload</title></head>
<body style="font-family:'Segoe UI',sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
<div style="background:white;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:360px;margin:auto;">
<div style="font-size:32px;margin-bottom:16px;">📤</div>
<h3 style="margin:0 0 8px;">กำลังอัปโหลดไฟล์...</h3>
<p style="color:#666;font-size:13px;margin:0;">หากระบบต้องการสิทธิ์เข้าถึง คุณจะเห็นหน้าต่างของ Google<br>หน้าต่างนี้จะปิดอัตโนมัติเมื่อเสร็จสิ้น</p>
</div>
<form id="gf" method="POST" action="${escapedUrl}">
<input type="hidden" name="payload" id="pl"/>
</form>
<script>
document.getElementById('pl').value = window.opener.__gasPayload;
document.getElementById('gf').submit();
</script>
</body></html>`);
            popup.document.close();
        } else {
            // Hidden iframe execution
            const iframeName = `gas-up-${Date.now()}`;
            iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

            form = document.createElement('form');
            form.method = 'POST';
            form.action = GAS_DRIVE_URL;
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

        const iframeName = `gas-sync-${Date.now()}`;
        const iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = GAS_DRIVE_URL;
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
 * Executes via auto-closing popup window to ensure first-party Google Workspace cookie transmission.
 *
 * @param {string|string[]} fileIdOrIds - Single Drive file ID or array of Drive file IDs
 * @param {object} options - { popup: Window, usePopup: boolean, timeout: number }
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

        const timeout = options.timeout || 15000;

        // Use popup window (Required for Google Workspace authentication cookies)
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

        const escapedUrl = GAS_DRIVE_URL.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        if (usePopup) {
            try {
                popup.document.open();
                popup.document.write(`<!DOCTYPE html><html><head><title>Google Drive Delete</title></head>
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
document.getElementById('pl').value = window.opener.__gasDeletePayload;
document.getElementById('gf').submit();
</script>
</body></html>`);
                popup.document.close();
            } catch (err) {
                console.error('[deleteFileFromDrive] Popup write error:', err);
                cleanup();
                resolve({ success: false, error: err.message });
            }
        } else {
            // Fallback: hidden iframe/form if popup was blocked
            const iframeName = `gas-del-${Date.now()}`;
            iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

            form = document.createElement('form');
            form.method = 'POST';
            form.action = GAS_DRIVE_URL;
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
        }
    });
}

export default uploadFileToDrive;
