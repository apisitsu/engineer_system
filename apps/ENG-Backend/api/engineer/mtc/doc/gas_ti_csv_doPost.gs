/**
 * ═══════════════════════════════════════════════════════════════════════
 * gas_ti_csv_doPost.gs — put the Tooling Inspection CSVs on Drive
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS
 * ───────────────
 * The backend used to write these two CSVs straight into a Google Drive for
 * Desktop folder (`G:\Shared drives\...`), which fails intermittently with
 * `UNKNOWN` / errno -4094 because Drive holds the file while it syncs. The
 * obvious fix — POST the CSV to an Apps Script web app from the backend — does
 * NOT work in this Workspace: the minebea admin blocks anonymous ("Anyone")
 * access to web apps, so a server request with no Google session is redirected
 * to a login page and gets HTML, not JSON.
 *
 * So this is called the way Kanban's Drive uploader is (api/kanban/gas/Code.gs):
 * from the BROWSER, as a hidden form POST. The browser carries the signed-in
 * user's minebea session, which satisfies "Anyone within minebea.co.th". The
 * frontend generates the CSVs from the "Update data" response and submits them
 * here; this script writes them to Drive with the DEPLOYER's rights and replies
 * with an HTML page that postMessage()s the result back to the app.
 *
 * DEPLOYMENT
 * ──────────
 * 1. https://script.google.com → New Project → name it "TI CSV Upload"
 * 2. Paste this file into Code.gs
 * 3. Set FOLDER_ID to the Drive folder that holds the CSVs today.
 *    Open the folder in Drive; the ID is the last path segment of the URL.
 * 4. Deploy → New Deployment → Web App
 *      Execute as:      Me   ← YOUR Drive rights write the files
 *      Who has access:  Anyone within minebea.co.th   ← the browser's session is the gate
 *    On the first deploy Google asks you to authorize the Drive scope — do it.
 * 5. Copy the /exec URL into apps/ENG-Frontend/src/constance/constance.js as
 *    GAS_TI_CSV_URL.
 *
 * A brand-NEW deployment mints a new /exec URL; EDITING an existing one
 * (Manage deployments → pencil → Deploy) keeps the URL.
 *
 * REQUEST  (form POST, field `payload` = JSON string)
 *   { files: [ { fileName: "ToolingInspection.csv", base64Data: "..." }, ... ] }
 * RESPONSE (HTML page that postMessage()s this object, with _gasUploadResponse:true)
 *   { success, results: [ { fileName, ok, action:'updated'|'created', bytes, fileId } ] }
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────
const FOLDER_ID = 'PUT_THE_TOOLINGINSPECTION_FOLDER_ID_HERE';

// Only ever touch files that look like our two exports. A bug in the caller must
// not be able to overwrite something else in the folder.
const NAME_RE = /^[A-Za-z0-9_\-]+\.csv$/;

function doPost(e) {
  try {
    var raw = (e && e.parameter && e.parameter.payload) ? e.parameter.payload
            : (e && e.postData && e.postData.contents) ? e.postData.contents
            : null;
    if (!raw) return reply({ success: false, error: 'No payload received' });

    var payload = JSON.parse(raw);
    var files = payload.files
      || (payload.fileName ? [{ fileName: payload.fileName, base64Data: payload.base64Data }] : []);
    if (!files.length) return reply({ success: false, error: 'No files in payload' });

    var folder = DriveApp.getFolderById(FOLDER_ID);
    var results = files.map(function (f) {
      if (!f.fileName || !NAME_RE.test(f.fileName)) {
        return { fileName: f.fileName || '(none)', ok: false, error: 'unexpected fileName' };
      }
      if (!f.base64Data) return { fileName: f.fileName, ok: false, error: 'missing base64Data' };

      var text = Utilities.newBlob(Utilities.base64Decode(f.base64Data)).getDataAsString('UTF-8');
      var existing = folder.getFilesByName(f.fileName);

      // Update in place so the file ID and every IMPORTRANGE pointing at it keep
      // working. More than one file can share a name in Drive; if that happens it
      // means something made a duplicate and silently updating one would look
      // like the upload is not working.
      if (existing.hasNext()) {
        var file = existing.next();
        if (existing.hasNext()) {
          return { fileName: f.fileName, ok: false, error: 'multiple files with this name — resolve by hand' };
        }
        file.setContent(text);
        return { fileName: f.fileName, ok: true, action: 'updated', bytes: text.length, fileId: file.getId() };
      }
      var created = folder.createFile(f.fileName, text, MimeType.CSV);
      return { fileName: f.fileName, ok: true, action: 'created', bytes: text.length, fileId: created.getId() };
    });

    return reply({ success: results.every(function (r) { return r.ok; }), results: results });
  } catch (err) {
    return reply({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

/** GET in a browser to establish the Google auth session and confirm the deploy. */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px">'
    + '<h2>\u2705 TI CSV Upload</h2><p>Authorized and ready. You can close this tab.</p></body></html>'
  ).setTitle('TI CSV Upload');
}

/**
 * Reply as an HTML page that hands the result back to the app via postMessage —
 * a form-target response is not readable by the calling JS. Mirrors the bridge
 * in api/kanban/gas/Code.gs; the frontend matches on `_gasUploadResponse`.
 */
function reply(data) {
  data._gasUploadResponse = true;
  var json = JSON.stringify(data);
  var html = '<!DOCTYPE html><html><head><script>'
    + 'var d=' + json + ';'
    + 'function send(w){try{w.postMessage(d,"*");return true}catch(e){return false}}'
    + 'send(window.top.opener)||send(window.top)||send(window.parent);'
    + 'if(window.top.opener){window.close()}'
    + '</scr' + 'ipt></head><body>OK</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('TI CSV Upload')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
