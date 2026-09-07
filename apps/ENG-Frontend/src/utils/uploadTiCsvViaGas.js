/**
 * uploadTiCsvViaGas.js — upload the Tooling Inspection CSVs to Google Drive.
 *
 * The backend cannot POST these itself: the minebea Workspace blocks anonymous
 * access to Apps Script web apps, so a server request gets a login page. A POST
 * from the signed-in browser satisfies "Anyone within minebea.co.th". Same
 * technique as Kanban's deleteFileFromDrive: a hidden <form> POST targeting a
 * hidden <iframe>, with the GAS page handing the result back via postMessage.
 *
 * @param {Array<{fileName:string, base64Data:string}>} files
 * @param {{timeout?:number}} [opts]
 * @returns {Promise<{success:boolean, results:Array}>}
 */
import { GAS_TI_CSV_URL } from '../constance/constance';

export function uploadTiCsvViaGas(files, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!GAS_TI_CSV_URL) {
      reject(new Error('GAS_TI_CSV_URL is not configured (constance.js)'));
      return;
    }
    if (!Array.isArray(files) || files.length === 0) {
      resolve({ success: true, results: [] });
      return;
    }

    const name = `gas-ti-${Date.now()}`;
    const iframe = document.createElement('iframe');
    iframe.name = name;
    iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;left:-9999px;';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GAS_TI_CSV_URL;
    form.target = name;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify({ files });
    form.appendChild(input);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      window.removeEventListener('message', handler);
      clearTimeout(timer);
      try { document.body.removeChild(iframe); } catch { /* already gone */ }
      try { document.body.removeChild(form); } catch { /* already gone */ }
    };

    const handler = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data._gasUploadResponse) {
          cleanup();
          if (data.success) resolve(data);
          else reject(new Error(data.error || 'GAS upload failed'));
        }
      } catch { /* not our message */ }
    };
    window.addEventListener('message', handler);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Drive upload timed out — sign in to Google (minebea) in this browser and retry.'));
    }, timeout);

    form.submit();
  });
}

export default uploadTiCsvViaGas;
