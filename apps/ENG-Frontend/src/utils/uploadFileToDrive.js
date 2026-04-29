/**
 * uploadFileToDrive.js — Upload to Google Drive via GAS Popup
 *
 * Uses a Popup window to ensure Google Authorization screens are visible to the user.
 * This is required if GAS is deployed as "Execute as: User accessing the web app".
 * To avoid popup blockers, the popup MUST be opened synchronously from a click event
 * and passed as options.popup.
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
 * @param {File} file
 * @param {object} meta - { projectId, boardId, cardId }
 * @param {object} options - { popup: Window, timeout: number }
 */
export async function uploadFileToDrive(file, meta, options = {}) {
    const timeout = options.timeout || 120000;
    const popup = options.popup;

    if (!GAS_DRIVE_URL) throw new Error('GAS_DRIVE_URL is not configured');
    if (!popup || popup.closed) throw new Error('Popup ถูกบล็อก กรุณาอนุญาต popup สำหรับเว็บไซต์นี้');

    // Show loading UI in popup
    popup.document.write(`<!DOCTYPE html><html><head><title>Google Drive Upload</title></head>
<body style="font-family:'Segoe UI',sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
<div style="background:white;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:360px;margin:auto;">
<div style="font-size:32px;margin-bottom:16px;">📤</div>
<h3 style="margin:0 0 8px;">กำลังเตรียมไฟล์...</h3>
<p style="color:#666;font-size:13px;margin:0;">กรุณารอสักครู่...</p>
</div></body></html>`);
    popup.document.close();

    const base64Data = await fileToBase64(file);
    const payload = JSON.stringify({
        action: 'upload',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
        projectId: String(meta.projectId),
        boardId: String(meta.boardId),
        cardId: String(meta.cardId),
    });
    window.__gasPayload = payload;

    return new Promise((resolve, reject) => {
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

        let cleanupDone = false;
        function cleanup() {
            if (cleanupDone) return;
            cleanupDone = true;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            delete window.__gasPayload;
            try { if (popup && !popup.closed) popup.close(); } catch { }
        }

        const handler = (event) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && data._gasUploadResponse) {
                    cleanup();
                    if (data.success) resolve(data);
                    else reject(new Error(data.error || 'GAS upload failed'));
                }
            } catch { /* ignore */ }
        };

        window.addEventListener('message', handler);

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('GAS upload timed out. กรุณาตรวจสอบสิทธิ์ Google Apps Script.'));
        }, timeout);
    });
}

// Deletion can remain as hidden iframe because it does not require user interaction 
// once the script has been authorized during upload.
export function deleteFileFromDrive(driveFileId) {
    if (!GAS_DRIVE_URL || !driveFileId) return;
    const iframeName = `gas-del-${Date.now()}`;
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
    input.value = JSON.stringify({ action: 'delete', fileId: driveFileId });
    form.appendChild(input);
    
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
    
    setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
        try { document.body.removeChild(form); } catch {}
    }, 15000);
}

export default uploadFileToDrive;
